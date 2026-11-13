import { describe, expect, it } from 'vitest';
import {
  buildLaborCalcContext,
  computeLaborEntryCost,
  normalizeEmployeeKey,
  priceLaborEntry,
  resolveEntryRole,
  validateHourlyRateInput,
  EmployeePositionMap,
  LaborEntryCostInput,
} from './laborCost';
import { DEFAULT_LABOR_RATE_CATEGORIES } from './helpers';
import { WorkOrder } from '../types/schemas';

const workOrders = [
  { work_order_number: '100', general_foreman: 'Marlon Davis', foreman: 'Derek Mills' },
] as WorkOrder[];

const override = (name: string, role: string, rate: number): EmployeePositionMap => ({
  [normalizeEmployeeKey(name)]: {
    employee_key: normalizeEmployeeKey(name),
    employee_name: name,
    role_category: role,
    hourly_rate: rate,
  },
});

const ctxWith = (positions: EmployeePositionMap = {}) =>
  buildLaborCalcContext(workOrders, DEFAULT_LABOR_RATE_CATEGORIES, positions);

// A Journeyman-rate shift with stored (source) costs from the upload.
const johnShift: LaborEntryCostInput = {
  employee_name: 'John Smith',
  work_order_number: '100',
  shift_hours: 10,
  hourly_rate: 53.72,
  ot_hours: 2,
  ot_cost: 161.16,
  dt_hours: 0,
  dt_cost: 0,
  benefits_rate: 23.89,
  benefits_cost: 238.9,
  line_labor_cost: 828.82,
  role_category: 'Journeyman',
};

describe('employee identity', () => {
  it('normalizes whitespace and case only', () => {
    expect(normalizeEmployeeKey('  John   SMITH ')).toBe('john smith');
    expect(normalizeEmployeeKey('John Smithson')).not.toBe(normalizeEmployeeKey('John Smith'));
    expect(normalizeEmployeeKey('')).toBe('');
  });
});

describe('Scenario A: new assignment', () => {
  it('prices every shift with the assigned role and rate, ignoring stale stored costs', () => {
    const b = computeLaborEntryCost(johnShift, ctxWith(override('John Smith', 'General Foreman', 65)));
    expect(b.role).toBe('General Foreman');
    expect(b.isOverridden).toBe(true);
    expect(b.hourlyRate).toBe(65);
    expect(b.sourceHourlyRate).toBe(53.72);
    expect(b.regularHours).toBe(8);
    expect(b.regularCost).toBe(520);
    expect(b.otCost).toBe(195); // 2 × 65 × 1.5
    expect(b.dtCost).toBe(0);
    expect(b.benefitsRate).toBe(25.22); // General Foreman benefits rate
    expect(b.benefitsCost).toBe(252.2);
    expect(b.totalCost).toBe(967.2);
  });

  it('applies to future (not yet stored) shifts with no stored costs', () => {
    const fresh: LaborEntryCostInput = { employee_name: 'john smith', work_order_number: '999', shift_hours: 8, hourly_rate: 20 };
    const b = computeLaborEntryCost(fresh, ctxWith(override('John Smith', 'General Foreman', 65)));
    expect(b.totalCost).toBe(8 * 65 + 8 * 25.22);
  });
});

describe('Scenario B: change position', () => {
  it('changes role and benefits rate, keeping the rate', () => {
    const asJourneyman = computeLaborEntryCost(johnShift, ctxWith(override('John Smith', 'Journeyman', 53.72)));
    const asForeman = computeLaborEntryCost(johnShift, ctxWith(override('John Smith', 'Foreman', 53.72)));
    expect(asJourneyman.role).toBe('Journeyman');
    expect(asForeman.role).toBe('Foreman');
    expect(asForeman.benefitsCost).toBe(249); // 10 × 24.90
    expect(asForeman.totalCost - asJourneyman.totalCost).toBeCloseTo(249 - 238.9, 2);
  });
});

