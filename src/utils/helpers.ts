import { WorkOrder, Invoice, LaborRateCategory } from '../types/schemas';

// Default standard labor rate categories provided by client
export const DEFAULT_LABOR_RATE_CATEGORIES: LaborRateCategory[] = [
  { category_name: 'General Foreman', standard_rate: 58.49, ot_rate: 87.74, dt_rate: 116.98, benefits_rate: 25.22, match_tolerance: 0.20 },
  { category_name: 'Foreman', standard_rate: 57.30, ot_rate: 85.95, dt_rate: 114.60, benefits_rate: 24.90, match_tolerance: 0.20 },
  { category_name: 'Journeyman', standard_rate: 53.72, ot_rate: 80.58, dt_rate: 107.44, benefits_rate: 23.89, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Driver', standard_rate: 40.23, ot_rate: 60.35, dt_rate: 80.46, benefits_rate: 18.56, match_tolerance: 0.20 },
  { category_name: 'Apprentice', standard_rate: 37.60, ot_rate: 56.40, dt_rate: 75.20, benefits_rate: 15.48, match_tolerance: 0.20 },
  { category_name: 'Groundman', standard_rate: 26.94, ot_rate: 40.41, dt_rate: 53.88, benefits_rate: 14.66, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Helper', standard_rate: 15.00, ot_rate: 22.50, dt_rate: 30.00, benefits_rate: 9.48, match_tolerance: 0.20 },
];

// Helper to format currency
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
};

// Helper to format hours
export const formatHours = (val: number): string => {
  return (val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }) + ' hrs';
};

// Helper to get role rate information
export const getLaborRoleRates = (
  roleName: string,
  categories: LaborRateCategory[] = DEFAULT_LABOR_RATE_CATEGORIES
): LaborRateCategory | undefined => {
  if (!roleName) return undefined;
  const norm = roleName.trim().toLowerCase();
  return categories.find((c) => {
    const cNorm = c.category_name.trim().toLowerCase();
    if (cNorm === norm) return true;
    if ((norm === 'gforeman' || norm === 'general foreman') && (cNorm === 'general foreman' || cNorm === 'gforeman')) return true;
    return false;
  });
};

// Helper to get hourly benefits rate for a role
export const getLaborRoleBenefitsRate = (
  roleName: string,
  categories: LaborRateCategory[] = DEFAULT_LABOR_RATE_CATEGORIES
): number => {
  const role = getLaborRoleRates(roleName, categories);
  return role?.benefits_rate || 0;
};

// Labor cost calculation lives in ./laborCost.ts (computeLaborEntryCost / priceLaborEntry).

// Known secondary / tier labor rate mappings for frontend classification
export interface LaborRateMapping {
  category_name: string;
  rate: number;
  match_tolerance?: number;
}

