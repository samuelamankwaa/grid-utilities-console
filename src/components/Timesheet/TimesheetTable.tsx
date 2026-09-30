import React from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { LaborEntry, LaborRateCategory, WorkOrder } from '../../types/schemas';
import { formatCurrency, formatHours } from '../../utils/helpers';
import {
  getEntryOtHours,
  getEntryOtCost,
  getEntryDtHours,
  getEntryDtCost,
  getEntryBenefitsCost,
  getEntryLaborCost,
  getEntryRole,
  getRoleDisplayName,
  getRoleCategoryBadge,
} from './timesheetHelpers';

interface TimesheetTableProps {
  entries: LaborEntry[];
  paginatedEntries: LaborEntry[];
  totalFilteredCount: number;
  uniqueHeadcount: number;
  woMap: Map<string, WorkOrder>;
  laborRateCategories: LaborRateCategory[];
  gfNamesSet: Set<string>;
  foremanNamesSet: Set<string>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedRoleFilter: string;
  onSelectRoleFilter: (role: string) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelectWorkOrderForRollup: (woNumber: string) => void;
  isEmployee: boolean;
}

export const TimesheetTable: React.FC<TimesheetTableProps> = ({
  paginatedEntries,
  totalFilteredCount,
  uniqueHeadcount,
  woMap,
  laborRateCategories,
  gfNamesSet,
  foremanNamesSet,
  searchQuery,
  onSearchChange,
  selectedRoleFilter,
  onSelectRoleFilter,
  sortField,
  onSort,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onSelectWorkOrderForRollup,
  isEmployee,
}) => {
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);

  const getSortIconClass = (field: string) =>
    sortField === field ? 'w-3 h-3 text-blue-600 font-bold' : 'w-3 h-3 text-slate-400';

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 select-none overflow-x-auto font-sans">
      {/* Table Controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee, work order #, general foreman..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold">Role Filter:</label>
            <select
              value={selectedRoleFilter}
              onChange={(e) => onSelectRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:bg-white focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value="all">All Roles & Categories</option>
              <option value="General Foreman">General Foreman</option>
              <option value="Foreman">Foreman</option>
              <option value="Journeyman">Journeyman Lineman</option>
              <option value="Pole Truck Driver">Pole Truck Driver</option>
              <option value="Apprentice">Apprentice Lineman</option>
              <option value="Groundman">Groundman</option>
              <option value="Pole Truck Helper">Pole Truck Helper</option>
              <option value="unclassified">Unclassified Rates Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <label className="text-[11px] font-semibold text-slate-400">Rows:</label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:bg-white focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Role Filter Banner */}
      {selectedRoleFilter !== 'all' && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-4 text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span>
              Filtered by role:{' '}
              <strong className="text-blue-950 font-bold">{getRoleDisplayName(selectedRoleFilter)}</strong> ({' '}
              {totalFilteredCount} shift entries · {uniqueHeadcount} {uniqueHeadcount === 1 ? 'worker' : 'workers'} )
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectRoleFilter('all')}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear Role Filter
          </button>
        </div>
      )}

      {/* Shift Entries Table */}
      <table className="w-full border-collapse text-left text-xs text-slate-600 min-w-[900px]">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
          <tr>
            <th
              className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors whitespace-nowrap"
              onClick={() => onSort('shift_date')}
            >
              <div className="flex items-center gap-1.5">
                <span>Shift Date (Start - End)</span>
                <ArrowUpDown className={getSortIconClass('shift_date')} />
              </div>
            </th>
            <th
              className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('employee_name')}
            >
              <div className="flex items-center gap-1.5">
                <span>Employee</span>
                <ArrowUpDown className={getSortIconClass('employee_name')} />
              </div>
            </th>
            <th
              className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('work_order_number')}
            >
              <div className="flex items-center gap-1.5">
                <span>Work Order</span>
                <ArrowUpDown className={getSortIconClass('work_order_number')} />
              </div>
            </th>
            <th
              className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('general_foreman')}
            >
              <div className="flex items-center gap-1.5">
                <span>General Foreman</span>
                <ArrowUpDown className={getSortIconClass('general_foreman')} />
              </div>
            </th>
            <th
              className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('foreman')}
            >
              <div className="flex items-center gap-1.5">
                <span>Foreman</span>
                <ArrowUpDown className={getSortIconClass('foreman')} />
              </div>
            </th>
            <th
              className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('role_category')}
            >
              <div className="flex items-center gap-1.5">
                <span>Role Category</span>
                <ArrowUpDown className={getSortIconClass('role_category')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('shift_hours')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Hours</span>
                <ArrowUpDown className={getSortIconClass('shift_hours')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('hourly_rate')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Hourly Rate</span>
                <ArrowUpDown className={getSortIconClass('hourly_rate')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('ot_hours')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>OT Hours</span>
                <ArrowUpDown className={getSortIconClass('ot_hours')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('ot_cost')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>OT Cost</span>
                <ArrowUpDown className={getSortIconClass('ot_cost')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('dt_hours')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>DT Hours</span>
                <ArrowUpDown className={getSortIconClass('dt_hours')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('dt_cost')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>DT Cost</span>
                <ArrowUpDown className={getSortIconClass('dt_cost')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('benefits_cost')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Benefits</span>
                <ArrowUpDown className={getSortIconClass('benefits_cost')} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
              onClick={() => onSort('line_labor_cost')}
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Labor Cost</span>
                <ArrowUpDown className={getSortIconClass('line_labor_cost')} />
              </div>
            </th>
            <th className="py-3 px-4 text-center">WO Rollup</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedEntries.map((entry) => {
            const wo = woMap.get(String(entry.work_order_number || '').trim());
            const role = getEntryRole(entry, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
            const otH = getEntryOtHours(entry);
            const otCost = getEntryOtCost(entry);
            const dtH = getEntryDtHours(entry);
            const dtCost = getEntryDtCost(entry);
            const benCost = getEntryBenefitsCost(entry, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
            const laborCost = getEntryLaborCost(entry, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);

            return (
              <tr
                key={entry.id || `${entry.work_order_number}-${entry.shift_date}-${entry.employee_name}`}
                className="hover:bg-slate-50/80 transition-colors"
              >
                <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                  {entry.start_date && entry.end_date && entry.start_date !== entry.end_date ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{entry.start_date}</span>
                        <span className="text-slate-400 font-normal">→</span>
                        <span>{entry.end_date}</span>
                      </div>
                      <span className="text-[10px] text-indigo-600 font-sans font-medium">Overnight shift</span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{entry.start_date || entry.shift_date}</span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        {entry.end_date ? `End: ${entry.end_date}` : 'Single-day'}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">{entry.employee_name}</td>
                <td className="py-3 px-4 font-mono font-semibold text-blue-600 whitespace-nowrap">
                  {entry.work_order_number ? (
                    `#${entry.work_order_number}`
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </td>
                <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                  {wo?.general_foreman || <span className="text-slate-400 italic">-</span>}
                </td>
                <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                  {wo?.foreman || <span className="text-slate-400 italic">-</span>}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectRoleFilter(selectedRoleFilter.toLowerCase() === role.toLowerCase() ? 'all' : role)
                    }
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border transition-all hover:scale-105 cursor-pointer ${getRoleCategoryBadge(
                      role
                    )}`}
                    title={`Filter by ${getRoleDisplayName(role)}`}
                  >
                    {role}
                  </button>
                </td>
                <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                  {formatHours(entry.shift_hours)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-500">
                  {isEmployee ? '***' : formatCurrency(entry.hourly_rate)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-amber-600 font-semibold">
                  {formatHours(otH)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-amber-700 font-semibold">
                  {isEmployee ? '***' : formatCurrency(otCost)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-orange-600 font-semibold">
                  {formatHours(dtH)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-orange-700 font-semibold">
                  {isEmployee ? '***' : formatCurrency(dtCost)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-purple-700 font-semibold">
                  {isEmployee ? '***' : formatCurrency(benCost)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                  {isEmployee ? '***' : formatCurrency(laborCost)}
                </td>
                <td className="py-3 px-4 text-center">
                  {entry.work_order_number ? (
                    <button
                      type="button"
                      onClick={() => onSelectWorkOrderForRollup(entry.work_order_number)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="View Work Order Labor Rollup"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}
          {paginatedEntries.length === 0 && (
            <tr>
              <td colSpan={15} className="py-8 px-4 text-center text-slate-400">
                No timesheet entries matched your search criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Bar */}
      <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-3 mt-2 rounded-b-xl">
        <div className="font-medium">
          {totalFilteredCount === 0 ? (
            <span>0 entries</span>
          ) : (
            <span>
              Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{' '}
              <strong className="text-slate-800">{endIndex}</strong> of{' '}
              <strong className="text-slate-800">{totalFilteredCount}</strong> entries
            </span>
          )}
        </div>

        {/* Pagination Navigation */}
        <div className="flex items-center gap-1.5 select-none">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 font-mono text-xs text-slate-700 bg-white border border-slate-200 rounded-lg">
            Page <strong className="text-blue-600">{safeCurrentPage}</strong> of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimesheetTable;
