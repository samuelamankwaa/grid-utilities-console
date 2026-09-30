import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setFilters, resetFilters } from '../store/filtersSlice';
import { RotateCcw, ChevronDown, RefreshCw, Sparkles, X, Search, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Filters: React.FC = () => {
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices, laborEntries } = useSelector((state: RootState) => state.db);
  const [isOpen, setIsOpen] = useState(false);
  const [isWoOpen, setIsWoOpen] = useState(false);
  const [woSearchQuery, setWoSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const woDropdownRef = useRef<HTMLDivElement>(null);

  // Sync button toast state
  const [showSyncToast, setShowSyncToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSyncToast = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setShowSyncToast(true);
    toastTimeoutRef.current = setTimeout(() => {
      setShowSyncToast(false);
    }, 3500);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (woDropdownRef.current && !woDropdownRef.current.contains(event.target as Node)) {
        setIsWoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const gfList = useMemo(() => {
    const sets = new Set(workOrders.map((w) => w.general_foreman).filter(Boolean));
    return ['All crews', ...Array.from(sets)];
  }, [workOrders]);

  const foremanList = useMemo(() => {
    if (filters.generalForeman === 'All crews') return [];
    const filteredWH = workOrders.filter((w) => w.general_foreman === filters.generalForeman);
    const sets = new Set(filteredWH.map((w) => w.foreman).filter(Boolean));
    return Array.from(sets);
  }, [workOrders, filters.generalForeman]);

  // List of all unique Work Order numbers, scoped by crew if selected
  const woList = useMemo(() => {
    const sets = new Set<string>();
    workOrders.forEach((w) => {
      if (filters.generalForeman !== 'All crews' && w.general_foreman !== filters.generalForeman) return;
      if (filters.foreman.length > 0 && !filters.foreman.includes(w.foreman)) return;
      if (w.work_order_number) sets.add(String(w.work_order_number).trim());
    });
    // Also include labor entries work orders
    laborEntries.forEach((e) => {
      if (e.work_order_number) {
        if (filters.generalForeman !== 'All crews' || filters.foreman.length > 0) {
          const wo = workOrders.find((w) => w.work_order_number === e.work_order_number);
          if (filters.generalForeman !== 'All crews' && wo?.general_foreman !== filters.generalForeman) return;
          if (filters.foreman.length > 0 && (!wo?.foreman || !filters.foreman.includes(wo.foreman))) return;
        }
        sets.add(String(e.work_order_number).trim());
      }
    });
    // Also include invoices' work order numbers if workOrders is empty
    if (sets.size === 0) {
      invoices.forEach((i) => {
        if (i.work_order_number) sets.add(String(i.work_order_number).trim());
      });
    }
    return Array.from(sets).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [workOrders, invoices, laborEntries, filters.generalForeman, filters.foreman]);

  const filteredWoList = useMemo(() => {
    if (!woSearchQuery.trim()) return woList;
    return woList.filter((wo) => wo.toLowerCase().includes(woSearchQuery.toLowerCase().trim()));
  }, [woList, woSearchQuery]);

  const handleForemanToggle = (foremanName: string) => {
    let current = [...filters.foreman];
    if (current.includes(foremanName)) {
      current = current.filter((f) => f !== foremanName);
    } else {
      current.push(foremanName);
    }
    dispatch(setFilters({ foreman: current }));
  };

  const handleSelectAllForemen = () => {
    if (filters.foreman.length === foremanList.length) {
      dispatch(setFilters({ foreman: [] }));
    } else {
      dispatch(setFilters({ foreman: [...foremanList] }));
    }
  };

  const handleWoToggle = (woNumber: string) => {
    let current = [...filters.workOrderNumbers];
    if (current.includes(woNumber)) {
      current = current.filter((w) => w !== woNumber);
    } else {
      current.push(woNumber);
    }
    dispatch(setFilters({ workOrderNumbers: current }));
  };

  const handleSelectAllWos = () => {
    if (filters.workOrderNumbers.length === woList.length && woList.length > 0) {
      dispatch(setFilters({ workOrderNumbers: [] }));
    } else {
      dispatch(setFilters({ workOrderNumbers: [...woList] }));
    }
  };

  const handleClearWos = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setFilters({ workOrderNumbers: [] }));
  };

  return (
    <div className="flex flex-wrap items-end gap-4 px-8 py-4 bg-slate-50 border-b border-slate-200 text-slate-700 select-none relative">
      {/* Date filter */}
      <div className="flex flex-col gap-1">
        <label
          className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
          title="Filters work orders by Fulcrum Completion Date for completed work (never Last Updated)"
        >
          Reporting Date (Completion / Need)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => dispatch(setFilters({ startDate: e.target.value || null }))}
            className="px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => dispatch(setFilters({ endDate: e.target.value || null }))}
            className="px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
          />
        </div>
      </div>

      {/* General Foreman filter */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">General Foreman</label>
        <select
          value={filters.generalForeman}
          onChange={(e) => dispatch(setFilters({ generalForeman: e.target.value, foreman: [] }))}
          className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {gfList.map((gf) => (
            <option key={gf} value={gf}>
              {gf}
            </option>
          ))}
        </select>
      </div>

      {/* Foreman dropdown */}
      <div className="flex flex-col gap-1 relative w-56" ref={dropdownRef}>
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Foreman</label>
        {filters.generalForeman === 'All crews' ? (
          <select
            disabled
            className="px-3 py-1.5 text-sm bg-slate-100 border border-slate-300 rounded-md text-slate-400 cursor-not-allowed w-full"
          >
            <option>Select General Foreman first</option>
          </select>
        ) : (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center cursor-pointer font-medium text-left"
            >
              <span className="truncate">
                {filters.foreman.length === 0
                  ? 'Select Foreman'
                  : filters.foreman.length === foremanList.length
                    ? 'All foremen selected'
                    : `${filters.foreman.length} foremen selected`}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
            </button>
            {isOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto p-2 space-y-1">
                <div
                  onClick={handleSelectAllForemen}
                  className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs font-semibold border-b border-slate-100 pb-2 mb-1"
                >
                  <input
                    type="checkbox"
                    checked={filters.foreman.length === foremanList.length && foremanList.length > 0}
                    onChange={() => { }}
                    className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                  />
                  Select All
                </div>
                {foremanList.map((fore) => (
                  <div
                    key={fore}
                    onClick={() => handleForemanToggle(fore)}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={filters.foreman.includes(fore)}
                      onChange={() => { }}
                      className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                    />
                    <span className="truncate">{fore}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Work Order Number Multi-Select Filter */}
      <div className="flex flex-col gap-1 relative w-64" ref={woDropdownRef}>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
            <Hash className="w-3 h-3 text-slate-400" />
            Work Order #
          </label>
          {filters.workOrderNumbers.length > 0 && (
            <button
              type="button"
              onClick={handleClearWos}
              className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Clear ({filters.workOrderNumbers.length})
            </button>
          )}
        </div>
        <div className="w-full">
          <button
            type="button"
            onClick={() => setIsWoOpen(!isWoOpen)}
            className={`w-full px-3 py-1.5 text-sm bg-white border ${filters.workOrderNumbers.length > 0 ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'
              } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center cursor-pointer font-medium text-left`}
          >
            <span className="truncate">
              {filters.workOrderNumbers.length === 0
                ? 'All Work Orders'
                : filters.workOrderNumbers.length === 1
                  ? `#${filters.workOrderNumbers[0]}`
                  : filters.workOrderNumbers.length === woList.length && woList.length > 0
                    ? 'All Work Orders selected'
                    : `${filters.workOrderNumbers.length} WOs selected`}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              {filters.workOrderNumbers.length > 0 && (
                <span
                  onClick={handleClearWos}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear work orders"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          {isWoOpen && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-72 flex flex-col p-2">
              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search work order #..."
                  value={woSearchQuery}
                  onChange={(e) => setWoSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-blue-500"
                  autoFocus
                />
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={handleSelectAllWos}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  {filters.workOrderNumbers.length === woList.length && woList.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
                <span className="text-slate-400 text-[10px]">
                  {woList.length} total {woList.length === 1 ? 'order' : 'orders'}
                </span>
              </div>

              {/* Scrollable Work Orders List */}
              <div className="overflow-y-auto flex-1 mt-1 space-y-0.5 max-h-48 pr-1">
                {filteredWoList.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    {woList.length === 0 ? 'No work orders available' : 'No matching work order'}
                  </div>
                ) : (
                  filteredWoList.map((woNum) => {
                    const isChecked = filters.workOrderNumbers.includes(woNum);
                    return (
                      <div
                        key={woNum}
                        onClick={() => handleWoToggle(woNum)}
                        className={`flex items-center justify-between p-1.5 hover:bg-blue-50/70 rounded cursor-pointer text-xs transition-colors ${isChecked ? 'bg-blue-50/40 text-blue-900 font-semibold' : 'text-slate-700'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => { }}
                            className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                          />
                          <span className="font-mono text-[11px] truncate">#{woNum}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Status */}
      {/* <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Invoice Status</label>
        <select
          value={filters.status}
          onChange={(e) => dispatch(setFilters({ status: e.target.value }))}
          className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="All statuses">All statuses</option>
          <option value="Approved">Approved</option>
          <option value="Unapproved">Unapproved</option>
          <option value="Draft">Draft</option>
          <option value="Pending Approval">Pending Approval</option>
          <option value="Voided">Voided</option>
          <option value="Disputed">Disputed</option>
        </select>
      </div> */}

      {/* Action Buttons: Sync (Left) and Reset */}
      <div className="ml-auto flex items-center gap-2.5 relative">
        {/* Sync Button */}
        <div className="relative">
          <button
            type="button"
            onClick={triggerSyncToast}
            onMouseEnter={triggerSyncToast}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 text-sm font-semibold border border-blue-200 hover:border-blue-300 rounded-md shadow-sm transition-all duration-150 cursor-pointer select-none group"
            title="Direct Live Sync"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 group-hover:rotate-180 transition-transform duration-500" />
            <span>Sync</span>
          </button>

          {/* Toast Notification on Hover / Click */}
          <AnimatePresence>
            {showSyncToast && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 bottom-full mb-2 w-72 bg-slate-900 text-white text-xs p-3 rounded-xl shadow-2xl border border-slate-700 z-50 pointer-events-auto"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[11px] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Feature In Development</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSyncToast(false);
                    }}
                    className="text-slate-400 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-slate-300 text-[11px] mt-1.5 leading-relaxed">
                  Direct live API synchronization with Fulcrum & Connecteam is <strong className="text-white">coming soon</strong>!
                </p>
                <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-mono">
                  <span>Manual CSV Upload Active</span>
                  <span className="text-emerald-400">● Ready</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reset Button */}
        <button
          type="button"
          onClick={() => dispatch(resetFilters())}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-sm font-semibold border border-slate-300 rounded-md shadow-sm cursor-pointer select-none transition-all duration-150"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

export default Filters;
