import React from 'react';
import { motion } from 'framer-motion';
import { Clock, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatHours } from '../../utils/helpers';

interface TimesheetSummaryCardsProps {
  totalHours: number;
  totalLaborCost: number;
  uniqueHeadcount: number;
  unclassifiedCount: number;
  unclassifiedHours: number;
  totalEntriesCount: number;
  isEmployee: boolean;
}

export const TimesheetSummaryCards: React.FC<TimesheetSummaryCardsProps> = ({
  totalHours,
  totalLaborCost,
  uniqueHeadcount,
  unclassifiedCount,
  unclassifiedHours,
  totalEntriesCount,
  isEmployee,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Hours */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Total Hours</p>
          <Clock className="w-4 h-4 text-blue-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono">{formatHours(totalHours)}</h1>
        <p className="text-xs text-slate-500 font-medium">
          <span className="font-semibold text-slate-700">{totalEntriesCount}</span> recorded shift entries
        </p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className="bg-blue-600 h-full rounded-full" style={{ width: '100%' }} />
        </div>
      </motion.div>

      {/* Total Labor Cost */}
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
        <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono text-emerald-600">
          {isEmployee ? '***' : formatCurrency(totalLaborCost)}
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Regular + <span className="font-semibold text-amber-600">OT (1.5x)</span> + <span className="font-semibold text-orange-600">DT (2.0x)</span> + Benefits applied
        </p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }} />
        </div>
      </motion.div>

      {/* Active Workforce */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Active Workforce</p>
          <Users className="w-4 h-4 text-indigo-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono text-indigo-600">
          {uniqueHeadcount} <span className="text-sm font-semibold text-slate-500 font-sans">Workers</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          <span className="font-semibold text-slate-700">{uniqueHeadcount}</span> distinct employees logged
        </p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className="bg-indigo-600 h-full rounded-full" style={{ width: '100%' }} />
        </div>
      </motion.div>

      {/* Unclassified Entries */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Unclassified Entries</p>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono text-amber-600">
          {unclassifiedCount}{' '}
          <span className="text-xs text-slate-400 font-sans font-normal">
            ({totalEntriesCount > 0 ? ((unclassifiedCount / totalEntriesCount) * 100).toFixed(0) : 0}%)
          </span>
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          <span className="font-semibold text-amber-600">{formatHours(unclassifiedHours)}</span> custom/variable rate
        </p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${totalEntriesCount > 0 ? Math.min(100, (unclassifiedCount / totalEntriesCount) * 100) : 0}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
};
export default TimesheetSummaryCards;