describe('Scenario C: change labor rate', () => {
  it('recalculates regular, OT, DT, benefits and total', () => {
    const shift: LaborEntryCostInput = { ...johnShift, shift_hours: 10, ot_hours: 1.5, dt_hours: 1, dt_cost: 107.44 };
    const b = computeLaborEntryCost(shift, ctxWith(override('John Smith', 'Journeyman', 60)));
    expect(b.regularHours).toBe(7.5);
    expect(b.regularCost).toBe(450);
    expect(b.otCost).toBe(135);
    expect(b.dtCost).toBe(120);
    expect(b.benefitsCost).toBe(238.9);
    expect(b.totalCost).toBe(943.9);
  });
});

describe('Scenario D: employee without override', () => {
  it('keeps stored source costs and automatic classification', () => {
    const b = computeLaborEntryCost(johnShift, ctxWith());
    expect(b.isOverridden).toBe(false);
    expect(b.role).toBe('Journeyman');
    expect(b.hourlyRate).toBe(53.72);
    expect(b.totalCost).toBe(828.82);
  });

  it('computes the legacy formula when no costs are stored', () => {
    const shift: LaborEntryCostInput = { employee_name: 'Ana Ruiz', work_order_number: '100', shift_hours: 9, hourly_rate: 40.23, ot_hours: 2 };
    const b = computeLaborEntryCost(shift, ctxWith());
    expect(b.role).toBe('Pole Truck Driver');
    expect(b.regularCost).toBe(281.61);
    expect(b.otCost).toBe(120.69);
    expect(b.benefitsCost).toBe(167.04);
    expect(b.totalCost).toBe(569.34);
  });

  it('still uses crew assignment before rate matching', () => {
    const derek = { ...johnShift, employee_name: 'Derek Mills' };
    expect(resolveEntryRole(derek, ctxWith())).toBe('Foreman');
  });
});

describe('Override precedence', () => {
  it('beats crew-based classification', () => {
    const derek = { ...johnShift, employee_name: 'Derek Mills' };
    expect(resolveEntryRole(derek, ctxWith(override('Derek Mills', 'Groundman', 30)))).toBe('Groundman');
  });
});

describe('Scenario E: upload persistence stays source data', () => {
  it('priceLaborEntry in source mode reproduces the legacy upload calculation', () => {
    const raw: LaborEntryCostInput = { employee_name: 'John Smith', work_order_number: '100', shift_hours: 10, hourly_rate: 53.72, ot_hours: 2 };
    const source = priceLaborEntry(raw, {
      role: 'Journeyman',
      hourlyRate: 53.72,
      categories: DEFAULT_LABOR_RATE_CATEGORIES,
      trustStoredCosts: true,
    });
    // regular 8 × 53.72 + OT 2 × 53.72 × 1.5 + benefits 10 × 23.89
    expect(source.totalCost).toBe(829.82);
    expect(source.isOverridden).toBe(false);
  });
});

describe('Scenario I: similar names', () => {
  const ctx = ctxWith(override('John Smith', 'General Foreman', 65));
  it.each(['John Smithson', 'Jon Smith', 'John Smith Jr', 'Johnsmith'])('does not affect %s', (name) => {
    const b = computeLaborEntryCost({ ...johnShift, employee_name: name }, ctx);
    expect(b.isOverridden).toBe(false);
    expect(b.totalCost).toBe(828.82);
  });
  it('does match the same name with different spacing/case', () => {
    expect(computeLaborEntryCost({ ...johnShift, employee_name: '  JOHN  smith ' }, ctx).isOverridden).toBe(true);
  });
});

describe('validateHourlyRateInput', () => {
  it.each([
    ['', 'required'],
    ['-5', 'negative'],
    ['abc', 'valid amount'],
    ['1.234', 'valid amount'],
    ['0', 'greater than'],
    ['1000.01', 'exceed'],
  ])('rejects %j', (input, fragment) => {
    expect(validateHourlyRateInput(input)).toContain(fragment);
  });
  it.each(['65', '65.5', '65.00', '.5', '1000'])('accepts %j', (input) => {
    expect(validateHourlyRateInput(input)).toBe('');
  });
});
