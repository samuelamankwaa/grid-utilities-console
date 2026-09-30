import React, { useMemo } from 'react';
import { getWorkOrderReportingDate, getInvoiceDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const margin = payload[0].value;
    const isPositive = margin >= 0;
    return React.createElement('div', { className: 'bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-100 flex flex-col gap-1 min-w-[150px] z-50' },
      React.createElement('p', { className: 'text-[10px] font-bold text-slate-400 uppercase tracking-wider' }, `Date: ${label}`),
      React.createElement('div', { className: 'flex items-center justify-between gap-4 mt-0.5' },
        React.createElement('span', { className: 'text-xs text-slate-600 font-medium' }, 'Margin'),
        React.createElement('span', { 
          className: 'text-xs font-extrabold ' + (isPositive ? 'text-emerald-600' : 'text-rose-600') 
        }, (isPositive ? '' : '-') + '$' + Math.abs(Math.round(margin)).toLocaleString())
      )
    );
  }
  return null;
};

export const ProfitMarginOverTime: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices, dailyExpenseRate } = useSelector((state: RootState) => state.db);

  const data = useMemo(() => {
    const woFiltered = workOrders.filter(w => {
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
    const woNumbers = new Set(woFiltered.map(w => w.work_order_number));

    // Determine dynamic chart date range based on active filters
    let startD: Date;
    let endD: Date;

    if (filters.startDate && filters.endDate) {
      startD = new Date(filters.startDate + 'T00:00:00');
      endD = new Date(filters.endDate + 'T00:00:00');
    } else if (filters.startDate) {
      startD = new Date(filters.startDate + 'T00:00:00');
      endD = new Date(Math.max(startD.getTime() + 30 * 86400 * 1000, new Date('2026-08-18').getTime()));
    } else if (filters.endDate) {
      endD = new Date(filters.endDate + 'T00:00:00');
      startD = new Date(endD.getTime() - 59 * 86400 * 1000);
    } else {
      endD = new Date('2026-08-18T00:00:00');
      startD = new Date(endD.getTime() - 59 * 86400 * 1000);
    }

    if (startD > endD) {
      const temp = startD;
      startD = endD;
      endD = temp;
    }

    const dailyData: Record<string, { dateStr: string; dateObj: Date; revenue: number; bookedForemen: Set<string>; margin: number }> = {};
    const curr = new Date(startD);
    const maxDays = 180;
    let daysCount = 0;
    while (curr <= endD && daysCount < maxDays) {
      const str = curr.toISOString().split('T')[0];
      dailyData[str] = {
        dateStr: str,
        dateObj: new Date(curr),
        revenue: 0,
        bookedForemen: new Set<string>(),
        margin: 0,
      };
      curr.setDate(curr.getDate() + 1);
      daysCount++;
    }

    invoices.forEach(inv => {
       if (!woNumbers.has(inv.work_order_number || '')) return;
       if (filters.status !== 'All statuses' && inv.status !== filters.status) return;

       const invDate = getInvoiceDate(inv);
       if (invDate && dailyData[invDate]) {
         const entry = dailyData[invDate];
         entry.revenue += inv.total;
         const wo = woFiltered.find(w => w.work_order_number === inv.work_order_number);
         if (wo && wo.foreman) {
           entry.bookedForemen.add(wo.foreman);
         }
       }
     });

    return Object.values(dailyData).map(day => {
      const expense = day.bookedForemen.size * dailyExpenseRate;
      const margin = day.revenue - expense;
      const dateLabel = (day.dateObj.getMonth() + 1) + '/' + day.dateObj.getDate();
      return {
        name: dateLabel,
        margin,
        fill: margin >= 0 ? '#10b981' : '#f43f5e', // Emerald 500 vs Rose 500
      };
    });
  }, [workOrders, invoices, dailyExpenseRate, filters]);

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
          React.createElement('h2', { className: 'text-lg font-bold text-slate-800' }, 'Profit margin over time'),
          React.createElement('p', { className: 'text-xs text-slate-400 mt-0.5 max-w-xl' }, 'Daily profit margin for the last 60 days (invoiced value minus base expenses).')
        ),
        // Custom Legend
        React.createElement('div', { className: 'flex flex-wrap items-center gap-3.5 bg-slate-50 border border-slate-100 rounded-lg p-2 px-3 self-start md:self-auto' },
          React.createElement('div', { className: 'flex items-center gap-1.5 text-[11px] font-semibold text-slate-500' },
            React.createElement('span', { className: 'w-2.5 h-1 bg-emerald-500 rounded' }),
            React.createElement('span', null, 'Positive Margin')
          ),
          React.createElement('div', { className: 'flex items-center gap-1.5 text-[11px] font-semibold text-slate-500' },
            React.createElement('span', { className: 'w-2.5 h-1 bg-rose-500 rounded' }),
            React.createElement('span', null, 'Negative Margin')
          )
        )
      ),
      React.createElement('div', { className: 'h-72 mt-2' },
        React.createElement(ResponsiveContainer, { width: '100%', height: '100%' } as any,
          React.createElement(BarChart, { data: data, margin: { top: 10, right: 10, left: -10, bottom: 5 } },
            React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#f1f5f9', vertical: false }),
            React.createElement(XAxis, { dataKey: 'name', stroke: '#94a3b8', style: { fontSize: 9, fontWeight: 500 } }),
            React.createElement(YAxis, { tickFormatter: formatYAxis, stroke: '#94a3b8', style: { fontSize: 11, fontWeight: 500 } }),
            React.createElement(Tooltip, { content: React.createElement(CustomTooltip), wrapperStyle: { zIndex: 100 } }),
            React.createElement(ReferenceLine, { y: 0, stroke: '#cbd5e1', strokeWidth: 1.5 }),
            React.createElement(Bar, { dataKey: 'margin', radius: 2 })
          )
        )
      )
    )
  );
};
