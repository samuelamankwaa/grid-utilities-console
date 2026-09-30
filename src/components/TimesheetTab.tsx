import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { LaborEntry, WorkOrder } from '../types/schemas';
import { Clock } from 'lucide-react';
import {
  getEntryOtHours,
  getEntryOtCost,
  getEntryDtHours,
  getEntryDtCost,
  getEntryBenefitsCost,
  getEntryLaborCost,
  getEntryRole,
} from './Timesheet/timesheetHelpers';
import { TimesheetSummaryCards } from './Timesheet/TimesheetSummaryCards';
import { TimesheetTable } from './Timesheet/TimesheetTable';
import { TimesheetRoleBreakdown } from './Timesheet/TimesheetRoleBreakdown';
import { TimesheetRollupModal, WorkOrderRollupData } from './Timesheet/TimesheetRollupModal';

export const TimesheetTab: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { laborEntries, laborRateCategories, workOrders, invoices } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);

  const isEmployee = currentUser?.role === 'Employee';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('shift_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedWorkOrderForRollup, setSelectedWorkOrderForRollup] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Fast lookup for parent Work Order details
  const woMap = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    workOrders.forEach((w) => {
      if (w.work_order_number) {
        map.set(String(w.work_order_number).trim(), w);
      }
    });
    return map;
  }, [workOrders]);

  // Company-wide supervisory rosters
  const gfNamesSet = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach((w) => {
      if (w.general_foreman) {
        set.add(w.general_foreman.trim().toLowerCase());
      }
    });
    return set;
  }, [workOrders]);

  const foremanNamesSet = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach((w) => {
      if (w.foreman) {
        set.add(w.foreman.trim().toLowerCase());
      }
    });
    return set;
  }, [workOrders]);

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
      const roleCat = getEntryRole(entry, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
      if (selectedRoleFilter === 'unclassified') return roleCat === 'unclassified';
      if (selectedRoleFilter === 'General Foreman' || selectedRoleFilter === 'GForeman') {
        return roleCat === 'General Foreman' || roleCat === 'GForeman';
      }
      return roleCat.toLowerCase() === selectedRoleFilter.toLowerCase();
    });
  }, [baseFilteredEntries, selectedRoleFilter, woMap, laborRateCategories, gfNamesSet, foremanNamesSet]);

  // Sorted entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let aVal: any = a[sortField as keyof LaborEntry];
      let bVal: any = b[sortField as keyof LaborEntry];

      if (sortField === 'general_foreman') {
        aVal = woMap.get(String(a.work_order_number || '').trim())?.general_foreman || '';
        bVal = woMap.get(String(b.work_order_number || '').trim())?.general_foreman || '';
      } else if (sortField === 'foreman') {
        aVal = woMap.get(String(a.work_order_number || '').trim())?.foreman || '';
        bVal = woMap.get(String(b.work_order_number || '').trim())?.foreman || '';
      } else if (sortField === 'role_category') {
        aVal = getEntryRole(a, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
        bVal = getEntryRole(b, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
      } else if (sortField === 'ot_hours') {
        aVal = getEntryOtHours(a);
        bVal = getEntryOtHours(b);
      } else if (sortField === 'ot_cost') {
        aVal = getEntryOtCost(a);
        bVal = getEntryOtCost(b);
      } else if (sortField === 'dt_hours') {
        aVal = getEntryDtHours(a);
        bVal = getEntryDtHours(b);
      } else if (sortField === 'dt_cost') {
        aVal = getEntryDtCost(a);
        bVal = getEntryDtCost(b);
      } else if (sortField === 'benefits_cost') {
        aVal = getEntryBenefitsCost(a, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
        bVal = getEntryBenefitsCost(b, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
      } else if (sortField === 'line_labor_cost') {
        aVal = getEntryLaborCost(a, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
        bVal = getEntryLaborCost(b, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortOrder, woMap, laborRateCategories, gfNamesSet, foremanNamesSet]);

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
    () => filteredEntries.reduce((sum, e) => sum + getEntryLaborCost(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet), 0),
    [filteredEntries, woMap, laborRateCategories, gfNamesSet, foremanNamesSet]
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
      let cat = getEntryRole(entry, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
      if (cat === 'GForeman') cat = 'General Foreman';
      if (!map[cat]) {
        map[cat] = { count: 0, hours: 0, cost: 0, employees: new Set() };
      }
      map[cat].count += 1;
      map[cat].hours += entry.shift_hours;
      map[cat].cost += getEntryLaborCost(entry, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
      if (entry.employee_name) {
        map[cat].employees.add(entry.employee_name.trim());
      }
    });

    return map;
  }, [baseFilteredEntries, laborRateCategories, woMap, gfNamesSet, foremanNamesSet]);

  // Unclassified Rates Summary
  const unclassifiedEntries = useMemo(
    () => baseFilteredEntries.filter((e) => getEntryRole(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet) === 'unclassified'),
    [baseFilteredEntries, laborRateCategories, woMap, gfNamesSet, foremanNamesSet]
  );
  const unclassifiedCount = unclassifiedEntries.length;
  const unclassifiedHours = unclassifiedEntries.reduce((sum, e) => sum + e.shift_hours, 0);

  const unclassifiedRateDistribution = useMemo(() => {
    const dist: Record<number, { count: number; hours: number; cost: number; employees: Set<string> }> = {};
    unclassifiedEntries.forEach((e) => {
      if (!dist[e.hourly_rate]) {
        dist[e.hourly_rate] = { count: 0, hours: 0, cost: 0, employees: new Set() };
      }
      dist[e.hourly_rate].count += 1;
      dist[e.hourly_rate].hours += e.shift_hours;
      dist[e.hourly_rate].cost += getEntryLaborCost(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
      if (e.employee_name) {
        dist[e.hourly_rate].employees.add(e.employee_name.trim());
      }
    });
    return Object.entries(dist).map(([rateStr, stats]) => ({
      rate: parseFloat(rateStr),
      ...stats,
    }));
  }, [unclassifiedEntries, woMap, laborRateCategories, gfNamesSet, foremanNamesSet]);

  // Rollup details for selected work order
  const activeWorkOrderRollup: WorkOrderRollupData | null = useMemo(() => {
    if (!selectedWorkOrderForRollup) return null;
    const wo = workOrders.find((w) => String(w.work_order_number).trim() === String(selectedWorkOrderForRollup).trim());
    const woInvoices = invoices.filter((i) => String(i.work_order_number).trim() === String(selectedWorkOrderForRollup).trim());
    const woEntries = laborEntries.filter((e) => String(e.work_order_number).trim() === String(selectedWorkOrderForRollup).trim());
    const woHours = woEntries.reduce((sum, e) => sum + e.shift_hours, 0);
    const woCost = woEntries.reduce(
      (sum, e) => sum + getEntryLaborCost(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet),
      0
    );

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
  }, [selectedWorkOrderForRollup, laborEntries, workOrders, invoices, woMap, laborRateCategories, gfNamesSet, foremanNamesSet]);

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
        laborRateCategories={laborRateCategories}
        gfNamesSet={gfNamesSet}
        foremanNamesSet={foremanNamesSet}
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
        woMap={woMap}
        laborRateCategories={laborRateCategories}
        gfNamesSet={gfNamesSet}
        foremanNamesSet={foremanNamesSet}
        isEmployee={isEmployee}
        onClose={() => setSelectedWorkOrderForRollup(null)}
      />
    </div>
  );
};

export default TimesheetTab;
