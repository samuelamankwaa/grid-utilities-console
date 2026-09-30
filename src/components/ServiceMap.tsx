import React, { useMemo } from 'react';
import { getWorkOrderReportingDate, getInvoiceDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      React.createElement('div', { className: 'bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-100 flex flex-col gap-1 min-w-[150px] z-50' },
        React.createElement('p', { className: 'text-[10px] font-bold text-slate-400 uppercase tracking-wider' }, label),
        React.createElement('p', { className: 'text-xs font-extrabold ' + (val >= 0 ? 'text-green-600' : 'text-red-600') }, 
          'Margin: ' + (val < 0 ? '-' : '') + '$' + Math.abs(Math.round(val)).toLocaleString()
        )
      )
    );
  }
  return null;
};

export const ServiceMap: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices, dailyExpenseRate } = useSelector((state: RootState) => state.db);

  const { gfData, foremanData } = useMemo(() => {
    const GFData: Record<string, { name: string; margin: number }> = {};
    const FData: Record<string, { name: string; gf: string; margin: number }> = {};

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
        if (filters.generalForeman !== 'All crews' && wo.general_foreman !== filters.generalForeman) return;
        if (filters.foreman.length > 0 && !filters.foreman.includes(wo.foreman)) return;
        if (filters.area !== 'All areas' && wo.area !== filters.area) return;

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
      if (filters.generalForeman !== 'All crews' && wo.general_foreman !== filters.generalForeman) return;
      if (filters.foreman.length > 0 && !filters.foreman.includes(wo.foreman)) return;
      if (filters.area !== 'All areas' && wo.area !== filters.area) return;

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

      if (filters.generalForeman !== 'All crews' && gf !== filters.generalForeman) return;
      if (filters.foreman.length > 0 && !filters.foreman.includes(f)) return;
      if (filters.area !== 'All areas' && wo.area !== filters.area) return;

      if (!GFData[gf]) {
        GFData[gf] = { name: gf, margin: 0 };
      }
      if (!FData[f]) {
        FData[f] = { name: f, gf, margin: 0 };
      }
    });

    Object.keys(FData).forEach(f => {
      const node = FData[f];
      const bookedDays = bookedDatesMap[f] ? bookedDatesMap[f].size : 0;
      const rev = revenueMap[f] || 0;
      const exp = bookedDays * dailyExpenseRate;
      const margin = rev - exp;

      node.margin = margin;

      const gfNode = GFData[node.gf];
      if (gfNode) {
        gfNode.margin += margin;
      }
    });

    return {
      gfData: Object.values(GFData).sort((a, b) => b.margin - a.margin),
      foremanData: Object.values(FData).sort((a, b) => b.margin - a.margin),
    };
  }, [workOrders, invoices, dailyExpenseRate, filters]);

  const formatYAxis = (tick: number) => {
    const isNeg = tick < 0;
    const absVal = Math.abs(tick);
    if (absVal >= 1000) {
      return (isNeg ? '-' : '') + '$' + Math.round(absVal / 1000) + 'k';
    }
    return (isNeg ? '-' : '') + '$' + Math.round(absVal);
  };

  return (
    React.createElement(motion.div, {
      initial: { opacity: 0, y: 15 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4 },
      className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 select-none'
    },
      React.createElement('div', { className: 'flex flex-col gap-1' },
        React.createElement('h2', { className: 'text-lg font-semibold text-slate-800 my-0' }, 'Profit Margin Performance'),
        React.createElement('p', { className: 'text-xs text-slate-500' }, 'Comparative profit margins for General Foremen and Foremen based on booked days.')
      ),
      React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
        // General Foreman Chart
        React.createElement('div', { className: 'flex flex-col gap-3' },
          React.createElement('h3', { className: 'text-xs font-bold text-slate-500 uppercase tracking-wider' }, 'General Foreman'),
          React.createElement('div', { className: 'h-[220px] w-full' },
            React.createElement(ResponsiveContainer, { width: '100%', height: '100%' } as any,
              React.createElement(BarChart, { data: gfData, margin: { top: 10, right: 10, left: -20, bottom: 20 } },
                React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#f1f5f9', vertical: false }),
                React.createElement(XAxis, { 
                  dataKey: 'name', 
                  tick: { fill: '#94a3b8', fontSize: 10 },
                  axisLine: false,
                  tickLine: false,
                  interval: 0,
                  angle: -25,
                  textAnchor: 'end'
                }),
                React.createElement(YAxis, { 
                  tick: { fill: '#94a3b8', fontSize: 10 },
                  axisLine: false,
                  tickLine: false,
                  tickFormatter: formatYAxis
                }),
                React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null), cursor: { fill: '#f8fafc' } }),
                React.createElement(Bar, { dataKey: 'margin', radius: [4, 4, 0, 0] },
                  gfData.map((entry, index) => 
                    React.createElement(Cell, { 
                      key: `cell-${index}`, 
                      fill: entry.margin >= 0 ? '#10b981' : '#ef4444' 
                    })
                  )
                )
              )
            )
          )
        ),
        // Foreman Chart
        React.createElement('div', { className: 'flex flex-col gap-3' },
          React.createElement('h3', { className: 'text-xs font-bold text-slate-500 uppercase tracking-wider' }, 'Foreman'),
          React.createElement('div', { className: 'h-[220px] w-full' },
            React.createElement(ResponsiveContainer, { width: '100%', height: '100%' } as any,
              React.createElement(BarChart, { data: foremanData, margin: { top: 10, right: 10, left: -20, bottom: 20 } },
                React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#f1f5f9', vertical: false }),
                React.createElement(XAxis, { 
                  dataKey: 'name', 
                  tick: { fill: '#94a3b8', fontSize: 10 },
                  axisLine: false,
                  tickLine: false,
                  interval: 0,
                  angle: -25,
                  textAnchor: 'end'
                }),
                React.createElement(YAxis, { 
                  tick: { fill: '#94a3b8', fontSize: 10 },
                  axisLine: false,
                  tickLine: false,
                  tickFormatter: formatYAxis
                }),
                React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null), cursor: { fill: '#f8fafc' } }),
                React.createElement(Bar, { dataKey: 'margin', radius: [4, 4, 0, 0] },
                  foremanData.map((entry, index) => 
                    React.createElement(Cell, { 
                      key: `cell-${index}`, 
                      fill: entry.margin >= 0 ? '#3b82f6' : '#ef4444' 
                    })
                  )
                )
              )
            )
          )
        )
      )
    )
  );
};
export default ServiceMap;
