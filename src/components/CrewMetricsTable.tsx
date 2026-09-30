import React, { useMemo, useState, useEffect } from 'react';
import { getWorkOrderReportingDate, getInvoiceDate } from '../utils/helpers';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { setFilters } from '../store/filtersSlice';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const CrewMetricsTable: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices, dailyExpenseRate } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);

  const role = currentUser?.role || 'Supervisor';
  const isSupervisor = role === 'Supervisor';
  const isEmployee = role === 'Employee';

  const [viewMode, setViewMode] = useState<'General Foreman' | 'Foreman'>('Foreman');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const metrics = useMemo(() => {
    const GFData: Record<string, { name: string; type: 'GF'; wos: number; complete: number; days: number; revenue: number; expense: number; margin: number; cycle: number; onTime: number; discipline: number; expired: number; doneVal: number; realization: number; renbill: number; unbilled: number; kmJob: number; prereqs: number; areas: number }> = {};
    const FData: Record<string, { name: string; gf: string; type: 'Foreman'; wos: number; complete: number; days: number; revenue: number; expense: number; margin: number; cycle: number; onTime: number; discipline: number; expired: number; doneVal: number; realization: number; renbill: number; unbilled: number; kmJob: number; prereqs: number; areas: number }> = {};

    const bookedDatesMap: Record<string, Set<string>> = {};
    const revenueMap: Record<string, number> = {};
    
    const woMap = new Map<string, any>();
    workOrders.forEach((w) => {
      if (w.work_order_number) woMap.set(String(w.work_order_number).trim(), w);
    });

    invoices.forEach(inv => {
      if (filters.status !== 'All statuses' && inv.status !== filters.status) return;
      if (filters.workOrderNumbers && filters.workOrderNumbers.length > 0 && !filters.workOrderNumbers.includes(inv.work_order_number || '')) return;
      
      const invDate = getInvoiceDate(inv);
      if (invDate) {
        if (filters.startDate && invDate < filters.startDate) return;
        if (filters.endDate && invDate > filters.endDate) return;
      } else if (filters.startDate || filters.endDate) {
        return;
      }

      const wo = inv.work_order_number ? woMap.get(String(inv.work_order_number).trim()) : undefined;
      if (wo) {
        const f = wo.foreman;
        if (f) {
          if (!bookedDatesMap[f]) bookedDatesMap[f] = new Set();
          if (invDate) {
            bookedDatesMap[f].add(invDate);
          }
          if (!revenueMap[f]) revenueMap[f] = 0;
          revenueMap[f] += inv.total;
        }
      }
    });

    workOrders.forEach(wo => {
      if (filters.workOrderNumbers && filters.workOrderNumbers.length > 0 && !filters.workOrderNumbers.includes(wo.work_order_number)) return;
      // Order date range filters
      if (filters.startDate || filters.endDate) {
        const dateVal = getWorkOrderReportingDate(wo);
        if (dateVal) {
          if (filters.startDate && dateVal < filters.startDate) return;
          if (filters.endDate && dateVal > filters.endDate) return;
        } else {
          return;
        }
      }
      const gf = wo.general_foreman;
      const f = wo.foreman;

      if (!GFData[gf]) {
        GFData[gf] = { name: gf, type: 'GF', wos: 0, complete: 0, days: 0, revenue: 0, expense: 0, margin: 0, cycle: 28, onTime: 33, discipline: 78, expired: 12, doneVal: 18000, realization: 74, renbill: 8, unbilled: 0, kmJob: 9.2, prereqs: 3.2, areas: 4 };
      }
      if (!FData[f]) {
        FData[f] = { name: f, gf, type: 'Foreman', wos: 0, complete: 0, days: 0, revenue: 0, expense: 0, margin: 0, cycle: 31, onTime: 28, discipline: 82, expired: 15, doneVal: 17000, realization: 76, renbill: 10, unbilled: 0, kmJob: 8.8, prereqs: 3.1, areas: 3 };
      }

      const gfNode = GFData[gf];
      const fNode = FData[f];

      gfNode.wos++;
      fNode.wos++;

      if (wo.status === 'Ready to Bill' || wo.status === 'CTCC Completed') {
        gfNode.complete++;
        fNode.complete++;
      }
    });

    Object.keys(FData).forEach(f => {
      const node = FData[f];
      const bookedDays = bookedDatesMap[f] ? bookedDatesMap[f].size : 0;
      const rev = revenueMap[f] || 0;
      const exp = bookedDays * dailyExpenseRate;

      node.days = bookedDays;
      node.revenue = rev;
      node.expense = exp;
      node.margin = rev - exp;

      const gfNode = GFData[node.gf];
      if (gfNode) {
        gfNode.days += bookedDays;
        gfNode.revenue += rev;
        gfNode.expense += exp;
        gfNode.margin += (rev - exp);
      }
    });

    return {
      gfs: Object.values(GFData),
      foremen: Object.values(FData),
    };
  }, [workOrders, invoices, dailyExpenseRate, filters]);

  const currentRows = viewMode === 'General Foreman' ? metrics.gfs : metrics.foremen;

  // Reset pagination on view mode, filter, or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, filters, pageSize]);

  // Paginated rows calculation
  const totalPages = Math.max(1, Math.ceil(currentRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, currentRows.length);
  const paginatedRows = useMemo(() => {
    return currentRows.slice(startIndex, endIndex);
  }, [currentRows, startIndex, endIndex]);

  const handleRowClick = (row: any) => {
    if (row.type === 'GF') {
      dispatch(setFilters({ generalForeman: row.name, foreman: [] }));
    } else {
      dispatch(setFilters({ generalForeman: row.gf, foreman: [row.name] }));
    }
  };

  const formatCurrency = (val: number) => {
    if (val === 0) return '-';
    return '$' + Math.round(val / 1000) + 'k';
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 select-none overflow-x-auto font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 my-0">Crew Performance Metrics</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {isEmployee
              ? 'Click a row to filter dashboard to that crew. Displays field productivity and booked time.'
              : 'Click a row to filter dashboard to that crew. Money calculations run on booked days model.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('General Foreman')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                viewMode === 'General Foreman' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              General Foreman
            </button>
            <button
              onClick={() => setViewMode('Foreman')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                viewMode === 'Foreman' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Foreman
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <label className="text-[11px] font-semibold text-slate-400">Rows:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-left text-xs text-slate-600 min-w-[700px]">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
          <tr>
            <th className="py-3 px-4 font-semibold">{viewMode === 'General Foreman' ? 'General Foreman' : 'Foreman'}</th>
            <th className="py-3 px-4 font-semibold text-right">WOs</th>
            <th className="py-3 px-4 font-semibold text-right">Complete %</th>
            <th className="py-3 px-4 font-semibold text-right">Booked Days</th>
            <th className="py-3 px-4 font-semibold text-right">Hours Worked</th>
            {!isEmployee && <th className="py-3 px-4 font-semibold text-right">Revenue</th>}
            {!isEmployee && <th className="py-3 px-4 font-semibold text-right">Expense</th>}
            {isSupervisor && <th className="py-3 px-4 font-semibold text-right">Margin</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedRows.map(row => (
            <tr
              key={row.name}
              onClick={() => handleRowClick(row)}
              className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
            >
              <td className="py-3 px-4 font-bold text-slate-800">{row.name}</td>
              <td className="py-3 px-4 text-right font-mono">{row.wos}</td>
              <td className="py-3 px-4 text-right font-mono text-blue-600 font-semibold">
                {Math.round((row.complete / (row.wos || 1)) * 100)}%
              </td>
              <td className="py-3 px-4 text-right font-mono">{row.days || '-'}</td>
              <td className="py-3 px-4 text-right font-mono">{row.days ? row.days * 8 + ' hrs' : '-'}</td>
              {!isEmployee && <td className="py-3 px-4 text-right font-mono">{formatCurrency(row.revenue)}</td>}
              {!isEmployee && <td className="py-3 px-4 text-right font-mono text-red-600">{formatCurrency(row.expense)}</td>}
              {isSupervisor && (
                <td
                  className={`py-3 px-4 text-right font-mono font-bold ${
                    row.margin >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(row.margin)}
                </td>
              )}
            </tr>
          ))}
          {paginatedRows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-400">
                No crew performance records found for current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Bar */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
        <div className="font-medium">
          {currentRows.length === 0 ? (
            <span>0 entries</span>
          ) : (
            <span>
              Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{' '}
              <strong className="text-slate-800">{endIndex}</strong> of{' '}
              <strong className="text-slate-800">{currentRows.length}</strong> {viewMode === 'General Foreman' ? 'General Foremen' : 'Foremen'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 select-none">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="First Page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="px-2.5 py-1 font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
            Page <strong className="text-blue-600">{safeCurrentPage}</strong> of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Last Page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default CrewMetricsTable;
