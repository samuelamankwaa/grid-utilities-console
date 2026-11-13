import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCircle, ChevronDown, Info, Loader2, Search, UserCog, X } from 'lucide-react';
import { AppDispatch, RootState } from '../store/store';
import { saveEmployeePositionThunk } from '../store/dbSlice';
import { EmployeePositionOverride, LaborEntry } from '../types/schemas';
import { formatCurrency, formatHours, getLaborRoleRates } from '../utils/helpers';
import {
  computeLaborEntryCost,
  inferEntryRole,
  normalizeEmployeeDisplayName,
  normalizeEmployeeKey,
  validateHourlyRateInput,
} from '../utils/laborCost';
import { useLaborCost } from '../hooks/useLaborCost';

interface EmployeePositionModalProps {
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface EmployeeOption {
  key: string;
  name: string;
  spellings: number;
  entries: LaborEntry[];
  hours: number;
  sourceRates: number[];
  inferredRole: string | null;
  override?: EmployeePositionOverride;
}

const MAX_VISIBLE_OPTIONS = 200;

const mostCommon = <T,>(values: T[]): T | null => {
  const counts = new Map<T, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best: T | null = null;
  let bestCount = 0;
  counts.forEach((count, v) => {
    if (count > bestCount) {
      best = v;
      bestCount = count;
    }
  });
  return best;
};

export const EmployeePositionModal: React.FC<EmployeePositionModalProps> = ({ onClose, onSaved }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { laborEntries, laborRateCategories, employeePositions } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);
  const { ctx, getBreakdown } = useLaborCost();

  const canManage = currentUser?.role === 'Supervisor' || currentUser?.role === 'Admin';
  const roleNames = useMemo(() => laborRateCategories.map((c) => c.category_name), [laborRateCategories]);

