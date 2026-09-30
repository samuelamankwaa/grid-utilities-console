import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LaborEntry, LaborRateCategory, WorkOrder } from '../../types/schemas';
import { formatCurrency, formatHours } from '../../utils/helpers';
import {
  getEntryOtHours,
  getEntryDtHours,
  getEntryBenefitsCost,
  getEntryLaborCost,
  getEntryRole,
  getRoleCategoryBadge,
} from './timesheetHelpers';

export interface WorkOrderRollupData {
  workOrderNumber: string;
  status: string;
  crewLeader: string;
  generalForeman: string;
  area: string;
  address: string;
  invoiceTotal: number;
  laborCost: number;
  laborHours: number;
  grossMargin: number;
  marginPct: number;
  entries: LaborEntry[];
}

interface TimesheetRollupModalProps {
  rollupData: WorkOrderRollupData | null;
  woMap: Map<string, WorkOrder>;
  laborRateCategories: LaborRateCategory[];
  gfNamesSet: Set<string>;
  foremanNamesSet: Set<string>;
  isEmployee: boolean;
  onClose: () => void;
}

export const TimesheetRollupModal: React.FC<TimesheetRollupModalProps> = ({
  rollupData,
  woMap,
  laborRateCategories,
  gfNamesSet,
  foremanNamesSet,
  isEmployee,
  onClose,
}) => {
  if (!rollupData) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono my-0">
                  WO #{rollupData.workOrderNumber}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {rollupData.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Crew Leader: {rollupData.crewLeader} · Area: {rollupData.area}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>

          {/* Summary Stats Grid */}
          <div className="p-6 grid grid-cols-3 gap-4 bg-slate-50/50 border-b border-slate-200 text-center">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">TOTAL LABOR HOURS</span>
              <span className="text-base font-bold text-slate-900 font-mono">
                {formatHours(rollupData.laborHours)}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">TOTAL LABOR COST</span>
              <span className="text-base font-bold text-emerald-600 font-mono">
                {isEmployee ? '***' : formatCurrency(rollupData.laborCost)}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">EST. PROFIT MARGIN</span>
              <span
                className={
                  'text-base font-bold font-mono ' +
                  (rollupData.grossMargin >= 0 ? 'text-blue-600' : 'text-red-600')
                }
              >
                {isEmployee ? '***' : `${rollupData.marginPct.toFixed(1)}%`}
              </span>
            </div>
          </div>

          {/* Shifts list for this WO */}
          <div className="p-6 max-h-60 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Contributing Shift Entries ({rollupData.entries.length})
            </h4>
            <div className="space-y-2">
              {rollupData.entries.map((e, idx) => {
                const role = getEntryRole(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
                const otH = getEntryOtHours(e);
                const dtH = getEntryDtHours(e);
                const benCost = getEntryBenefitsCost(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
                const laborCost = getEntryLaborCost(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);

                return (
                  <div
                    key={e.id || idx}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{e.employee_name}</span>
                      <span className="text-slate-500 text-[10px] block mt-0.5">
                        {e.start_date && e.end_date && e.start_date !== e.end_date
                          ? `${e.start_date} → ${e.end_date}`
                          : e.start_date || e.shift_date}{' '}
                        · <span className={`px-1.5 py-0.2 rounded border text-[10px] ${getRoleCategoryBadge(role)}`}>{role}</span>
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-slate-700 font-medium">
                        {formatHours(e.shift_hours)} @ {formatCurrency(e.hourly_rate)}/hr
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {otH > 0 ? `OT: ${formatHours(otH)} · ` : ''}
                        {dtH > 0 ? `DT: ${formatHours(dtH)} · ` : ''}
                        {`Ben: ${formatCurrency(benCost)}`}
                      </div>
                      <div className="text-emerald-600 font-bold">{isEmployee ? '***' : formatCurrency(laborCost)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TimesheetRollupModal;