export const KNOWN_SECONDARY_LABOR_RATES: LaborRateMapping[] = [
  { category_name: 'Journeyman', rate: 54.57, match_tolerance: 0.20 },
  { category_name: 'Journeyman', rate: 51.16, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Driver', rate: 38.31, match_tolerance: 0.20 },
  { category_name: 'Apprentice', rate: 30.70, match_tolerance: 0.20 },
  { category_name: 'Groundman', rate: 25.66, match_tolerance: 0.20 },
  { category_name: 'Pole Truck Helper', rate: 17.79, match_tolerance: 0.20 },
];

// Helper to match an actual hourly rate or WO assignment to a role category
export const classifyLaborRole = (
  hourlyRate: number,
  categories: LaborRateCategory[] = DEFAULT_LABOR_RATE_CATEGORIES,
  employeeName?: string,
  workOrder?: { general_foreman?: string; foreman?: string },
  allGfNames?: Set<string>,
  allForemanNames?: Set<string>
): string => {
  const normEmp = employeeName ? employeeName.trim().toLowerCase() : '';

  // 1. Crew leadership matching by Employee Name / Work Order assignments (Highest Priority)
  if (normEmp) {
    if (
      (workOrder?.general_foreman && workOrder.general_foreman.trim().toLowerCase() === normEmp) ||
      (allGfNames && allGfNames.has(normEmp))
    ) {
      return 'General Foreman';
    }

    if (
      (workOrder?.foreman && workOrder.foreman.trim().toLowerCase() === normEmp) ||
      (allForemanNames && allForemanNames.has(normEmp))
    ) {
      return 'Foreman';
    }
  }

  // 2. Rate-based matching against configured rate categories with tolerance
  if (typeof hourlyRate === 'number' && !isNaN(hourlyRate) && hourlyRate > 0) {
    for (const cat of categories) {
      const tolerance = cat.match_tolerance !== undefined ? cat.match_tolerance : 0.20;
      if (Math.abs(hourlyRate - cat.standard_rate) <= tolerance) {
        return cat.category_name;
      }
    }

    // 3. Rate-based matching against secondary / tier rate schedules
    for (const mapping of KNOWN_SECONDARY_LABOR_RATES) {
      const tolerance = mapping.match_tolerance !== undefined ? mapping.match_tolerance : 0.20;
      if (Math.abs(hourlyRate - mapping.rate) <= tolerance) {
        return mapping.category_name;
      }
    }
  }

  return 'unclassified';
};

// Convert HH:MM (e.g. 08:30 or 8:45) or numbers/decimal strings to decimal hours (e.g. 8.5)
export const parseHoursToDecimal = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = val.toString().trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    return parseFloat((hours + minutes / 60).toFixed(2));
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

// Check if a work order status represents completed work
export const isWorkOrderCompleted = (status?: string | null): boolean => {
  if (!status) return false;
  return status === 'Field Complete' || status === 'CTCC Completed' || status === 'Ready to Bill';
};

// In-memory fallback for completed work orders that have no Fulcrum completion date:
// use the customer need date (or the legacy default). Never written to the database,
// so a real completion date stored there is never replaced by a guessed one.
export const withDerivedCompletionDate = <T extends { status?: string | null; date_work_completed?: unknown; customer_need_date?: unknown }>(wo: T): T => {
  if (wo.date_work_completed || !isWorkOrderCompleted(wo.status ?? undefined)) return wo;
  return { ...wo, date_work_completed: wo.customer_need_date || '2026-08-15' };
};

// Format a work order row for consistent database upload and state ingestion
export const formatWorkOrderForUpload = (wo: any): WorkOrder => {
  const customerNeedDate = normalizeDateForStorage(wo.customer_need_date);
  return {
    work_order_number: String(wo.work_order_number).trim(),
    status: wo.status || 'Work Pending',
    general_foreman: wo.general_foreman || 'Unassigned GF',
    foreman: wo.foreman || 'Unassigned Foreman',
    area: wo.area || deriveArea(wo.address || '', wo.latitude, wo.longitude),
    address: wo.address || '',
    latitude: typeof wo.latitude === 'number' ? wo.latitude : (parseFloat(wo.latitude) || 29.7604),
    longitude: typeof wo.longitude === 'number' ? wo.longitude : (parseFloat(wo.longitude) || -95.3698),
    locate_renewal_date: normalizeDateForStorage(wo.locate_renewal_date),
    // Only the real Fulcrum completion date from the file. The display fallback is
    // applied in memory by withDerivedCompletionDate and is never persisted.
    date_work_completed: normalizeDateForStorage(wo.date_work_completed),
    customer_need_date: customerNeedDate,
    locked_gates: !!wo.locked_gates,
    outage_required: !!wo.outage_required,
    permitting_needed: !!wo.permitting_needed,
    switching_required: !!wo.switching_required,
    traffic_control_needed: !!wo.traffic_control_needed,
    hydrovac_needed: !!wo.hydrovac_needed,
    tree_trimming_needed: !!wo.tree_trimming_needed,
  };
};

// Safe coordinate boundaries for Great Houston Area
export const HOUSTON_BOUNDS = {
  latMin: 29.5,
  latMax: 30.3,
  lngMin: -96.0,
  lngMax: -95.0,
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

// Builds YYYY-MM-DD only if it is a real calendar date (rejects e.g. 2026-02-30).
const toIsoIfValid = (y: number, m: number, d: number): string | null => {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
};

// Excel serial day numbers for 1954..2173; anything else is not treated as a serial.
const EXCEL_SERIAL_MIN = 20000;
const EXCEL_SERIAL_MAX = 99999;

const excelSerialToIso = (serial: number): string | null => {
  if (!Number.isFinite(serial) || serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) return null;
  // Excel epoch is Dec 30, 1899 (1900 leap-year bug). Computed in UTC; time of day is dropped.
  const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return toIsoIfValid(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};

/**
 * Converts any date value from Fulcrum / Coupa / Connecteam exports (or the DB) to a
 * calendar date string YYYY-MM-DD, or null. The calendar date is taken exactly as
 * written; it is never shifted by the browser's timezone (the previous implementation
 * used toISOString(), which moved dates back a day east of UTC, e.g. in Asia/Karachi).
 *
 * Accepts: Excel serial numbers (46212 or "46212"), YYYY-MM-DD[ time], YYYY/MM/DD,
 * M/D/YYYY[ time] (US, as Coupa exports), D/M/YYYY when the first part is > 12,
 * M/D/YY, and other strings Date can parse (e.g. "Aug 20, 2026").
 */
export const parseExcelDate = (val: unknown): string | null => {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') return excelSerialToIso(val);
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : toIsoIfValid(val.getFullYear(), val.getMonth() + 1, val.getDate());
  }

  const str = String(val).trim();
  if (!str) return null;

  // Excel serial stored as text (e.g. "46212" saved into a TEXT column)
  if (/^\d+(\.\d+)?$/.test(str)) return excelSerialToIso(parseFloat(str));

  // ISO / database form: 2026-08-20, 2026-08-20 07:00:00, 2026-08-20T07:00:00Z
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return toIsoIfValid(+m[1], +m[2], +m[3]);

  // 2026/08/20
  m = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s.*)?$/);
  if (m) return toIsoIfValid(+m[1], +m[2], +m[3]);

  // 8/20/2026, 08-20-2026, 8/20/26 (US month-first); 20/08/2026 when unambiguous
  m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (a > 12 && b <= 12) [a, b] = [b, a]; // day-first export
    return toIsoIfValid(y, a, b);
  }

  // Free-form text such as "Aug 20, 2026": use the local calendar date Date parsed.
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return toIsoIfValid(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
};

