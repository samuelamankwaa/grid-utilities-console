import React from 'react';
import { Users, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { LaborRateCategory } from '../../types/schemas';
import { formatCurrency, formatHours } from '../../utils/helpers';
import { getRoleDisplayName, getRoleCategoryBadge } from './timesheetHelpers';

interface RoleStats {
  count: number;
  hours: number;
  cost: number;
  employees: Set<string>;
}

interface TimesheetRoleBreakdownProps {
  roleBreakdown: Record<string, RoleStats>;
  baseTotalHours: number;
  baseTotalHeadcount: number;
  laborRateCategories: LaborRateCategory[];
  selectedRoleFilter: string;
  onSelectRoleFilter: (role: string) => void;
  unclassifiedRateDistribution: {
    rate: number;
    count: number;
    hours: number;
    cost: number;
    employees: Set<string>;
  }[];
  isEmployee: boolean;
}

export const TimesheetRoleBreakdown: React.FC<TimesheetRoleBreakdownProps> = ({
  roleBreakdown,
  baseTotalHours,
  baseTotalHeadcount,
  laborRateCategories,
  selectedRoleFilter,
  onSelectRoleFilter,
  unclassifiedRateDistribution,
  isEmployee,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      {/* Role Breakdown Distribution List */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 my-0">
              Role Category Distribution & Headcount
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any role card to filter shift logs. Percentages reflect total logged hours.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {baseTotalHeadcount} Total Active Workers
            </span>
            {selectedRoleFilter !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectRoleFilter('all')}
                className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer font-medium"
              >
                <X className="w-3.5 h-3.5" /> Show All
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(roleBreakdown).map(([category, stats]) => {
            const headcount = stats.employees.size;
            const pctOfHours = baseTotalHours > 0 ? (stats.hours / baseTotalHours) * 100 : 0;
            const pctOfHeadcount = baseTotalHeadcount > 0 ? (headcount / baseTotalHeadcount) * 100 : 0;
            const refCat = laborRateCategories.find(
              (c) => c.category_name.toLowerCase() === category.toLowerCase()
            );
            const standardRate = refCat ? `$${refCat.standard_rate.toFixed(2)}/hr` : 'Variable / Custom';
            const isSelected = selectedRoleFilter.toLowerCase() === category.toLowerCase();

            return (
              <div
                key={category}
                onClick={() => onSelectRoleFilter(isSelected ? 'all' : category)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/30 shadow-sm'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                  {/* Left: Role Name, Standard Rate & Headcount Tag */}
                  <div className="flex items-center flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getRoleCategoryBadge(category)}`}>
                      {category}
                    </span>
                    <span className="text-slate-800 font-semibold text-xs">{getRoleDisplayName(category)}</span>
                    <span className="text-slate-400 text-[11px]">({standardRate})</span>

                    {/* Headcount Pill */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <Users className="w-3 h-3 text-blue-600" />
                      <span>
                        {headcount} {headcount === 1 ? 'Worker' : 'Workers'}
                        {baseTotalHeadcount > 0 ? ` (${pctOfHeadcount.toFixed(0)}%)` : ''}
                      </span>
                    </span>

                    {isSelected && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Filter
                      </span>
                    )}
                  </div>

                  {/* Right: Shifts, Total Hours, Labor Cost & Share % */}
                  <div className="flex items-center gap-2.5 font-mono text-[11px] text-right">
                    <span className="text-slate-500">{stats.count} {stats.count === 1 ? 'shift' : 'shifts'}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-700 font-semibold">{formatHours(stats.hours)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-emerald-600 font-bold">
                      {isEmployee ? '***' : formatCurrency(stats.cost)}
                    </span>
                    <span className="text-slate-400 w-12 text-right">({pctOfHours.toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden flex">
                  <div
                    className={
                      'h-full rounded-full transition-all duration-500 ' +
                      (category === 'unclassified'
                        ? 'bg-red-500'
                        : category === 'General Foreman' || category === 'GForeman'
                        ? 'bg-purple-600'
                        : category === 'Foreman'
                        ? 'bg-blue-600'
                        : category === 'Journeyman'
                        ? 'bg-indigo-600'
                        : category === 'Pole Truck Driver'
                        ? 'bg-cyan-600'
                        : category === 'Apprentice'
                        ? 'bg-emerald-600'
                        : category === 'Groundman'
                        ? 'bg-amber-500'
                        : 'bg-slate-500')
                    }
                    style={{ width: `${Math.max(pctOfHours, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unclassified Rates Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Unclassified Rate Exception Panel</span>
            </div>
            {selectedRoleFilter === 'unclassified' ? (
              <button
                type="button"
                onClick={() => onSelectRoleFilter('all')}
                className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded cursor-pointer"
              >
                Clear Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectRoleFilter('unclassified')}
                className="text-[10px] font-semibold text-amber-600 hover:text-amber-800 hover:underline cursor-pointer"
              >
                Filter Unclassified
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            These rates do not match standard categories or crew leadership assignments. Actual Connecteam shift rates are preserved in all calculations.
          </p>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {unclassifiedRateDistribution.map((item) => (
              <div
                key={item.rate}
                onClick={() => onSelectRoleFilter('unclassified')}
                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs cursor-pointer transition-colors"
                title="Click to filter by unclassified entries"
              >
                <div>
                  <span className="font-bold text-slate-900 font-mono">{formatCurrency(item.rate)}/hr</span>
                  <div className="text-slate-500 text-[10px] flex items-center gap-1.5 mt-0.5">
                    <span>{item.employees.size} {item.employees.size === 1 ? 'worker' : 'workers'}</span>
                    <span>·</span>
                    <span>{item.count} {item.count === 1 ? 'shift' : 'shifts'}</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-slate-700 font-medium">{formatHours(item.hours)}</div>
                  <div className="text-slate-500 text-[10px]">{isEmployee ? '***' : formatCurrency(item.cost)}</div>
                </div>
              </div>
            ))}
            {unclassifiedRateDistribution.length === 0 && (
              <div className="p-4 text-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All shifts matched standard rate categories</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          Standard tolerance & crew leadership hierarchy applied.
        </div>
      </div>
    </div>
  );
};

export default TimesheetRoleBreakdown;
