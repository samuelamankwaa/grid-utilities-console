import { LaborEntry, LaborRateCategory, WorkOrder } from '../../types/schemas';
import {
  classifyLaborRole,
  getLaborRoleBenefitsRate,
  DEFAULT_LABOR_RATE_CATEGORIES,
} from '../../utils/helpers';

// Extract Overtime hours from entry
export const getEntryOtHours = (e: LaborEntry): number => {
  if (e.ot_hours !== undefined && e.ot_hours !== null && !isNaN(Number(e.ot_hours))) {
    return Number(e.ot_hours);
  }
  return e.shift_hours > 8 ? parseFloat((e.shift_hours - 8).toFixed(2)) : 0;
};

// Calculate Overtime cost (1.5x standard hourly rate)
export const getEntryOtCost = (e: LaborEntry): number => {
  if (e.ot_cost !== undefined && e.ot_cost !== null && !isNaN(Number(e.ot_cost)) && Number(e.ot_cost) > 0) {
    return Number(e.ot_cost);
  }
  const otH = getEntryOtHours(e);
  return parseFloat((otH * e.hourly_rate * 1.5).toFixed(2));
};

// Extract Double Time hours from entry
export const getEntryDtHours = (e: LaborEntry): number => {
  if (e.dt_hours !== undefined && e.dt_hours !== null && !isNaN(Number(e.dt_hours))) {
    return Number(e.dt_hours);
  }
  return 0;
};

// Calculate Double Time cost (2.0x standard hourly rate)
export const getEntryDtCost = (e: LaborEntry): number => {
  if (e.dt_cost !== undefined && e.dt_cost !== null && !isNaN(Number(e.dt_cost)) && Number(e.dt_cost) > 0) {
    return Number(e.dt_cost);
  }
  const dtH = getEntryDtHours(e);
  return parseFloat((dtH * e.hourly_rate * 2.0).toFixed(2));
};

// Classify shift role against company rosters and rate schedules
export const getEntryRole = (
  entry: LaborEntry,
  woMap: Map<string, WorkOrder>,
  laborRateCategories: LaborRateCategory[],
  gfNamesSet: Set<string>,
  foremanNamesSet: Set<string>
): string => {
  const wo = woMap.get(String(entry.work_order_number || '').trim());
  return classifyLaborRole(
    entry.hourly_rate,
    laborRateCategories && laborRateCategories.length > 0 ? laborRateCategories : DEFAULT_LABOR_RATE_CATEGORIES,
    entry.employee_name,
    wo,
    gfNamesSet,
    foremanNamesSet
  );
};

// Calculate hourly benefits cost for an entry
export const getEntryBenefitsCost = (
  e: LaborEntry,
  woMap: Map<string, WorkOrder>,
  laborRateCategories: LaborRateCategory[],
  gfNamesSet: Set<string>,
  foremanNamesSet: Set<string>
): number => {
  if (e.benefits_cost !== undefined && e.benefits_cost !== null && !isNaN(Number(e.benefits_cost)) && Number(e.benefits_cost) > 0) {
    return Number(e.benefits_cost);
  }
  const role = getEntryRole(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
  const bRate = e.benefits_rate || getLaborRoleBenefitsRate(role, laborRateCategories);
  return parseFloat((e.shift_hours * bRate).toFixed(2));
};

// Compute regular working hours (Shift Hours - OT - DT)
export const getEntryRegularHours = (e: LaborEntry): number => {
  const otH = getEntryOtHours(e);
  const dtH = getEntryDtHours(e);
  return Math.max(0, parseFloat((e.shift_hours - otH - dtH).toFixed(2)));
};

// Compute regular wage cost
export const getEntryRegularCost = (e: LaborEntry): number => {
  const regH = getEntryRegularHours(e);
  return parseFloat((regH * e.hourly_rate).toFixed(2));
};

// Compute complete comprehensive labor cost (Regular + OT + DT + Benefits)
export const getEntryLaborCost = (
  e: LaborEntry,
  woMap: Map<string, WorkOrder>,
  laborRateCategories: LaborRateCategory[],
  gfNamesSet: Set<string>,
  foremanNamesSet: Set<string>
): number => {
  if (e.line_labor_cost !== undefined && e.line_labor_cost !== null && !isNaN(Number(e.line_labor_cost)) && Number(e.line_labor_cost) > 0) {
    return Number(e.line_labor_cost);
  }
  const regCost = getEntryRegularCost(e);
  const otCost = getEntryOtCost(e);
  const dtCost = getEntryDtCost(e);
  const benefitsCost = getEntryBenefitsCost(e, woMap, laborRateCategories, gfNamesSet, foremanNamesSet);
  return parseFloat((regCost + otCost + dtCost + benefitsCost).toFixed(2));
};

export const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'General Foreman':
    case 'GForeman':
      return 'General Foreman';
    case 'Foreman':
      return 'Foreman';
    case 'Journeyman':
      return 'Journeyman Lineman';
    case 'Pole Truck Driver':
      return 'Pole Truck Driver';
    case 'Apprentice':
      return 'Apprentice Lineman';
    case 'Groundman':
      return 'Groundman';
    case 'Pole Truck Helper':
      return 'Pole Truck Helper';
    case 'unclassified':
    default:
      return 'Unclassified Rate';
  }
};

export const getRoleCategoryBadge = (role: string): string => {
  switch (role) {
    case 'General Foreman':
    case 'GForeman':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Foreman':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Journeyman':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Pole Truck Driver':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Apprentice':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Groundman':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Pole Truck Helper':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'unclassified':
    default:
      return 'bg-red-50 text-red-700 border-red-200 font-semibold';
  }
};