  // Unique employees, grouped by normalized identity key (see normalizeEmployeeKey).
  const employees = useMemo<EmployeeOption[]>(() => {
    const groups = new Map<string, { names: string[]; entries: LaborEntry[] }>();
    laborEntries.forEach((e) => {
      const key = normalizeEmployeeKey(e.employee_name);
      if (!key) return;
      const g = groups.get(key) || { names: [], entries: [] };
      g.names.push(normalizeEmployeeDisplayName(e.employee_name));
      g.entries.push(e);
      groups.set(key, g);
    });
    // Employees with a saved assignment but no loaded shifts stay editable.
    Object.entries(employeePositions).forEach(([key, ov]) => {
      if (!groups.has(key)) groups.set(key, { names: [ov.employee_name], entries: [] });
    });

    return Array.from(groups.entries())
      .map(([key, g]) => {
        const override = employeePositions[key];
        return {
          key,
          name: override?.employee_name || mostCommon(g.names) || g.names[0],
          spellings: new Set(g.names).size,
          entries: g.entries,
          hours: g.entries.reduce((sum, e) => sum + (Number(e.shift_hours) || 0), 0),
          sourceRates: Array.from(new Set(g.entries.map((e) => Number(e.hourly_rate) || 0))).sort((a, b) => a - b),
          inferredRole: mostCommon(g.entries.map((e) => inferEntryRole(e, ctx))),
          override,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [laborEntries, employeePositions, ctx]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [roleCategory, setRoleCategory] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [touched, setTouched] = useState({ employee: false, role: false, rate: false });
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const selected = employees.find((e) => e.key === selectedKey) || null;

  // Searchable employee combobox
  const [query, setQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const comboRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? employees.filter((e) => e.name.toLowerCase().includes(q)) : employees;
  }, [employees, query]);
  const visibleMatches = matches.slice(0, MAX_VISIBLE_OPTIONS);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) setListOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectEmployee = (emp: EmployeeOption) => {
    setSelectedKey(emp.key);
    setQuery('');
    setListOpen(false);
    setSaveError(null);
    if (emp.override) {
      // Editing an existing assignment: load what is saved.
      setRoleCategory(emp.override.role_category);
      setRateInput(Number(emp.override.hourly_rate).toFixed(2));
    } else {
      // New assignment: suggest the currently inferred role, but never pre-fill the rate.
      setRoleCategory(emp.inferredRole && roleNames.includes(emp.inferredRole) ? emp.inferredRole : '');
      setRateInput('');
    }
    setTouched({ employee: true, role: false, rate: false });
  };

  const handleComboKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setListOpen(true);
      setActiveIndex((i) => Math.min(i + 1, visibleMatches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (listOpen && visibleMatches[activeIndex]) selectEmployee(visibleMatches[activeIndex]);
    } else if (e.key === 'Escape') {
      setListOpen(false);
    }
  };

  // Validation
  const employeeError = selected ? '' : 'Select an employee.';
  const roleError = !roleCategory ? 'Select a position.' : !roleNames.includes(roleCategory) ? 'Unknown position.' : '';
  const rateError = validateHourlyRateInput(rateInput);
  const rateValue = rateError ? null : parseFloat(parseFloat(rateInput).toFixed(2));
  const isValid = !employeeError && !roleError && !rateError;

  const isUnchanged =
    !!selected?.override &&
    selected.override.role_category === roleCategory &&
    rateValue !== null &&
    Number(selected.override.hourly_rate) === rateValue;

  // Impact preview: price this employee's shifts with and without the draft assignment.
  const impact = useMemo(() => {
    if (!selected || !isValid || rateValue === null) return null;
    const draftCtx = {
      ...ctx,
      employeePositions: {
        ...ctx.employeePositions,
        [selected.key]: {
          employee_key: selected.key,
          employee_name: selected.name,
          role_category: roleCategory,
          hourly_rate: rateValue,
        },
      },
    };
    const current = selected.entries.reduce((sum, e) => sum + getBreakdown(e).totalCost, 0);
    const next = selected.entries.reduce((sum, e) => sum + computeLaborEntryCost(e, draftCtx).totalCost, 0);
    return { current, next, delta: next - current };
  }, [selected, isValid, rateValue, roleCategory, ctx, getBreakdown]);

  const standardRate = roleCategory ? getLaborRoleRates(roleCategory, laborRateCategories)?.standard_rate : undefined;

  const handleSave = async () => {
    setTouched({ employee: true, role: true, rate: true });
    if (!isValid || !selected || rateValue === null || isUnchanged || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    try {
      const saved = await dispatch(
        saveEmployeePositionThunk({ employeeName: selected.name, roleCategory, hourlyRate: rateValue })
      ).unwrap();
      onSaved(
        `${saved.employee_name} is now ${saved.role_category} at ${formatCurrency(Number(saved.hourly_rate))}/hr. ` +
          `${selected.entries.length} shift${selected.entries.length === 1 ? '' : 's'} re-priced.`
      );
    } catch (err) {
      const message =
        typeof err === 'string' ? err : err instanceof Error ? err.message : (err as { message?: string })?.message;
      setSaveError(message || 'Could not save the position. Nothing was changed.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const fieldClass = (hasError: boolean) =>
    `w-full bg-white border rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 transition-colors ${
      hasError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
    }`;

  if (!canManage) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Not authorized</p>
          <p className="mt-1 text-xs text-slate-500">Only Supervisors and Admins can manage employee positions.</p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="position-modal-title"
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col border border-slate-100 font-sans"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h3 id="position-modal-title" className="text-base font-bold text-slate-800 my-0">
                {selected?.override ? 'Edit Position' : 'Add Position'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign a role and labor rate. It overrides automatic classification for all of this employee's shifts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Cancel"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Field 1: Employee */}
          <div ref={comboRef} className="relative">
            <label htmlFor="position-employee" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Employee
            </label>
            {employees.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>No employees found. Upload a Connecteam timesheet first; employees are taken from timesheet records.</span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="position-employee"
                    role="combobox"
                    aria-expanded={listOpen}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    autoComplete="off"
                    disabled={submitting}
                    value={listOpen ? query : selected?.name || query}
                    placeholder={`Search ${employees.length} employee${employees.length === 1 ? '' : 's'}...`}
                    onFocus={() => {
                      setListOpen(true);
                      setActiveIndex(0);
                    }}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setListOpen(true);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleComboKeyDown}
                    className={`${fieldClass(touched.employee && !!employeeError)} pl-9 pr-9`}
                  />
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {listOpen && (
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-64 overflow-y-auto p-1"
                  >
                    {visibleMatches.length === 0 && (
                      <li className="px-3 py-4 text-center text-xs text-slate-400">No employee matches "{query}"</li>
                    )}
                    {visibleMatches.map((emp, idx) => (
                      <li
                        key={emp.key}
                        role="option"
                        aria-selected={emp.key === selectedKey}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectEmployee(emp)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-xs ${
                          idx === activeIndex ? 'bg-blue-50' : ''
                        } ${emp.key === selectedKey ? 'font-semibold text-blue-800' : 'text-slate-700'}`}
                      >
                        <span className="truncate">{emp.name}</span>
                        <span className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400 font-mono">
                          {emp.override && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-sans font-bold uppercase">
                              {emp.override.role_category}
                            </span>
                          )}
                          {emp.entries.length} shift{emp.entries.length === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                    {matches.length > MAX_VISIBLE_OPTIONS && (
                      <li className="px-3 py-2 text-center text-[10px] text-slate-400">
                        Showing {MAX_VISIBLE_OPTIONS} of {matches.length}. Keep typing to narrow the list.
                      </li>
                    )}
                  </ul>
                )}
                {touched.employee && employeeError && <p className="mt-1 text-[11px] text-rose-600 font-medium">{employeeError}</p>}
              </>
            )}

            {selected && (
              <div className="mt-2 text-[11px] text-slate-500 space-y-1">
                <p>
                  {selected.entries.length} shift{selected.entries.length === 1 ? '' : 's'} · {formatHours(selected.hours)}
                  {selected.sourceRates.length > 0 && (
                    <> · timesheet rate{selected.sourceRates.length > 1 ? 's' : ''}: {selected.sourceRates.map((r) => formatCurrency(r)).join(', ')}</>
                  )}
                </p>
                {selected.spellings > 1 && (
                  <p className="text-amber-700">
                    This employee appears with {selected.spellings} spellings (different spacing or capitalization). They are treated as one employee.
                  </p>
                )}
              </div>
            )}
          </div>

          {selected?.override && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Editing the existing assignment: <strong>{selected.override.role_category}</strong> at{' '}
                <strong>{formatCurrency(Number(selected.override.hourly_rate))}/hr</strong>
                {selected.override.updated_at && <> (last updated {new Date(selected.override.updated_at).toLocaleString()})</>}. Saving
                replaces it; no duplicate is created.
              </span>
            </div>
          )}

          {/* Field 2: Role / Position */}
          <div>
            <label htmlFor="position-role" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Role / Position
            </label>
            <select
              id="position-role"
              value={roleCategory}
              disabled={submitting}
              onChange={(e) => {
                setRoleCategory(e.target.value);
                setTouched((t) => ({ ...t, role: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, role: true }))}
              className={`${fieldClass(touched.role && !!roleError)} cursor-pointer`}
            >
              <option value="" disabled>
                Select a position
              </option>
              {roleNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {touched.role && roleError && <p className="mt-1 text-[11px] text-rose-600 font-medium">{roleError}</p>}
            {selected && !selected.override && selected.inferredRole && (
              <p className="mt-1 text-[11px] text-slate-400">Currently classified automatically as {selected.inferredRole}.</p>
            )}
          </div>

          {/* Field 3: Labor Rate */}
          <div>
            <label htmlFor="position-rate" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Labor Rate (USD / hour)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold pointer-events-none">$</span>
              <input
                id="position-rate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                disabled={submitting}
                value={rateInput}
                placeholder="0.00"
                onChange={(e) => setRateInput(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, rate: true }))}
                className={`${fieldClass(touched.rate && !!rateError)} pl-7 pr-12 font-mono`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">/hr</span>
            </div>
            {touched.rate && rateError && <p className="mt-1 text-[11px] text-rose-600 font-medium">{rateError}</p>}
            {standardRate !== undefined && (
              <p className="mt-1 text-[11px] text-slate-400">
                Standard {roleCategory} rate: {formatCurrency(standardRate)}/hr.{' '}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setRateInput(standardRate.toFixed(2));
                    setTouched((t) => ({ ...t, rate: true }));
                  }}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  Use standard rate
                </button>
              </p>
            )}
          </div>

          {/* Impact preview */}
          {impact && selected && selected.entries.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
              <p className="font-bold uppercase tracking-wide text-[10px] text-slate-500 mb-1">Impact on labor cost</p>
              <p className="font-mono">
                {formatCurrency(impact.current)} → <strong className="text-slate-900">{formatCurrency(impact.next)}</strong>{' '}
                <span className={impact.delta > 0 ? 'text-rose-600' : impact.delta < 0 ? 'text-emerald-600' : 'text-slate-400'}>
                  ({impact.delta >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(impact.delta))})
                </span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Across {selected.entries.length} historical shift{selected.entries.length === 1 ? '' : 's'}. Future uploads for this employee use the
                same assignment.
              </p>
            </div>
          )}

          {saveError && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          {isUnchanged && <span className="mr-auto text-[11px] text-slate-400">No changes to save.</span>}
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || employees.length === 0 || isUnchanged}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Saving...' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeePositionModal;
