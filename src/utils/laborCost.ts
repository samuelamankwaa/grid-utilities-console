// Single source of truth for labor role resolution and labor cost calculation.
//
// Every screen (dashboard KPIs, timesheet table, role breakdown, WO rollup, upload
// persistence, position-assignment preview) must price shifts through this module so
// that employee position overrides are applied identically everywhere.
//
// Stored timesheet rows are never rewritten when an override changes: they keep the
// uploaded source values (original hourly_rate, OT/DT/benefits/line costs) for audit and
// reconciliation. Overrides are applied here, at calculation time, which makes historical
// rows, newly uploaded rows, and later assignment changes all follow the same rules.

import { EmployeePositionOverride, LaborEntry, LaborRateCategory, WorkOrder } from '../types/schemas';
import { classifyLaborRole, getLaborRoleBenefitsRate, DEFAULT_LABOR_RATE_CATEGORIES } from './helpers';

/** Overrides keyed by normalized employee key. */
export type EmployeePositionMap = Record<string, EmployeePositionOverride>;

/** Everything needed to resolve an entry's role and price it. */
export interface LaborCalcContext {
  categories: LaborRateCategory[];
  employeePositions: EmployeePositionMap;
  woMap: Map<string, WorkOrder>;
  gfNames: Set<string>;
  foremanNames: Set<string>;
}

/** Fields of a labor entry that the calculation reads. */
export type LaborEntryCostInput = Pick<LaborEntry, 'employee_name' | 'work_order_number' | 'shift_hours' | 'hourly_rate'> &
  Partial<
    Pick<
      LaborEntry,
      'ot_hours' | 'ot_cost' | 'dt_hours' | 'dt_cost' | 'benefits_rate' | 'benefits_cost' | 'line_labor_cost' | 'role_category'
    >
  >;

export interface LaborCostBreakdown {
  role: string;
  /** Rate actually used for pricing (override rate when overridden). */
  hourlyRate: number;
  /** Rate from the uploaded timesheet row. */
  sourceHourlyRate: number;
  isOverridden: boolean;
  regularHours: number;
  otHours: number;
  dtHours: number;
  regularCost: number;
  otCost: number;
  dtCost: number;
  benefitsRate: number;
  benefitsCost: number;
  totalCost: number;
}

/**
 * Employee identity key. Timesheets carry no employee ID, so the key is the name with
 * surrounding whitespace removed, inner whitespace collapsed, and lower-cased.
 * Matching is exact on this key: "John Smith" and "john  smith" are the same employee,
 * "John Smith" and "John Smithson" are not. Must stay in sync with the
 * check_epo_employee_key_normalized constraint in the database.
 */
export const normalizeEmployeeKey = (name: string | null | undefined): string =>
  normalizeEmployeeDisplayName(name).toLowerCase();

/** Display form of a name: trimmed with inner whitespace collapsed (case preserved). */
export const normalizeEmployeeDisplayName = (name: string | null | undefined): string =>
  (name ?? '').trim().replace(/\s+/g, ' ');

/** Upper bound for an assigned hourly rate (mirrors check_epo_hourly_rate_range in the DB). */
export const MAX_EMPLOYEE_HOURLY_RATE = 1000;

const RATE_PATTERN = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/;

/** Validates a typed hourly rate. Returns an error message, or '' when valid. */
export const validateHourlyRateInput = (raw: string): string => {
  const value = raw.trim();
  if (!value) return 'Labor rate is required.';
  if (value.startsWith('-')) return 'Labor rate cannot be negative.';
  if (!RATE_PATTERN.test(value)) return 'Enter a valid amount with up to 2 decimals (e.g. 65.00).';
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 'Labor rate must be greater than $0.';
  if (n > MAX_EMPLOYEE_HOURLY_RATE) return `Labor rate cannot exceed $${MAX_EMPLOYEE_HOURLY_RATE}/hr.`;
  return '';
};

const round2 = (n: number): number => parseFloat(n.toFixed(2));

const isNumeric = (v: unknown): boolean => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));

const isPositive = (v: unknown): boolean => isNumeric(v) && Number(v) > 0;

const activeCategories = (categories: LaborRateCategory[] | undefined): LaborRateCategory[] =>
  categories && categories.length > 0 ? categories : DEFAULT_LABOR_RATE_CATEGORIES;

export const buildLaborCalcContext = (
  workOrders: WorkOrder[],
  categories: LaborRateCategory[],
  employeePositions: EmployeePositionMap
): LaborCalcContext => {
  const woMap = new Map<string, WorkOrder>();
  const gfNames = new Set<string>();
  const foremanNames = new Set<string>();
  workOrders.forEach((w) => {
    if (w.work_order_number) woMap.set(String(w.work_order_number).trim(), w);
    if (w.general_foreman) gfNames.add(w.general_foreman.trim().toLowerCase());
    if (w.foreman) foremanNames.add(w.foreman.trim().toLowerCase());
  });
  return { categories: activeCategories(categories), employeePositions, woMap, gfNames, foremanNames };
};

