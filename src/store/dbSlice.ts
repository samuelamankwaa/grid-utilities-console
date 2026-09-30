import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../utils/supabaseClient';
import { Invoice, LaborEntry, LaborRateCategory, WorkOrder } from '../types/schemas';
import {
  runSyntheticJoin,
  deriveArea,
  DEFAULT_LABOR_RATE_CATEGORIES,
  getLaborRoleBenefitsRate,
  isWorkOrderCompleted,
  formatWorkOrderForUpload,
} from '../utils/helpers';

export interface ReconciliationSummary {
  uploadedType: 'work_orders' | 'invoices' | 'timesheet' | 'master';
  rowsAdded: number;
  affectedWorkOrdersCount: number;
  movedToMarginCalculated: number;
  movedToAwaitingLabor: number;
  timestamp: string;
}

export interface DbState {
  workOrders: WorkOrder[];
  invoices: Invoice[];
  laborEntries: LaborEntry[];
  laborRateCategories: LaborRateCategory[];
  overrides: Record<string, { add_amount: number; remove_amount: number; profit_margin_override?: number }>;
  dailyExpenseRate: number;
  reconciliationSummary: ReconciliationSummary | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const LOCAL_OVERRIDES_KEY = 'grid_utilities_overrides_v3';

// Clear any previously cached timesheet data from localStorage to ensure strictly live database operations
try {
  localStorage.removeItem('grid_utilities_timesheets_v4');
  localStorage.removeItem('grid_utilities_timesheets_v3');
  localStorage.removeItem('grid_utilities_timesheets_v2');
  localStorage.removeItem('grid_utilities_timesheets');
} catch (e) {}

// Helper to load persisted overrides
const loadPersistedOverrides = (): Record<string, any> => {
  try {
    const raw = localStorage.getItem(LOCAL_OVERRIDES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
};

const savePersistedOverrides = (overrides: Record<string, any>) => {
  try {
    localStorage.setItem(LOCAL_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {}
};

// Helper to deduplicate items by primary key before Supabase upsert
const deduplicateByKey = <T>(items: T[], keyFn: (item: T) => string): T[] => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const key = keyFn(item);
    if (key) map.set(key, item);
  });
  return Array.from(map.values());
};

// Fetch all rows from Supabase with automatic pagination (bypasses 1000-row limit)
const fetchAllRows = async (table: string): Promise<any[]> => {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select('*').range(from, to);
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }
  return allRows;
};

// Helper to generate compliant RFC4122 v4 UUIDs for PostgreSQL UUID columns
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
};

// Upsert items in safe batches of 500 to prevent payload limits
const upsertInChunks = async (table: string, items: any[], onConflictKey?: string) => {
  const chunkSize = 500;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const options: any = {};
    if (onConflictKey) {
      options.onConflict = onConflictKey;
    }
    const { error } = await supabase.from(table).upsert(chunk, options);
    if (error) {
      console.error(`Supabase upsert error on table ${table}:`, error);
      throw new Error(`Failed to save to ${table}: ${error.message}`);
    }
  }
};

const initialState: DbState = {
  workOrders: [],
  invoices: [],
  laborEntries: [],
  laborRateCategories: DEFAULT_LABOR_RATE_CATEGORIES,
  overrides: loadPersistedOverrides(),
  dailyExpenseRate: 5800,
  reconciliationSummary: null,
  status: 'idle',
};

export const fetchDbState = createAsyncThunk('db/fetchDbState', async () => {
  try {
    const [wos, invs, ovrs, labor] = await Promise.all([
      fetchAllRows('work_orders'),
      fetchAllRows('invoices'),
      fetchAllRows('expense_overrides'),
      fetchAllRows('connecteam_labor_entries')
    ]);

    const persistedOverrides = loadPersistedOverrides();

    const ovrMap: Record<string, any> = { ...persistedOverrides };
    (ovrs || []).forEach((item: any) => {
      ovrMap[item.filter_fingerprint] = {
        add_amount: item.add_amount,
        remove_amount: item.remove_amount,
        profit_margin_override: item.profit_margin_override,
      };
    });

    const parsedWorkOrders = (wos || []).map((w: any) => {
      const isCompleted = isWorkOrderCompleted(w.status);
      return {
        ...w,
        locate_renewal_date: w.locate_renewal_date || null,
        date_work_completed: w.date_work_completed || (isCompleted ? (w.customer_need_date || '2026-08-15') : null),
        customer_need_date: w.customer_need_date || null,
        area: w.area || deriveArea(w.address || '', w.latitude, w.longitude),
      };
    });

    const parsedInvoices = runSyntheticJoin(
      invs || [],
      parsedWorkOrders
    );

    const parsedLabor = (labor || []).map((e: any) => ({
      ...e,
      start_date: e.start_date || e.shift_date,
      end_date: e.end_date || e.shift_date,
    }));

    return {
      workOrders: parsedWorkOrders,
      invoices: parsedInvoices,
      laborEntries: parsedLabor,
      laborRateCategories: DEFAULT_LABOR_RATE_CATEGORIES,
      overrides: ovrMap,
    };
  } catch (error) {
    console.error('Error in fetchDbState:', error);
    return {
      workOrders: [],
      invoices: [],
      laborEntries: [],
      laborRateCategories: DEFAULT_LABOR_RATE_CATEGORIES,
      overrides: loadPersistedOverrides(),
    };
  }
});

