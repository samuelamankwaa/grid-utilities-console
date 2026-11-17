import React, { useMemo, useState } from 'react';
import { getWorkOrderReportingDate, getInvoiceDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';

type MarginRow = { name: string; margin: number; gf?: string };

// $3,612,400 -> "$3.6M", 84,200 -> "$84k", -1,250 -> "-$1.3k"
const formatCompactCurrency = (value: number): string => {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
};

const MarginTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: MarginRow }[] }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const positive = row.margin >= 0;
  return (
    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-100 flex flex-col gap-1 min-w-[170px]">
      <p className="text-xs font-bold text-slate-700">{row.name}</p>
      {row.gf && <p className="text-[10px] text-slate-400">GF: {row.gf}</p>}
      <p className={`text-xs font-extrabold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
        Margin: {positive ? '' : '-'}${Math.abs(Math.round(row.margin)).toLocaleString()}
      </p>
    </div>
  );
};

const ROW_HEIGHT = 30;
const COLLAPSED_ROWS = 12;

const MarginBarList: React.FC<{
  title: string;
  data: MarginRow[];
  positiveColor: string;
}> = ({ title, data, positiveColor }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, COLLAPSED_ROWS);
  const hidden = data.length - visible.length;
  const chartHeight = Math.max(visible.length, 3) * ROW_HEIGHT + 40;
  const hasNegative = visible.some((d) => d.margin < 0);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
        <span className="text-[11px] text-slate-400">{data.length} total · sorted by margin</span>
      </div>

      {data.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
          No data for the selected filters
        </div>
      ) : (
        <div style={{ height: chartHeight }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visible} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }} barCategoryGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={formatCompactCurrency}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                interval={0}
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={(name: string) => (name.length > 22 ? `${name.slice(0, 21)}…` : name)}
                axisLine={false}
                tickLine={false}
              />
              {hasNegative && <ReferenceLine x={0} stroke="#cbd5e1" />}
              <Tooltip content={<MarginTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="margin" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {visible.map((entry) => (
                  <Cell key={entry.name} fill={entry.margin >= 0 ? positiveColor : '#ef4444'} />
                ))}
                <LabelList
                  dataKey="margin"
                  position="right"
                  formatter={(v: unknown) => formatCompactCurrency(Number(v))}
                  style={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          {expanded ? 'Show top 12 only' : `Show all (${hidden} more)`}
        </button>
      )}
    </div>
  );
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
          // Invoices are date-filtered by their own created date, so a crew with invoices
          // in range is charted even if none of its work orders were completed in range.
          if (!GFData[wo.general_foreman]) GFData[wo.general_foreman] = { name: wo.general_foreman, margin: 0 };
          if (!FData[f]) FData[f] = { name: f, gf: wo.general_foreman, margin: 0 };
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 select-none"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-800 my-0">Profit Margin Performance</h2>
        <p className="text-xs text-slate-500">
          Margin per General Foreman and Foreman: invoiced revenue minus booked days × ${dailyExpenseRate.toLocaleString()}.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MarginBarList title="General Foreman" data={gfData} positiveColor="#10b981" />
        <MarginBarList title="Foreman" data={foremanData} positiveColor="#3b82f6" />
      </div>
    </motion.div>
  );
};
export default ServiceMap;