// Normalize a date for storage: YYYY-MM-DD when recognised, otherwise keep the raw text
// so nothing is lost (an unrecognised date simply won't match date filters).
export const normalizeDateForStorage = (val: unknown): string | null => {
  if (val === null || val === undefined || val === '') return null;
  return parseExcelDate(val) ?? String(val).trim();
};

// Generate a deterministic synthetic match between Invoice and Work Orders
export const runSyntheticJoin = (
  invoices: any[],
  workOrders: WorkOrder[]
): Invoice[] => {
  if (workOrders.length === 0) return [];
  const validInvoices = (invoices || []).filter((inv) => {
    const invNum = inv['Invoice #'] || inv.invoice_number;
    return (
      invNum !== null &&
      invNum !== undefined &&
      String(invNum).trim() !== '' &&
      String(invNum).trim() !== '0' &&
      String(invNum).trim().toLowerCase() !== 'null' &&
      String(invNum).trim().toLowerCase() !== 'undefined'
    );
  });

  return validInvoices.map((inv) => {
    const po = inv['PO #'] || inv.po_number || '';
    const invoiceNumber = String(inv['Invoice #'] || inv.invoice_number || '').trim();
    const match = po.match(/WO_(\d+)_/);
    let woNumber = match ? match[1] : null;
    let linkSource: 'native' | 'synthetic' = 'native';

    let targetWO = workOrders.find((w) => w.work_order_number === woNumber);

    if (!targetWO) {
      linkSource = 'synthetic';
      // Seeded modulo hash based on PO batch number or invoice number
      const seedInput = match ? match[1] + invoiceNumber : invoiceNumber;
      let hash = 0;
      for (let i = 0; i < seedInput.length; i++) {
        hash = seedInput.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % workOrders.length;
      targetWO = workOrders[idx];
      woNumber = targetWO.work_order_number;
    }

    return {
      id: inv.id || crypto.randomUUID(),
      invoice_number: invoiceNumber,
      created_date: parseExcelDate(inv['Created Date'] || inv.created_date),
      status: inv.Status || inv.status || 'Unapproved',
      po_number: po,
      work_order_id: targetWO.id || null,
      work_order_number: woNumber,
      link_source: linkSource,
      total: parseFloat(inv.Total || inv.total || '0'),
      unanswered_comments: (inv['Unanswered Comments'] || inv.unanswered_comments) === 'true' || (inv['Unanswered Comments'] || inv.unanswered_comments) === true,
      dispute_reason: inv['Dispute Reason'] || inv.dispute_reason || null,
    };
  });
};

// Categorize and derive Region / Area from address field
export const deriveArea = (address: string, latitude?: number, longitude?: number): string => {
  if (latitude && longitude) {
    const lat = latitude;
    const lng = longitude;
    if (lat >= 29.5 && lat <= 30.1 && lng >= -96.0 && lng <= -95.6) return 'KATY';
    if (lat >= 29.9 && lat <= 30.15 && lng >= -95.75 && lng <= -95.5) return 'CYPRESS';
    if (lat >= 30.0 && lat <= 30.25 && lng >= -95.65 && lng <= -95.35) return 'TOMBALL';
    if (lat >= 29.7 && lat <= 29.9 && lng >= -95.65 && lng <= -95.4) return 'BEAR CREEK';
    if (lat >= 29.95 && lat <= 30.2 && lng >= -95.5 && lng <= -95.25) return 'SPRING';
    if (lat >= 29.6 && lat <= 29.85 && lng >= -95.55 && lng <= -95.35) return 'SPRING BRANCH';
  }
  const upper = address.toUpperCase();
  if (upper.includes('CYPRESS')) return 'CYPRESS';
  if (upper.includes('TOMBALL')) return 'TOMBALL';
  if (upper.includes('KATY')) return 'KATY';
  if (upper.includes('SPRING')) {
    if (upper.includes('77080') || upper.includes('77055') || upper.includes('SPRING BRANCH')) return 'SPRING BRANCH';
    return 'SPRING';
  }
  if (upper.includes('77084') || upper.includes('77095') || upper.includes('BEAR CREEK') || upper.includes('CLAY RD')) return 'BEAR CREEK';
  if (upper.includes('HOUSTON')) return 'HOUSTON';
  return 'HOUSTON';
};

export const getFilterFingerprint = (filters: any): string => {
  return JSON.stringify({
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    generalForeman: filters.generalForeman || 'All',
    foreman: filters.foreman || 'All',
    workOrderNumbers: filters.workOrderNumbers || [],
    area: filters.area || 'All',
    status: filters.status || 'All',
  });
};

// Strict email validator
export const validateEmailAddress = (val: string): string => {
  const trimmed = (val || '').trim();
  if (!trimmed) return 'Email address is required';

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address (e.g. name@company.com)';
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) return 'Invalid email format';
  const [localPart, domainPart] = parts;

  if (/^\d+$/.test(localPart)) {
    return 'Email username cannot consist only of numbers (e.g. 123@gmail.com is not allowed)';
  }

  if (localPart.length < 2) {
    return 'Email username must be at least 2 characters long';
  }

  const domainParts = domainPart.split('.');
  if (domainParts.some((p) => !p || /^\d+$/.test(p))) {
    return 'Please enter a valid domain name in email address';
  }

  return '';
};