export const uploadWorkOrdersThunk = createAsyncThunk(
  'db/uploadWorkOrders',
  async (workOrders: any[]) => {
    const formatted = workOrders.map((wo) => formatWorkOrderForUpload(wo));

    try {
      const deduplicatedWos = deduplicateByKey(formatted, (w) => w.work_order_number);
      const remotePayload = deduplicatedWos.map(({ date_work_completed, ...rest }) => rest);
      await upsertInChunks('work_orders', remotePayload, 'work_order_number');
      return deduplicatedWos;
    } catch (e: any) {
      console.warn('Supabase work orders upsert error:', e);
      throw e;
    }
  }
);

export const uploadInvoicesThunk = createAsyncThunk(
  'db/uploadInvoices',
  async (invoices: any[]) => {
    const validInvoices = invoices.filter((inv) => {
      const num = inv.invoice_number || inv['Invoice #'];
      return (
        num !== null &&
        num !== undefined &&
        String(num).trim() !== '' &&
        String(num).trim() !== '0' &&
        String(num).trim().toLowerCase() !== 'null' &&
        String(num).trim().toLowerCase() !== 'undefined'
      );
    });

    const formatted = validInvoices.map((inv) => ({
      invoice_number: String(inv.invoice_number || inv['Invoice #']).trim(),
      work_order_number: inv.work_order_number ? String(inv.work_order_number).trim() : null,
      status: inv.status || 'Unapproved',
      po_number: inv.po_number || '',
      total: typeof inv.total === 'number' ? inv.total : parseFloat(inv.total || '0'),
      created_date: inv.created_date || null,
      unanswered_comments: !!inv.unanswered_comments,
      dispute_reason: inv.dispute_reason || null,
    }));

    try {
      const deduplicatedInvoices = deduplicateByKey(formatted, (i) => i.invoice_number);

      // Ensure referenced parent work orders exist in Supabase to satisfy foreign key constraints
      const referencedWos = Array.from(new Set(deduplicatedInvoices.map(i => i.work_order_number).filter(Boolean)));
      if (referencedWos.length > 0) {
        const stubs = referencedWos.map(woNum => ({
          work_order_number: woNum,
          status: 'Work Pending',
          general_foreman: 'Unassigned GF',
          foreman: 'Unassigned Foreman',
          address: 'Pending Location',
          area: 'HOUSTON'
        }));
        await upsertInChunks('work_orders', stubs, 'work_order_number');
      }

      await upsertInChunks('invoices', deduplicatedInvoices, 'invoice_number');
      return deduplicatedInvoices;
    } catch (e: any) {
      console.warn('Supabase invoices upsert error:', e);
      throw e;
    }
  }
);

