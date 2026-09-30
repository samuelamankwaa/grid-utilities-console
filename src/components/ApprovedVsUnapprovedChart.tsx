import React, { useMemo } from 'react';
import { getWorkOrderReportingDate, getInvoiceDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const COLOR_MAP: Record<string, string> = {
  Approved: '#3b82f6',   // Blue 500
  Unapproved: '#f43f5e', // Rose 500
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload].reverse();
    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
    return React.createElement('div', { className: 'bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-100 flex flex-col gap-2.5 min-w-[200px] z-50' },
      React.createElement('div', { className: 'flex justify-between items-center border-b border-slate-100 pb-1.5' },
        React.createElement('p', { className: 'text-xs font-bold text-slate-400 uppercase tracking-wider' }, label),
        React.createElement('p', { className: 'text-xs font-extrabold text-slate-800' }, 'Total: $' + Math.round(total).toLocaleString())
      ),
      React.createElement('div', { className: 'flex flex-col gap-2' },
        sortedPayload.map((entry: any, index: number) => {
          if (!entry.value) return null;
          return React.createElement('div', { key: index, className: 'flex items-center justify-between gap-4 text-xs' },
            React.createElement('div', { className: 'flex items-center gap-2' },
              React.createElement('span', { className: 'w-2 h-2 rounded-full flex-shrink-0', style: { backgroundColor: entry.fill } }),
              React.createElement('span', { className: 'text-slate-600 font-medium' }, entry.name)
            ),
            React.createElement('span', { className: 'text-slate-900 font-bold' }, '$' + Math.round(entry.value).toLocaleString())
          );
        })
      )
    );
  }
  return null;
};

export const ApprovedVsUnapprovedChart: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices } = useSelector((state: RootState) => state.db);

  const data = useMemo(() => {
    const woNumbers = new Set(workOrders.filter(w => {
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
    }).map(w => w.work_order_number));

    const monthMap: Record<string, { month: string; Approved: number; Unapproved: number }> = {};

    invoices.forEach(inv => {
      if (!woNumbers.has(inv.work_order_number || '')) return;
      if (filters.status !== 'All statuses' && inv.status !== filters.status) return;

      const invDate = getInvoiceDate(inv);
      if (invDate) {
        if (filters.startDate && invDate < filters.startDate) return;
        if (filters.endDate && invDate > filters.endDate) return;

        const dateObj = new Date(invDate + 'T00:00:00');
        const mName = dateObj.toLocaleString('default', { month: 'short' });
        const yName = dateObj.getFullYear();
        const key = mName + ' ' + yName.toString().slice(-2);
        
        if (!monthMap[key]) {
          monthMap[key] = { month: key, Approved: 0, Unapproved: 0 };
        }
        if (inv.status === 'Approved') {
          monthMap[key].Approved += inv.total;
        } else {
          monthMap[key].Unapproved += inv.total;
        }
      }
    });

    const monthOrder = [
      'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26'
    ];

    // Only display the last 4 months
    return monthOrder.slice(-4).map(m => monthMap[m] || { month: m, Approved: 0, Unapproved: 0 });
  }, [workOrders, invoices, filters]);

  const formatYAxis = (tick: number) => {
    return '$' + Math.round(tick / 1000) + 'k';
  };

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
          React.createElement('h2', { className: 'text-lg font-bold text-slate-800' }, 'Approved vs Unapproved'),
          React.createElement('p', { className: 'text-xs text-slate-400 mt-0.5 max-w-xl' }, 'Invoice value by month created. August is a partial month (closes on the 15th).')
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
          React.createElement(BarChart, { data: data, margin: { top: 10, right: 10, left: -10, bottom: 5 } },
            React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#f1f5f9', vertical: false }),
            React.createElement(XAxis, { dataKey: 'month', stroke: '#94a3b8', style: { fontSize: 11, fontWeight: 500 } }),
            React.createElement(YAxis, { tickFormatter: formatYAxis, stroke: '#94a3b8', style: { fontSize: 11, fontWeight: 500 } }),
            React.createElement(Tooltip, { content: React.createElement(CustomTooltip), wrapperStyle: { zIndex: 100 } }),
            React.createElement(Bar, { dataKey: 'Approved', stackId: 'a', fill: COLOR_MAP.Approved }),
            React.createElement(Bar, { dataKey: 'Unapproved', stackId: 'a', fill: COLOR_MAP.Unapproved, radius: [4, 4, 0, 0] }) // Only top bar gets rounded corners
          )
        )
      )
    )
  );
};
