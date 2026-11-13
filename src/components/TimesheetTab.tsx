import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { LaborEntry } from '../types/schemas';
import { Clock } from 'lucide-react';
import { useLaborCost } from '../hooks/useLaborCost';
import { TimesheetSummaryCards } from './Timesheet/TimesheetSummaryCards';
import { TimesheetTable } from './Timesheet/TimesheetTable';
import { TimesheetRoleBreakdown } from './Timesheet/TimesheetRoleBreakdown';
import { TimesheetRollupModal, WorkOrderRollupData } from './Timesheet/TimesheetRollupModal';

export const TimesheetTab: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { laborEntries, laborRateCategories, invoices } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);

  // Shared calculation context: role precedence (override → crew → rate) and costs
  // with employee position overrides applied.
  const { ctx, getBreakdown } = useLaborCost();
  const woMap = ctx.woMap;

  const isEmployee = currentUser?.role === 'Employee';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('shift_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedWorkOrderForRollup, setSelectedWorkOrderForRollup] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRoleFilter, filters, pageSize]);

  // Base filtered entries (before local role filter)
  const baseFilteredEntries = useMemo(() => {
    return laborEntries.filter((entry) => {
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

      return (
        entry.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.work_order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        gf.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [laborEntries, woMap, filters, searchQuery]);

  // Filtered entries by role
  const filteredEntries = useMemo(() => {
    if (selectedRoleFilter === 'all') return baseFilteredEntries;
    return baseFilteredEntries.filter((entry) => {
      const roleCat = getBreakdown(entry).role;
      if (selectedRoleFilter === 'unclassified') return roleCat === 'unclassified';
      if (selectedRoleFilter === 'General Foreman' || selectedRoleFilter === 'GForeman') {
        return roleCat === 'General Foreman' || roleCat === 'GForeman';
      }
      return roleCat.toLowerCase() === selectedRoleFilter.toLowerCase();
    });
  }, [baseFilteredEntries, selectedRoleFilter, getBreakdown]);

  // Sorted entries (calculated columns sort by their effective, override-aware values)
  const sortedEntries = useMemo(() => {
    const calculatedSortValue = (e: LaborEntry): string | number | undefined => {
      const b = getBreakdown(e);
      switch (sortField) {
        case 'general_foreman':
          return woMap.get(String(e.work_order_number || '').trim())?.general_foreman || '';
        case 'foreman':
          return woMap.get(String(e.work_order_number || '').trim())?.foreman || '';
        case 'role_category':
          return b.role;
        case 'hourly_rate':
          return b.hourlyRate;
        case 'ot_hours':
          return b.otHours;
        case 'ot_cost':
          return b.otCost;
        case 'dt_hours':
          return b.dtHours;
        case 'dt_cost':
          return b.dtCost;
        case 'benefits_cost':
          return b.benefitsCost;
        case 'line_labor_cost':
          return b.totalCost;
        default: {
          const raw = e[sortField as keyof LaborEntry];
          return typeof raw === 'string' || typeof raw === 'number' ? raw : undefined;
        }
      }
    };

    return [...filteredEntries].sort((a, b) => {
      let aVal = calculatedSortValue(a) ?? '';
      let bVal = calculatedSortValue(b) ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortOrder, woMap, getBreakdown]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedEntries.length);
  const paginatedEntries = useMemo(() => {
    return sortedEntries.slice(startIndex, endIndex);
  }, [sortedEntries, startIndex, endIndex]);

  // Overall KPIs
  const totalHours = useMemo(() => filteredEntries.reduce((sum, e) => sum + e.shift_hours, 0), [filteredEntries]);
  const totalLaborCost = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + getBreakdown(e).totalCost, 0),
    [filteredEntries, getBreakdown]
  );
  const uniqueHeadcount = useMemo(() => new Set(filteredEntries.map((e) => e.employee_name.trim())).size, [filteredEntries]);

  const baseTotalHours = useMemo(() => baseFilteredEntries.reduce((sum, e) => sum + e.shift_hours, 0), [baseFilteredEntries]);
  const baseTotalHeadcount = useMemo(() => new Set(baseFilteredEntries.map((e) => e.employee_name.trim())).size, [baseFilteredEntries]);

  // Role Breakdown
  const roleBreakdown = useMemo(() => {
    const map: Record<string, { count: number; hours: number; cost: number; employees: Set<string> }> = {
      'General Foreman': { count: 0, hours: 0, cost: 0, employees: new Set() },
      Foreman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Journeyman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      'Pole Truck Driver': { count: 0, hours: 0, cost: 0, employees: new Set() },
      Apprentice: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Groundman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      'Pole Truck Helper': { count: 0, hours: 0, cost: 0, employees: new Set() },
      unclassified: { count: 0, hours: 0, cost: 0, employees: new Set() },
    };

    baseFilteredEntries.forEach((entry) => {
      const b = getBreakdown(entry);
      const cat = b.role === 'GForeman' ? 'General Foreman' : b.role;
      if (!map[cat]) {
        map[cat] = { count: 0, hours: 0, cost: 0, employees: new Set() };
      }
      map[cat].count += 1;
      map[cat].hours += entry.shift_hours;
      map[cat].cost += b.totalCost;
      if (entry.employee_name) {
        map[cat].employees.add(entry.employee_name.trim());
      }
    });

    return map;
  }, [baseFilteredEntries, getBreakdown]);

  // Unclassified Rates Summary
  const unclassifiedEntries = useMemo(
    () => baseFilteredEntries.filter((e) => getBreakdown(e).role === 'unclassified'),
    [baseFilteredEntries, getBreakdown]
  );
  const unclassifiedCount = unclassifiedEntries.length;
  const unclassifiedHours = unclassifiedEntries.reduce((sum, e) => sum + e.shift_hours, 0);

  const unclassifiedRateDistribution = useMemo(() => {
    const dist: Record<number, { count: number; hours: number; cost: number; employees: Set<string> }> = {};
    unclassifiedEntries.forEach((e) => {
      const b = getBreakdown(e);
      if (!dist[b.hourlyRate]) {
        dist[b.hourlyRate] = { count: 0, hours: 0, cost: 0, employees: new Set() };
      }
      dist[b.hourlyRate].count += 1;
      dist[b.hourlyRate].hours += e.shift_hours;
      dist[b.hourlyRate].cost += b.totalCost;
      if (e.employee_name) {
        dist[b.hourlyRate].employees.add(e.employee_name.trim());
      }
    });
    return Object.entries(dist).map(([rateStr, stats]) => ({
      rate: parseFloat(rateStr),
      ...stats,
    }));
  }, [unclassifiedEntries, getBreakdown]);

  // Rollup details for selected work order
  const activeWorkOrderRollup: WorkOrderRollupData | null = useMemo(() => {
    if (!selectedWorkOrderForRollup) return null;
    const woKey = String(selectedWorkOrderForRollup).trim();
    const wo = woMap.get(woKey);
    const woInvoices = invoices.filter((i) => String(i.work_order_number).trim() === woKey);
    const woEntries = laborEntries.filter((e) => String(e.work_order_number).trim() === woKey);
    const woHours = woEntries.reduce((sum, e) => sum + e.shift_hours, 0);
    const woCost = woEntries.reduce((sum, e) => sum + getBreakdown(e).totalCost, 0);

    const invoiceTotal = woInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const grossMargin = invoiceTotal - woCost;
    const marginPct = invoiceTotal > 0 ? (grossMargin / invoiceTotal) * 100 : 0;

    return {
      workOrderNumber: selectedWorkOrderForRollup,
      status: wo?.status || 'Active',
      crewLeader: wo?.foreman || wo?.general_foreman || 'Unassigned Crew',
      generalForeman: wo?.general_foreman || 'N/A',
      area: wo?.area || 'Houston Metro',
      address: wo?.address || 'N/A',
      invoiceTotal,
      laborCost: woCost,
      laborHours: woHours,
      grossMargin,
      marginPct,
      entries: woEntries,
    };
  }, [selectedWorkOrderForRollup, laborEntries, invoices, woMap, getBreakdown]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none font-sans">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight my-0">Connecteam Labor & Timesheets</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Role classification with standard rates and crew assignments. Labor Cost is calculated as Regular Cost + OT (1.5x) + DT (2.0x) + Benefits.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <TimesheetSummaryCards
        totalHours={totalHours}
        totalLaborCost={totalLaborCost}
        uniqueHeadcount={uniqueHeadcount}
        unclassifiedCount={unclassifiedCount}
        unclassifiedHours={unclassifiedHours}
        totalEntriesCount={laborEntries.length}
        isEmployee={isEmployee}
      />

      {/* Shift Log Table */}
      <TimesheetTable
        entries={filteredEntries}
        paginatedEntries={paginatedEntries}
        totalFilteredCount={filteredEntries.length}
        uniqueHeadcount={uniqueHeadcount}
        woMap={woMap}
        getBreakdown={getBreakdown}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedRoleFilter={selectedRoleFilter}
        onSelectRoleFilter={setSelectedRoleFilter}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        currentPage={safeCurrentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        onSelectWorkOrderForRollup={setSelectedWorkOrderForRollup}
        isEmployee={isEmployee}
      />

      {/* Role Breakdown Distribution & Unclassified Rates */}
      <TimesheetRoleBreakdown
        roleBreakdown={roleBreakdown}
        baseTotalHours={baseTotalHours}
        baseTotalHeadcount={baseTotalHeadcount}
        laborRateCategories={laborRateCategories}
        selectedRoleFilter={selectedRoleFilter}
        onSelectRoleFilter={setSelectedRoleFilter}
        unclassifiedRateDistribution={unclassifiedRateDistribution}
        isEmployee={isEmployee}
      />

      {/* Per-Work-Order Labor Rollup Modal */}
      <TimesheetRollupModal
        rollupData={activeWorkOrderRollup}
        getBreakdown={getBreakdown}
        isEmployee={isEmployee}
        onClose={() => setSelectedWorkOrderForRollup(null)}
      />
    </div>
  );
};

export default TimesheetTab;
