import React, { useMemo } from 'react';
import { getWorkOrderReportingDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

export const StatusPercentage: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders } = useSelector((state: RootState) => state.db);

  const data = useMemo(() => {
    const counts: Record<string, number> = {
      'Work Pending': 0,
      'Field Check': 0,
      'Field Complete': 0,
      'CTCC Completed': 0,
      'Ready to Bill': 0,
    };
    let total = 0;
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

      const status = wo.status || 'Work Pending';
      if (counts[status] !== undefined) {
        counts[status]++;
        total++;
      }
    });

    const orderedKeys = ['Work Pending', 'Field Check', 'Field Complete', 'CTCC Completed', 'Ready to Bill'];
    return {
      list: orderedKeys.map((key, i) => ({
        name: key,
        index: i + 1,
        count: counts[key],
        percent: total > 0 ? (counts[key] / total) * 100 : 0,
      })),
      total
    };
  }, [workOrders, filters]);

  return (
    React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] select-none' },
      React.createElement('h2', { className: 'text-lg font-semibold text-slate-800 mb-2' }, 'Status Count Percentage Breakdown'),
      React.createElement('p', { className: 'text-xs text-slate-500 mb-6' }, 'Share of work orders in each status category, in field sequence. Bars are sized by percentage.'),
      React.createElement('div', { className: 'space-y-5 mt-2' },
        data.list.map(item =>
          React.createElement('div', { key: item.name, className: 'flex flex-col gap-1.5' },
            React.createElement('div', { className: 'flex items-center justify-between text-xs font-medium text-slate-600' },
              React.createElement('span', { className: 'flex items-center gap-2' },
                React.createElement('span', { className: 'text-slate-300' }, item.index),
                React.createElement('span', { className: 'text-slate-700 font-semibold' }, item.name)
              ),
              React.createElement('span', { className: 'font-mono' }, Math.round(item.percent) + '% ',
                React.createElement('span', { className: 'text-slate-500' }, '(' + item.count + ' WOs)')
              )
            ),
            React.createElement('div', { className: 'w-full bg-slate-100 h-3 rounded-full overflow-hidden' },
              React.createElement('div', { className: 'bg-blue-600 h-full rounded-full', style: { width: item.percent + '%' } })
            )
          )
        )
      )
    )
  );
};