// Authoritative reporting date selector for Work Orders:
// - Completed work metrics MUST use Fulcrum Completion Date (date_work_completed).
// - Open/pending work metrics use Customer Need Date (customer_need_date) or creation date.
// - CRITICAL: NEVER use Fulcrum's "Last Updated" (_server_updated_at / _updated_at) because
//   any minor comment or edit will modify that timestamp and incorrectly shift the record into another reporting period.
export const getWorkOrderReportingDate = (wo: any): string | null => {
  if (!wo) return null;

  // 1. If date_work_completed is present (completed work), use Fulcrum Completion Date
  if (wo.date_work_completed) {
    const completedDate = parseExcelDate(wo.date_work_completed);
    if (completedDate) return completedDate;
  }

  // 2. Fallback to customer_need_date for pending work or if completion date is missing
  if (wo.customer_need_date) {
    const needDate = parseExcelDate(wo.customer_need_date);
    if (needDate) return needDate;
  }

  // 3. Fallback to created_date / created_at (NEVER _server_updated_at)
  if (wo.created_date) {
    const cDate = parseExcelDate(wo.created_date);
    if (cDate) return cDate;
  }
  if (wo.created_at) {
    const cDate = parseExcelDate(wo.created_at);
    if (cDate) return cDate;
  }

  return null;
};

// Authoritative date selector for Invoices:
// Uses the invoice's created_date or created_at column.
export const getInvoiceDate = (inv: any): string | null => {
  if (!inv) return null;
  if (inv.created_date) {
    const parsed = parseExcelDate(inv.created_date);
    if (parsed) return parsed;
  }
  if (inv.created_at) {
    const parsed = parseExcelDate(inv.created_at);
    if (parsed) return parsed;
  }
  return null;
};
