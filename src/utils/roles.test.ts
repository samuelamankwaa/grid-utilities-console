import { describe, expect, it } from 'vitest';
import { classifyLaborRole, DEFAULT_LABOR_RATE_CATEGORIES, getLaborRoleBenefitsRate } from './helpers';
import { buildLaborCalcContext, computeLaborEntryCost, normalizeEmployeeKey } from './laborCost';
import { getRoleDisplayName } from '../components/Timesheet/timesheetHelpers';
import type { LaborEntry } from '../types/schemas';

const NEW_ROLES = [
  'Superintendent',
  'Operator',
  'Trench Digger',
  'Apprentice 1st Period',
  'Apprentice- 5th Period',
  'Apprentice- 7th Period',
  'Groundman- 1st Year',
  'Groundman- Thereafter',
];

describe('position-only roles', () => {
  it('are available as role categories, with no duplicate names', () => {
    const names = DEFAULT_LABOR_RATE_CATEGORIES.map((c) => c.category_name);
    NEW_ROLES.forEach((r) => expect(names).toContain(r));
    expect(names).not.toContain('Administrative Operations');
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses the requested hourly benefit rates', () => {
    expect(getLaborRoleBenefitsRate('Operator')).toBe(15.48);
    expect(getLaborRoleBenefitsRate('Trench Digger')).toBe(getLaborRoleBenefitsRate('Groundman'));
  });

  it('are never guessed from a timesheet rate', () => {
    expect(classifyLaborRole(53.72)).toBe('Journeyman');
    expect(classifyLaborRole(99.99)).toBe('unclassified');
  });

  it('price an assigned employee at the entered rate with $0 benefits until a benefits rate is set', () => {
    const entry = { employee_name: 'Pat Doe', shift_hours: 10, hourly_rate: 20 } as LaborEntry;
    const ctx = buildLaborCalcContext([], DEFAULT_LABOR_RATE_CATEGORIES, {
      [normalizeEmployeeKey('Pat Doe')]: {
        employee_key: normalizeEmployeeKey('Pat Doe'),
        employee_name: 'Pat Doe',
        role_category: 'Superintendent',
        hourly_rate: 60,
      },
    });
    const b = computeLaborEntryCost(entry, ctx);
    expect(b.role).toBe('Superintendent');
    expect(b.benefitsCost).toBe(0);
    expect(b.totalCost).toBe(8 * 60 + 2 * 60 * 1.5);
  });

  it('display under their own name', () => {
    expect(getRoleDisplayName('Trench Digger')).toBe('Trench Digger');
    expect(getRoleDisplayName('unclassified')).toBe('Unclassified Rate');
  });
});
