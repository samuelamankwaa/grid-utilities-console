import React, { useMemo } from 'react';
import { getWorkOrderReportingDate, getInvoiceDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

export const MoneyHeldAging: React.FC = () => {
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

    const unapproved = invoices.filter(inv => {
      if (inv.status !== 'Unapproved') return false;
      if (!woNumbers.has(inv.work_order_number || '')) return false;
      const invDate = getInvoiceDate(inv);
      if (invDate) {
        if (filters.startDate && invDate < filters.startDate) return false;
        if (filters.endDate && invDate > filters.endDate) return false;
      } else if (filters.startDate || filters.endDate) {
        return false;
      }
      return true;
    });

    const today = new Date('2026-08-25');

    const buckets = {
      '0-15': { label: '0-15 DAYS', total: 0, count: 0, awaitingReply: 0 },
      '16-30': { label: '16-30 DAYS', total: 0, count: 0, awaitingReply: 0 },
      '31-60': { label: '31-60 DAYS', total: 0, count: 0, awaitingReply: 0 },
      '60+': { label: 'OVER 60 DAYS', total: 0, count: 0, awaitingReply: 0 },
    };

    unapproved.forEach(inv => {
      if (inv.created_date) {
        const date = new Date(inv.created_date);
        const diffTime = Math.abs(today.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let key: keyof typeof buckets = '60+';
        if (diffDays <= 15) key = '0-15';
        else if (diffDays <= 30) key = '16-30';
        else if (diffDays <= 60) key = '31-60';

        const b = buckets[key];
        b.total += inv.total;
        b.count++;
        if (inv.unanswered_comments) {
          b.awaitingReply++;
        }
      }
    });

    const grandTotal = Object.values(buckets).reduce((sum, b) => sum + b.total, 0);

    return {
      list: Object.entries(buckets).map(([key, value]) => ({
        key,
        ...value,
        percent: grandTotal > 0 ? (value.total / grandTotal) * 100 : 0,
      })),
      grandTotal,
    };
  }, [workOrders, invoices, filters]);

  const formatCurrencyK = (num: number) => {
    return '$' + Math.round(num / 1000) + 'k';
  };

  return (
    React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[300px] select-none' },
      React.createElement('h2', { className: 'text-lg font-semibold text-slate-800 mb-2' }, 'How long the money has been held'),
      React.createElement('p', { className: 'text-xs text-slate-500 mb-6' }, 'Unapproved invoice value by age since the invoice was raised. Older money is harder to collect - anything past 60 days needs escalation, not another reminder.'),
      
      React.createElement('div', { className: 'flex w-full h-8 bg-slate-100 rounded-lg overflow-hidden mb-6' },
        data.list.map(b =>
          React.createElement('div', {
            key: b.key,
            className: 'h-full transition-all duration-300 ' +
              (b.key === '0-15' ? 'bg-blue-300' :
               b.key === '16-30' ? 'bg-blue-400' :
               b.key === '31-60' ? 'bg-blue-500' : 'bg-blue-600'),
            style: { width: b.percent + '%' }
          })
        )
      ),
      
      React.createElement('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-slate-100 pt-6' },
        data.list.map(b =>
          React.createElement('div', { key: b.key, className: 'flex flex-col gap-1' },
            React.createElement('span', { className: 'text-[10px] font-bold tracking-wider ' + (b.key === '60+' ? 'text-red-500' : 'text-slate-400') },
              b.key === '60+' ? '⚠️ ' + b.label : b.label
            ),
            React.createElement('h3', { className: 'text-2xl font-black ' + (b.key === '60+' ? 'text-red-600' : 'text-slate-800') },
              formatCurrencyK(b.total)
            ),
            React.createElement('span', { className: 'text-xs text-slate-400 font-mono' },
              b.count + ' ' + (b.count === 1 ? 'invoice' : 'invoices') + ' · ' + b.awaitingReply + ' awaiting reply'
            )
          )
        )
      )
    )
  );
};