export const uploadTimesheetThunk = createAsyncThunk(
  'db/uploadTimesheet',
  async (entries: LaborEntry[]) => {
    const formatted = entries.map((e) => {
      const otHours = e.ot_hours !== undefined && e.ot_hours !== null && !isNaN(Number(e.ot_hours))
        ? Number(e.ot_hours)
        : (e.shift_hours > 8 ? parseFloat((e.shift_hours - 8).toFixed(2)) : 0);
      const otCost = e.ot_cost !== undefined && e.ot_cost !== null && !isNaN(Number(e.ot_cost)) && Number(e.ot_cost) > 0
        ? Number(e.ot_cost)
        : parseFloat((otHours * e.hourly_rate * 1.5).toFixed(2));

      const dtHours = e.dt_hours !== undefined && e.dt_hours !== null && !isNaN(Number(e.dt_hours))
        ? Number(e.dt_hours)
        : 0;
      const dtCost = e.dt_cost !== undefined && e.dt_cost !== null && !isNaN(Number(e.dt_cost)) && Number(e.dt_cost) > 0
        ? Number(e.dt_cost)
        : parseFloat((dtHours * e.hourly_rate * 2.0).toFixed(2));

      const regularHours = Math.max(0, parseFloat((e.shift_hours - otHours - dtHours).toFixed(2)));
      const regularCost = parseFloat((regularHours * e.hourly_rate).toFixed(2));

      const roleBenefitsRate = e.benefits_rate !== undefined && e.benefits_rate !== null && !isNaN(Number(e.benefits_rate)) && Number(e.benefits_rate) > 0
        ? Number(e.benefits_rate)
        : getLaborRoleBenefitsRate(e.role_category, DEFAULT_LABOR_RATE_CATEGORIES);

      const benefitsCost = e.benefits_cost !== undefined && e.benefits_cost !== null && !isNaN(Number(e.benefits_cost)) && Number(e.benefits_cost) > 0
        ? Number(e.benefits_cost)
        : parseFloat((e.shift_hours * roleBenefitsRate).toFixed(2));

      const calculatedLaborCost = parseFloat((regularCost + otCost + dtCost + benefitsCost).toFixed(2));

      const lineLaborCost = (e.line_labor_cost !== undefined && e.line_labor_cost !== null && !isNaN(Number(e.line_labor_cost)) && Number(e.line_labor_cost) > 0)
        ? Number(e.line_labor_cost)
        : calculatedLaborCost;

      const entryId = isValidUUID(e.id) ? e.id! : generateUUID();

      return {
        id: entryId,
        work_order_number: String(e.work_order_number).trim(),
        employee_name: e.employee_name,
        shift_date: e.shift_date,
        start_date: e.start_date || e.shift_date,
        end_date: e.end_date || e.shift_date,
        clock_in: e.clock_in || null,
        clock_out: e.clock_out || null,
        shift_hours: e.shift_hours,
        hourly_rate: e.hourly_rate,
        ot_hours: otHours,
        ot_cost: otCost,
        dt_hours: dtHours,
        dt_cost: dtCost,
        benefits_rate: roleBenefitsRate,
        benefits_cost: benefitsCost,
        line_labor_cost: lineLaborCost,
        role_category: e.role_category,
      };
    });

    try {
      await upsertInChunks('connecteam_labor_entries', formatted, 'id');
    } catch (e: any) {
      console.warn('Supabase connecteam_labor_entries upsert warning, attempting legacy payload fallback:', e);
      try {
        const legacyFormatted = formatted.map(({ dt_hours: _dt_hours, dt_cost: _dt_cost, benefits_cost: _benefits_cost, benefits_rate: _benefits_rate, start_date: _start_date, end_date: _end_date, ...rest }) => rest);
        await upsertInChunks('connecteam_labor_entries', legacyFormatted, 'id');
      } catch (fallbackErr) {
        console.error('Supabase connecteam_labor_entries upsert error:', fallbackErr);
        throw fallbackErr;
      }
    }

    return formatted;
  }
);

export const uploadJoinedMasterThunk = createAsyncThunk('db/uploadJoinedMaster', async (masterRows: any[]) => {
  const workOrdersToUpload = masterRows.map((row) => formatWorkOrderForUpload(row));

  const invoicesToUpload = masterRows
    .filter((row) => row.invoice_number)
    .map((row) => ({
      invoice_number: String(row.invoice_number).trim(),
      work_order_number: String(row.work_order_number).trim(),
      status: row.invoice_status || 'Unapproved',
      po_number: row.po_number || 'PO_' + row.work_order_number,
      total: typeof row.total === 'number' ? row.total : parseFloat(row.total || '0'),
      created_date: row.created_date || null,
      unanswered_comments: !!row.unanswered_comments,
      dispute_reason: row.dispute_reason || null,
    }));

  try {
    const dedupedWos = deduplicateByKey(workOrdersToUpload, (w) => w.work_order_number);
    const remotePayload = dedupedWos.map(({ date_work_completed: _date_work_completed, ...rest }) => rest);
    await upsertInChunks('work_orders', remotePayload, 'work_order_number');

    let invData: any[] = [];
    if (invoicesToUpload.length > 0) {
      const dedupedInvoices = deduplicateByKey(invoicesToUpload, (i) => i.invoice_number);
      await upsertInChunks('invoices', dedupedInvoices, 'invoice_number');
      invData = dedupedInvoices;
    }

    return { workOrders: dedupedWos, invoices: invData.length > 0 ? invData : invoicesToUpload };
  } catch (_e) {
    return { workOrders: workOrdersToUpload, invoices: invoicesToUpload };
  }
});

export const saveOverrideThunk = createAsyncThunk('db/saveOverride', async (override: any) => {
  const formatted = {
    filter_fingerprint: override.filter_fingerprint,
    add_amount: typeof override.add_amount === 'number' ? override.add_amount : parseFloat(override.add_amount || '0') || 0.0,
    remove_amount: typeof override.remove_amount === 'number' ? override.remove_amount : parseFloat(override.remove_amount || '0') || 0.0,
    profit_margin_override: (override.profit_margin_override !== undefined && override.profit_margin_override !== null && override.profit_margin_override !== '')
      ? (typeof override.profit_margin_override === 'number' ? override.profit_margin_override : parseFloat(override.profit_margin_override))
      : null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('expense_overrides')
      .upsert(formatted, { onConflict: 'filter_fingerprint' });
    if (error) {
      console.warn('Supabase expense_overrides upsert error:', error);
    }
  } catch (e) {
    console.warn('Expense override network error:', e);
  }

  return formatted;
});

