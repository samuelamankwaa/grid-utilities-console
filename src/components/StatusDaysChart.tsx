import React, { useMemo } from 'react';
import { getWorkOrderReportingDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const COLOR_MAP: Record<string, string> = {
  'Work Pending': '#fbbf24',     // Amber 400
  'Field Check': '#93c5fd',      // Blue 300
  'Field Complete': '#3b82f6',   // Blue 500
  'CTCC Completed': '#6366f1',   // Indigo 500
  'Ready to Bill': '#10b981',    // Emerald 500
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Reverse payload to match visual stack order (top to bottom)
    const sortedPayload = [...payload].reverse();
    return React.createElement('div', { className: 'bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-100 flex flex-col gap-2.5 min-w-[180px] z-50' },
      React.createElement('p', { className: 'text-xs font-bold text-slate-400 uppercase tracking-wider' }, `Lapsed: ${label} Days`),
      React.createElement('div', { className: 'flex flex-col gap-2' },
        sortedPayload.map((entry: any, index: number) => {
          if (!entry.value) return null;
          return React.createElement('div', { key: index, className: 'flex items-center justify-between gap-4 text-xs' },
            React.createElement('div', { className: 'flex items-center gap-2' },
              React.createElement('span', { className: 'w-2 h-2 rounded-full flex-shrink-0', style: { backgroundColor: entry.fill } }),
              React.createElement('span', { className: 'text-slate-600 font-medium' }, entry.name)
            ),
            React.createElement('span', { className: 'text-slate-900 font-bold' }, entry.value)
          );
        })
      )
    );
  }
  return null;
};

export const StatusDaysChart: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders } = useSelector((state: RootState) => state.db);

  const data = useMemo(() => {
    const buckets: Record<string, { name: string; [key: string]: any }> = {
      '1-30': { name: '1-30', 'Work Pending': 0, 'Field Check': 0, 'Field Complete': 0, 'CTCC Completed': 0, 'Ready to Bill': 0 },
      '31-60': { name: '31-60', 'Work Pending': 0, 'Field Check': 0, 'Field Complete': 0, 'CTCC Completed': 0, 'Ready to Bill': 0 },
      '61-90': { name: '61-90', 'Work Pending': 0, 'Field Check': 0, 'Field Complete': 0, 'CTCC Completed': 0, 'Ready to Bill': 0 },
      '91-180': { name: '91-180', 'Work Pending': 0, 'Field Check': 0, 'Field Complete': 0, 'CTCC Completed': 0, 'Ready to Bill': 0 },
      '180+': { name: '180+', 'Work Pending': 0, 'Field Check': 0, 'Field Complete': 0, 'CTCC Completed': 0, 'Ready to Bill': 0 },
    };

    const today = new Date('2026-08-25');

    workOrders.forEach(wo => {
      if (filters.generalForeman !== 'All crews' && wo.general_foreman !== filters.generalForeman) return;
      if (filters.foreman.length > 0 && !filters.foreman.includes(wo.foreman)) return;
      if (filters.workOrderNumbers && filters.workOrderNumbers.length > 0 && !filters.workOrderNumbers.includes(wo.work_order_number)) return;
      if (filters.area !== 'All areas' && wo.area !== filters.area) return;
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

      if (wo.locate_renewal_date) {
        const renewal = new Date(wo.locate_renewal_date);
        if (renewal < today) {
          const diffTime = Math.abs(today.getTime() - renewal.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let bucketKey: string = '180+';
          if (diffDays <= 30) bucketKey = '1-30';
          else if (diffDays <= 60) bucketKey = '31-60';
          else if (diffDays <= 90) bucketKey = '61-90';
          else if (diffDays <= 180) bucketKey = '91-180';

          const status = wo.status || 'Work Pending';
          if (buckets[bucketKey] && buckets[bucketKey][status] !== undefined) {
            buckets[bucketKey][status]++;
          }
        }
      }
    });

    return Object.values(buckets);
  }, [workOrders, filters]);

  return (
    React.createElement(motion.div, {
      initial: { opacity: 0, y: 15 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4 },
      whileHover: { y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)' },
      className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] transition-shadow duration-300'
    },
      React.createElement('div', { className: 'flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4' },
        React.createElement('div', null,
          React.createElement('h2', { className: 'text-lg font-bold text-slate-800' }, 'Status categories by days'),
          React.createElement('p', { className: 'text-xs text-slate-400 mt-0.5 max-w-xl' }, 'Count of work orders whose 811 locate renewal has lapsed, segmented by current status and time elapsed.')
        ),
        // Custom Legend to prevent overlap and styling issues
        React.createElement('div', { className: 'flex flex-wrap items-center gap-3.5 bg-slate-50 border border-slate-100 rounded-lg p-2 px-3 self-start md:self-auto' },
          Object.entries(COLOR_MAP).map(([status, color]) => (
            React.createElement('div', { key: status, className: 'flex items-center gap-1.5 text-[11px] font-semibold text-slate-500' },
              React.createElement('span', { className: 'w-2 h-2 rounded-full', style: { backgroundColor: color } }),
              React.createElement('span', null, status)
            )
          ))
        )
      ),
      React.createElement('div', { className: 'h-72 mt-2' },
        React.createElement(ResponsiveContainer, { width: '100%', height: '100%' } as any,
          React.createElement(BarChart, { data: data, margin: { top: 10, right: 10, left: -10, bottom: 5 }, barGap: 0 },
            React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#f1f5f9', vertical: false }),
            React.createElement(XAxis, { dataKey: 'name', stroke: '#94a3b8', style: { fontSize: 11, fontWeight: 500 } }),
            React.createElement(YAxis, { stroke: '#94a3b8', style: { fontSize: 11, fontWeight: 500 } }),
            React.createElement(Tooltip, { content: React.createElement(CustomTooltip), wrapperStyle: { zIndex: 100 } }),
            React.createElement(Bar, { dataKey: 'Work Pending', stackId: 'a', fill: COLOR_MAP['Work Pending'] }),
            React.createElement(Bar, { dataKey: 'Field Check', stackId: 'a', fill: COLOR_MAP['Field Check'] }),
            React.createElement(Bar, { dataKey: 'Field Complete', stackId: 'a', fill: COLOR_MAP['Field Complete'] }),
            React.createElement(Bar, { dataKey: 'CTCC Completed', stackId: 'a', fill: COLOR_MAP['CTCC Completed'] }),
            React.createElement(Bar, { dataKey: 'Ready to Bill', stackId: 'a', fill: COLOR_MAP['Ready to Bill'], radius: [4, 4, 0, 0] }) // Only top bar gets rounded corners
          )
        )
      )
    )
  );
};
