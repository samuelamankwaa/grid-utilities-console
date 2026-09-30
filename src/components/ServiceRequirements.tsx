import React, { useMemo } from 'react';
import { getWorkOrderReportingDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

export const ServiceRequirements: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders } = useSelector((state: RootState) => state.db);

  const data = useMemo(() => {
    const counts = {
      'Locked gates': 0,
      'Outage required': 0,
      'Permitting': 0,
      'Switching': 0,
      'Hydrovac': 0,
      'Tree trimming': 0,
      'Traffic control': 0,
    };
    let total = 0;
    let multiConditionsCount = 0;

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

      total++;
      let conditionsActive = 0;

      if (wo.locked_gates) { counts['Locked gates']++; conditionsActive++; }
      if (wo.outage_required) { counts['Outage required']++; conditionsActive++; }
      if (wo.permitting_needed) { counts['Permitting']++; conditionsActive++; }
      if (wo.switching_required) { counts['Switching']++; conditionsActive++; }
      if (wo.hydrovac_needed) { counts['Hydrovac']++; conditionsActive++; }
      if (wo.tree_trimming_needed) { counts['Tree trimming']++; conditionsActive++; }
      if (wo.traffic_control_needed) { counts['Traffic control']++; conditionsActive++; }

      if (conditionsActive >= 4) {
        multiConditionsCount++;
      }
    });

    const list = Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    })).sort((a, b) => b.count - a.count);

    return { list, total, multiConditionsCount };
  }, [workOrders, filters]);

  return (
    React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px] select-none' },
      React.createElement('div', { className: 'flex justify-between items-start mb-2' },
        React.createElement('h2', { className: 'text-lg font-semibold text-slate-800 my-0' }, 'Service Requirements'),
        React.createElement('span', { className: 'text-xs text-slate-400 font-mono mt-1' }, data.multiConditionsCount + ' with 4+ conditions')
      ),
      React.createElement('p', { className: 'text-xs text-slate-500 mb-6' }, 'Conditions that must be cleared before a crew can work the site.'),
      React.createElement('div', { className: 'space-y-4' },
        data.list.map(item =>
          React.createElement('div', { key: item.name, className: 'flex flex-col gap-1.5' },
            React.createElement('div', { className: 'flex items-center justify-between text-xs text-slate-600 font-medium' },
              React.createElement('span', null, item.name),
              React.createElement('span', { className: 'font-mono text-slate-700' }, item.count + ' ',
                React.createElement('span', { className: 'text-slate-400 text-[10px]' }, Math.round(item.percent) + '%')
              )
            ),
            React.createElement('div', { className: 'w-full bg-slate-100 h-2.5 rounded-full overflow-hidden' },
              React.createElement('div', { className: 'bg-emerald-600 h-full rounded-full', style: { width: item.percent + '%' } })
            )
          )
        )
      )
    )
  );
};