// Calculate scoped reconciliation summary based on affected work orders
const calculateReconciliation = (
  affectedWoNumbers: string[],
  invoices: any[],
  laborEntries: LaborEntry[],
  uploadedType: 'work_orders' | 'invoices' | 'timesheet' | 'master',
  rowsAdded: number
): ReconciliationSummary => {
  const uniqueWos = Array.from(new Set(affectedWoNumbers.filter(Boolean)));
  let movedToMarginCalculated = 0;
  let movedToAwaitingLabor = 0;

  uniqueWos.forEach((woNum) => {
    const hasInvoice = invoices.some((i) => i.work_order_number === woNum && i.total > 0);
    const hasLabor = laborEntries.some((l) => l.work_order_number === woNum && l.shift_hours > 0);

    if (hasInvoice && hasLabor) {
      movedToMarginCalculated++;
    } else if (hasInvoice && !hasLabor) {
      movedToAwaitingLabor++;
    }
  });

  return {
    uploadedType,
    rowsAdded,
    affectedWorkOrdersCount: uniqueWos.length,
    movedToMarginCalculated,
    movedToAwaitingLabor,
    timestamp: new Date().toLocaleTimeString(),
  };
};

export const dbSlice = createSlice({
  name: 'db',
  initialState,
  reducers: {
    clearReconciliationSummary: (state) => {
      state.reconciliationSummary = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDbState.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchDbState.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.workOrders = action.payload.workOrders;
        state.invoices = action.payload.invoices;
        state.laborEntries = action.payload.laborEntries;
        state.laborRateCategories = action.payload.laborRateCategories;
        state.overrides = action.payload.overrides;
      })
      .addCase(fetchDbState.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(uploadWorkOrdersThunk.fulfilled, (state, action) => {
        const affected: string[] = [];
        action.payload.forEach((item: any) => {
          affected.push(item.work_order_number);
          const idx = state.workOrders.findIndex((w) => w.work_order_number === item.work_order_number);
          if (idx !== -1) {
            state.workOrders[idx] = { ...state.workOrders[idx], ...item };
          } else {
            state.workOrders.push(item);
          }
        });
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'work_orders',
          action.payload.length
        );
      })
      .addCase(uploadInvoicesThunk.fulfilled, (state, action) => {
        const joinedInvoices = runSyntheticJoin(action.payload, state.workOrders);
        const affected: string[] = [];
        joinedInvoices.forEach((item: any) => {
          if (item.work_order_number) affected.push(item.work_order_number);
          const idx = state.invoices.findIndex((i) => i.invoice_number === item.invoice_number);
          if (idx !== -1) {
            state.invoices[idx] = { ...state.invoices[idx], ...item };
          } else {
            state.invoices.push(item);
          }
        });
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'invoices',
          action.payload.length
        );
      })
      .addCase(uploadTimesheetThunk.fulfilled, (state, action) => {
        const affected: string[] = [];
        action.payload.forEach((entry: LaborEntry) => {
          affected.push(entry.work_order_number);
          state.laborEntries.unshift(entry);
        });
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'timesheet',
          action.payload.length
        );
      })
      .addCase(uploadJoinedMasterThunk.fulfilled, (state, action) => {
        const affected: string[] = [];
        action.payload.workOrders.forEach((item: any) => {
          affected.push(item.work_order_number);
          const idx = state.workOrders.findIndex((w) => w.work_order_number === item.work_order_number);
          if (idx !== -1) {
            state.workOrders[idx] = { ...state.workOrders[idx], ...item };
          } else {
            state.workOrders.push(item);
          }
        });
        const joinedInvoices = runSyntheticJoin(action.payload.invoices, state.workOrders);
        joinedInvoices.forEach((item: any) => {
          if (item.work_order_number) affected.push(item.work_order_number);
          const idx = state.invoices.findIndex((i) => i.invoice_number === item.invoice_number);
          if (idx !== -1) {
            state.invoices[idx] = { ...state.invoices[idx], ...item };
          } else {
            state.invoices.push(item);
          }
        });
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'master',
          action.payload.workOrders.length
        );
      })
      .addCase(saveOverrideThunk.fulfilled, (state, action) => {
        const { filter_fingerprint, add_amount, remove_amount, profit_margin_override } = action.payload;
        state.overrides[filter_fingerprint] = { add_amount, remove_amount, profit_margin_override };
        savePersistedOverrides(state.overrides);
      });
  },
});

export const { clearReconciliationSummary } = dbSlice.actions;
export default dbSlice.reducer;
