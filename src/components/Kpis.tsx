import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { saveOverrideThunk } from '../store/dbSlice';
import { getFilterFingerprint, getWorkOrderReportingDate, getInvoiceDate, calculateLaborEntryCost, formatHours } from '../utils/helpers';
import { Pencil, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

export const Kpis: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices, laborEntries, laborRateCategories, overrides, dailyExpenseRate } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);

  const role = currentUser?.role || 'Supervisor';
  const isSupervisor = role === 'Supervisor';
  const isAdmin = role === 'Admin';
  const isEmployee = role === 'Employee';

  const fingerprint = useMemo(() => getFilterFingerprint(filters), [filters]);
  const activeOverride = overrides[fingerprint] || { add_amount: 0, remove_amount: 0, profit_margin_override: null };

  const filteredWO = useMemo(() => {
    return workOrders.filter(w => {
      if (filters.generalForeman !== 'All crews' && w.general_foreman !== filters.generalForeman) return false;
      if (filters.foreman.length > 0 && !filters.foreman.includes(w.foreman)) return false;
      if (filters.workOrderNumbers && filters.workOrderNumbers.length > 0 && !filters.workOrderNumbers.includes(w.work_order_number)) return false;
      if (filters.area !== 'All areas' && w.area !== filters.area) return false;
      // Order date range filters
      if (filters.startDate || filters.endDate) {
        const dateVal = getWorkOrderReportingDate(w);
        if (dateVal) {
          if (filters.startDate && dateVal < filters.startDate) return false;
          if (filters.endDate && dateVal > filters.endDate) return false;
        } else {
          return false;
        }
      }
      return true;
    });
  }, [workOrders, filters]);

  const filteredInvoices = useMemo(() => {
    const woMap = new Map<string, any>();
    workOrders.forEach((w) => {
      if (w.work_order_number) woMap.set(String(w.work_order_number).trim(), w);
    });

    return invoices.filter(i => {
      // 1. Status filter
      if (filters.status !== 'All statuses' && i.status !== filters.status) return false;

      // 2. Invoice Date filter based on created_at / created_date
      const invDate = getInvoiceDate(i);
      if (invDate) {
        if (filters.startDate && invDate < filters.startDate) return false;
        if (filters.endDate && invDate > filters.endDate) return false;
      } else if (filters.startDate || filters.endDate) {
        return false;
      }

      // 3. Work Order linked filters (Crew, Area, WO #)
      const wo = i.work_order_number ? woMap.get(String(i.work_order_number).trim()) : undefined;
      const gf = wo?.general_foreman;
      const f = wo?.foreman;
      const area = wo?.area;

      if (filters.generalForeman !== 'All crews' && gf !== filters.generalForeman) return false;
      if (filters.foreman.length > 0 && (!f || !filters.foreman.includes(f))) return false;
      if (filters.workOrderNumbers && filters.workOrderNumbers.length > 0 && !filters.workOrderNumbers.includes(i.work_order_number || '')) return false;
      if (filters.area !== 'All areas' && area !== filters.area) return false;

      return true;
    });
  }, [invoices, workOrders, filters]);

  // Operational stats
  const woCount = filteredWO.length;
  const woCompleted = filteredWO.filter(w => w.status === 'Ready to Bill' || w.status === 'CTCC Completed').length;
  const woOpen = woCount - woCompleted;
  const woPending = filteredWO.filter(w => w.status === 'Work Pending').length;

  // Financial stats
  const invoicedAmount = filteredInvoices.reduce((sum, i) => sum + i.total, 0);
  const invoiceCount = filteredInvoices.length;
  const avgInvoice = invoiceCount > 0 ? invoicedAmount / invoiceCount : 0;

  const foremanBookedDays = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const woMap = new Map<string, any>();
    workOrders.forEach((w) => {
      if (w.work_order_number) woMap.set(String(w.work_order_number).trim(), w);
    });

    filteredInvoices.forEach(inv => {
      const wo = inv.work_order_number ? woMap.get(String(inv.work_order_number).trim()) : undefined;
      const invDate = getInvoiceDate(inv);
      if (wo && invDate) {
        const f = wo.foreman || 'Unassigned';
        if (!map[f]) map[f] = new Set();
        map[f].add(invDate);
      }
    });
    let totalDays = 0;
    Object.values(map).forEach(set => { totalDays += set.size; });
    return totalDays;
  }, [filteredInvoices, workOrders]);

  const baseExpense = foremanBookedDays * dailyExpenseRate;

  // Filtered Labor Entries mapped to dashboard filters
  const filteredLabor = useMemo(() => {
    const woMap = new Map<string, any>();
    workOrders.forEach((w) => {
      if (w.work_order_number) woMap.set(String(w.work_order_number).trim(), w);
    });

    return (laborEntries || []).filter((entry) => {
      const wo = woMap.get(String(entry.work_order_number || '').trim());
      const gf = wo?.general_foreman || 'Unassigned GF';
      const f = wo?.foreman || 'Unassigned Foreman';
      const area = wo?.area || '';

      if (filters.generalForeman !== 'All crews' && gf !== filters.generalForeman) return false;
      if (filters.foreman.length > 0 && !filters.foreman.includes(f)) return false;
      if (filters.workOrderNumbers && filters.workOrderNumbers.length > 0 && !filters.workOrderNumbers.includes(entry.work_order_number)) return false;
      if (filters.area !== 'All areas' && area !== filters.area) return false;
      if (filters.startDate || filters.endDate) {
        if (!entry.shift_date) return false;
        if (filters.startDate && entry.shift_date < filters.startDate) return false;
        if (filters.endDate && entry.shift_date > filters.endDate) return false;
      }
      return true;
    });
  }, [laborEntries, workOrders, filters]);

  // Base Labor Cost: complete sum of regular + OT + DT + Benefits across matching shifts
  const baseLaborCost = useMemo(() => {
    return filteredLabor.reduce((sum, e) => sum + calculateLaborEntryCost(e, laborRateCategories), 0);
  }, [filteredLabor, laborRateCategories]);

  const totalLaborHours = useMemo(() => {
    return filteredLabor.reduce((sum, e) => sum + (e.shift_hours || 0), 0);
  }, [filteredLabor]);

  const [addExpense, setAddExpense] = useState('');
  const [removeExpense, setRemoveExpense] = useState('');
  const [marginOverride, setMarginOverride] = useState('');
  const [showMarginInput, setShowMarginInput] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setAddExpense(activeOverride.add_amount > 0 ? activeOverride.add_amount.toString() : '');
    setRemoveExpense(activeOverride.remove_amount > 0 ? activeOverride.remove_amount.toString() : '');
    setMarginOverride((activeOverride.profit_margin_override !== null && activeOverride.profit_margin_override !== undefined) ? activeOverride.profit_margin_override.toString() : '');
  }, [activeOverride]);

  const currentAdd = addExpense !== '' && !isNaN(parseFloat(addExpense)) ? parseFloat(addExpense) : (activeOverride.add_amount || 0);
  const currentRemove = removeExpense !== '' && !isNaN(parseFloat(removeExpense)) ? parseFloat(removeExpense) : (activeOverride.remove_amount || 0);

  // Use actual labor cost if timesheets are present; otherwise fallback to standard daily expense rate
  const effectiveBaseLabor = baseLaborCost > 0 ? baseLaborCost : baseExpense;
  const totalLaborCost = effectiveBaseLabor + currentAdd - currentRemove;
  const computedMargin = invoicedAmount - totalLaborCost;
  const profitMargin: number = (activeOverride.profit_margin_override !== null && activeOverride.profit_margin_override !== undefined) ? activeOverride.profit_margin_override : computedMargin;
  const profitMarginPct = invoicedAmount > 0 ? (profitMargin / invoicedAmount) * 100 : 0;

  const handleSaveOverrides = async (updates: any) => {
    setSaveState('saving');
    const newOverride = {
      filter_fingerprint: fingerprint,
      add_amount: updates.add_amount !== undefined ? updates.add_amount : (addExpense !== '' && !isNaN(parseFloat(addExpense)) ? parseFloat(addExpense) : activeOverride.add_amount),
      remove_amount: updates.remove_amount !== undefined ? updates.remove_amount : (removeExpense !== '' && !isNaN(parseFloat(removeExpense)) ? parseFloat(removeExpense) : activeOverride.remove_amount),
      profit_margin_override: updates.profit_margin_override !== undefined ? updates.profit_margin_override : activeOverride.profit_margin_override,
    };
    try {
      await dispatch(saveOverrideThunk(newOverride) as any).unwrap();
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (e) {
      console.warn('Error saving override to db:', e);
      setSaveState('idle');
    }
  };

  const formatCurrency = (num: number) => {
    return '$' + Math.round(num).toLocaleString();
  };

  // EMPLOYEE VIEW: Non-financial Operational KPIs only
  if (isEmployee) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none font-sans">
        {/* Total Work Orders */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Total Work Orders
            </p>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
              Active
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 my-2">{woCount}</h1>
          <p className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-emerald-600">{woCompleted} completed</span> · {woOpen} remaining in pipeline
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${woCount > 0 ? (woCompleted / woCount) * 100 : 0}%` }}
            />
          </div>
        </motion.div>

        {/* Ready to Bill / Completed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Field Completion Rate
            </p>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 my-2">
            {woCount > 0 ? Math.round((woCompleted / woCount) * 100) : 0}%
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-slate-700">{woCompleted} of {woCount}</span> orders completed or ready to bill
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${woCount > 0 ? (woCompleted / woCount) * 100 : 0}%` }}
            />
          </div>
        </motion.div>

        {/* Work Pending */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Work Orders Pending
            </p>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 my-2">{woPending}</h1>
          <p className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-amber-600">{woOpen} total open</span> awaiting field action or checks
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${woCount > 0 ? (woPending / woCount) * 100 : 0}%` }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // SUPERVISOR & ADMIN VIEW (Admin hides profit margin)
  return (
    <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6 select-none font-sans`}>
      {/* Invoiced Amount */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
      >
        <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Invoiced Amount</p>
        <h1 className="text-3xl font-extrabold text-slate-900 my-2">{formatCurrency(invoicedAmount)}</h1>
        <p className="text-xs text-slate-500 font-medium">
          <span className="font-semibold text-slate-700">{invoiceCount} {invoiceCount === 1 ? 'invoice' : 'invoices'}</span> · avg {formatCurrency(avgInvoice)}
        </p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className="bg-blue-600 h-full rounded-full" style={{ width: '100%' }} />
        </div>
      </motion.div>

      {/* Total Labor Cost (Replaces Total Expense) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Total Labor Cost</p>
          <DollarSign className="w-4 h-4 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 my-2">{formatCurrency(totalLaborCost)}</h1>
        <p className="text-[11px] text-slate-500 font-medium mt-1">
          {baseLaborCost > 0 ? (
            <span>
              base labor <strong className="text-slate-700 font-mono">{formatCurrency(baseLaborCost)}</strong> · {filteredLabor.length} {filteredLabor.length === 1 ? 'shift' : 'shifts'} ({formatHours(totalLaborHours)})
            </span>
          ) : (
            <span>
              base <strong className="text-slate-700 font-mono">{formatCurrency(baseExpense)}</strong> · {foremanBookedDays} foreman-days
            </span>
          )}
        </p>

        {!isEmployee && (
          <>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expense Add Amount</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold">+ $</span>
                  <input
                    type="text"
                    value={addExpense}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*\.?\d*$/.test(val)) setAddExpense(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveOverrides({ add_amount: parseFloat(addExpense || '0') });
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    onBlur={() => handleSaveOverrides({ add_amount: parseFloat(addExpense || '0') })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expense Less Amount</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold">- $</span>
                  <input
                    type="text"
                    value={removeExpense}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*\.?\d*$/.test(val)) setRemoveExpense(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveOverrides({ remove_amount: parseFloat(removeExpense || '0') });
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    onBlur={() => handleSaveOverrides({ remove_amount: parseFloat(removeExpense || '0') })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5 text-[9px] font-mono text-slate-400">
              <span>{formatCurrency(effectiveBaseLabor)} + ${currentAdd} - ${currentRemove} = {formatCurrency(totalLaborCost)}</span>
              {saveState === 'saving' ? (
                <span className="text-blue-500 animate-pulse font-semibold">Saving to DB...</span>
              ) : saveState === 'saved' ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">✓ Saved in DB</span>
              ) : null}
            </div>
          </>
        )}
      </motion.div>

      {/* Profit Margin (Supervisor Only) */}
      {isSupervisor && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all relative group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Profit Margin</p>
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100">
              Supervisor View
            </span>
          </div>

          <div className="flex items-center gap-2 my-2">
            {showMarginInput ? (
              <input
                type="number"
                value={marginOverride}
                placeholder="Computed margin"
                onChange={(e) => setMarginOverride(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowMarginInput(false);
                    handleSaveOverrides({
                      profit_margin_override: marginOverride === '' ? null : parseFloat(marginOverride),
                    });
                  }
                }}
                onBlur={() => {
                  setShowMarginInput(false);
                  handleSaveOverrides({
                    profit_margin_override: marginOverride === '' ? null : parseFloat(marginOverride),
                  });
                }}
                autoFocus
                className="text-xl font-extrabold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5 w-36 focus:outline-none"
              />
            ) : (
              <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-1.5">
                {formatCurrency(profitMargin)}
                <Pencil
                  onClick={() => setShowMarginInput(true)}
                  className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-blue-600"
                />
              </h1>
            )}
          </div>

          <p className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-slate-700">{Math.round(profitMarginPct)}%</span> of invoiced amount kept
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, profitMarginPct))}%` }}
            />
          </div>
          <div className="text-[9px] font-mono text-slate-400 mt-4">
            {formatCurrency(invoicedAmount)} - {formatCurrency(totalLaborCost)} = {formatCurrency(computedMargin)}
            {(activeOverride.profit_margin_override !== null && activeOverride.profit_margin_override !== undefined) && (
              <span className="text-amber-600 font-semibold"> (Overridden)</span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
export default Kpis;