export const getEmployeePositionOverride = (
  employeeName: string | null | undefined,
  employeePositions: EmployeePositionMap
): EmployeePositionOverride | undefined => {
  const key = normalizeEmployeeKey(employeeName);
  return key ? employeePositions[key] : undefined;
};

/** Automatic role inference (crew assignment, then hourly rate), ignoring overrides. */
export const inferEntryRole = (
  entry: Pick<LaborEntry, 'employee_name' | 'work_order_number' | 'hourly_rate'>,
  ctx: LaborCalcContext
): string => {
  const wo = ctx.woMap.get(String(entry.work_order_number ?? '').trim());
  return classifyLaborRole(
    Number(entry.hourly_rate) || 0,
    activeCategories(ctx.categories),
    entry.employee_name,
    wo,
    ctx.gfNames,
    ctx.foremanNames
  );
};

/**
 * Role precedence:
 * 1. Explicit employee position override
 * 2. Work-order crew assignment (General Foreman / Foreman by name)
 * 3. Hourly-rate match against the rate card
 * 4. 'unclassified'
 */
export const resolveEntryRole = (
  entry: Pick<LaborEntry, 'employee_name' | 'work_order_number' | 'hourly_rate'>,
  ctx: LaborCalcContext
): string => getEmployeePositionOverride(entry.employee_name, ctx.employeePositions)?.role_category ?? inferEntryRole(entry, ctx);

interface PricingOptions {
  role: string;
  hourlyRate: number;
  categories: LaborRateCategory[];
  /**
   * When true, positive stored OT/DT/benefits/line costs from the upload are used as-is
   * (existing behaviour for source data). When false (an override is active) every cost
   * is recomputed from hours, the effective rate, and the effective role, because stored
   * costs were priced at the source rate/role and would be stale.
   */
  trustStoredCosts: boolean;
}

/**
 * Pure pricing of one shift. Formulas:
 *   OT hours      = stored, else max(0, shift − 8)
 *   DT hours      = stored, else 0
 *   Regular hours = max(0, shift − OT − DT)
 *   Regular cost  = Regular hours × rate
 *   OT cost       = OT hours × rate × 1.5
 *   DT cost       = DT hours × rate × 2.0
 *   Benefits      = shift hours × role benefits rate
 *   Total         = Regular + OT + DT + Benefits
 * Hours are source data and are always kept; only costs depend on rate and role.
 */
export const priceLaborEntry = (entry: LaborEntryCostInput, opts: PricingOptions): LaborCostBreakdown => {
  const { role, hourlyRate, categories, trustStoredCosts } = opts;
  const shiftHours = Number(entry.shift_hours) || 0;
  const sourceHourlyRate = Number(entry.hourly_rate) || 0;

  const otHours = isNumeric(entry.ot_hours) ? Number(entry.ot_hours) : shiftHours > 8 ? round2(shiftHours - 8) : 0;
  const dtHours = isNumeric(entry.dt_hours) ? Number(entry.dt_hours) : 0;
  const regularHours = Math.max(0, round2(shiftHours - otHours - dtHours));

  const regularCost = round2(regularHours * hourlyRate);
  const otCost = trustStoredCosts && isPositive(entry.ot_cost) ? Number(entry.ot_cost) : round2(otHours * hourlyRate * 1.5);
  const dtCost = trustStoredCosts && isPositive(entry.dt_cost) ? Number(entry.dt_cost) : round2(dtHours * hourlyRate * 2.0);

  const benefitsRate =
    trustStoredCosts && isPositive(entry.benefits_rate)
      ? Number(entry.benefits_rate)
      : getLaborRoleBenefitsRate(role, activeCategories(categories));
  const benefitsCost =
    trustStoredCosts && isPositive(entry.benefits_cost) ? Number(entry.benefits_cost) : round2(shiftHours * benefitsRate);

  const computedTotal = round2(regularCost + otCost + dtCost + benefitsCost);
  const totalCost = trustStoredCosts && isPositive(entry.line_labor_cost) ? Number(entry.line_labor_cost) : computedTotal;

  return {
    role,
    hourlyRate,
    sourceHourlyRate,
    isOverridden: !trustStoredCosts,
    regularHours,
    otHours,
    dtHours,
    regularCost,
    otCost,
    dtCost,
    benefitsRate,
    benefitsCost,
    totalCost,
  };
};

/**
 * Effective cost of one shift, applying the employee's position override when present.
 * Rate precedence: override hourly rate, else the timesheet's hourly rate.
 */
export const computeLaborEntryCost = (entry: LaborEntryCostInput, ctx: LaborCalcContext): LaborCostBreakdown => {
  const override = getEmployeePositionOverride(entry.employee_name, ctx.employeePositions);
  if (override) {
    return priceLaborEntry(entry, {
      role: override.role_category,
      hourlyRate: Number(override.hourly_rate),
      categories: ctx.categories,
      trustStoredCosts: false,
    });
  }
  return priceLaborEntry(entry, {
    role: inferEntryRole(entry, ctx),
    hourlyRate: Number(entry.hourly_rate) || 0,
    categories: ctx.categories,
    trustStoredCosts: true,
  });
};
