import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

// In-memory stand-in for the Supabase client: records every upsert and returns
// whatever result the test configures.
const mock = vi.hoisted(() => ({
  calls: [] as { table: string; payload: unknown; options: unknown }[],
  result: { data: null as unknown, error: null as null | { message: string } },
}));

vi.mock('../utils/supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (payload: unknown, options: unknown) => {
        mock.calls.push({ table, payload, options });
        const res = { ...mock.result };
        return Object.assign(Promise.resolve({ error: res.error }), {
          select: () => ({ single: async () => res }),
        });
      },
    }),
  },
}));

import dbReducer, { saveEmployeePositionThunk, uploadTimesheetThunk } from './dbSlice';
import authReducer from './authSlice';
import filtersReducer from './filtersSlice';
import { selectLaborCalcContext } from './selectors';
import { computeLaborEntryCost } from '../utils/laborCost';
import { LaborEntry } from '../types/schemas';

const makeStore = (role: 'Supervisor' | 'Admin' | 'Employee') => {
  const store = configureStore({ reducer: { db: dbReducer, auth: authReducer, filters: filtersReducer } });
  // Seed the logged-in user directly (login itself is not under test).
  const auth = store.getState().auth;
  return configureStore({
    reducer: { db: dbReducer, auth: authReducer, filters: filtersReducer },
    preloadedState: {
      ...store.getState(),
      auth: {
        ...auth,
        isAuthenticated: true,
        currentUser: { id: 'u1', email: 'sup@example.com', name: 'Sup', role, createdAt: '2026-01-01' },
      },
    },
  });
};

const savedRow = (name: string, role: string, rate: number) => ({
  id: '00000000-0000-4000-8000-000000000001',
  employee_key: name.trim().replace(/\s+/g, ' ').toLowerCase(),
  employee_name: name,
  role_category: role,
  hourly_rate: rate,
  created_at: '2026-11-13T00:00:00Z',
  updated_at: '2026-11-13T00:00:00Z',
  updated_by: 'u1',
});

beforeEach(() => {
  mock.calls.length = 0;
  mock.result = { data: null, error: null };
});

describe('saveEmployeePositionThunk', () => {
  it('Scenario A: persists, then updates Redux and re-prices through the selector', async () => {
    const store = makeStore('Supervisor');
    mock.result = { data: savedRow('John Smith', 'General Foreman', 65), error: null };

    const action = await store.dispatch(
      saveEmployeePositionThunk({ employeeName: ' John  Smith ', roleCategory: 'General Foreman', hourlyRate: 65 })
    );
    expect(action.type).toBe(saveEmployeePositionThunk.fulfilled.type);

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].table).toBe('employee_position_overrides');
    expect(mock.calls[0].options).toEqual({ onConflict: 'employee_key' });
    expect(mock.calls[0].payload).toEqual({
      employee_key: 'john smith',
      employee_name: 'John Smith',
      role_category: 'General Foreman',
      hourly_rate: 65,
    });

    const ctx = selectLaborCalcContext(store.getState());
    const b = computeLaborEntryCost({ employee_name: 'John Smith', work_order_number: '1', shift_hours: 8, hourly_rate: 53.72 }, ctx);
    expect(b.role).toBe('General Foreman');
    expect(b.hourlyRate).toBe(65);
  });

  it('Scenario F: saving the same employee again updates the single existing entry', async () => {
    const store = makeStore('Admin');
    mock.result = { data: savedRow('John Smith', 'Journeyman', 53.72), error: null };
    await store.dispatch(saveEmployeePositionThunk({ employeeName: 'John Smith', roleCategory: 'Journeyman', hourlyRate: 53.72 }));
    mock.result = { data: savedRow('John Smith', 'Foreman', 60), error: null };
    await store.dispatch(saveEmployeePositionThunk({ employeeName: 'john smith', roleCategory: 'Foreman', hourlyRate: 60 }));

    const positions = store.getState().db.employeePositions;
    expect(Object.keys(positions)).toEqual(['john smith']);
    expect(positions['john smith'].role_category).toBe('Foreman');
    expect(mock.calls.every((c) => (c.payload as { employee_key: string }).employee_key === 'john smith')).toBe(true);
  });

  it('Scenario G: Employees are rejected before any database call', async () => {
    const store = makeStore('Employee');
    const action = await store.dispatch(
      saveEmployeePositionThunk({ employeeName: 'John Smith', roleCategory: 'Foreman', hourlyRate: 60 })
    );
    expect(action.type).toBe(saveEmployeePositionThunk.rejected.type);
    expect(action.payload).toMatch(/Supervisors and Admins/);
    expect(mock.calls).toHaveLength(0);
    expect(store.getState().db.employeePositions).toEqual({});
  });

  it('Scenario H: a database error rejects and leaves state unchanged', async () => {
    const store = makeStore('Supervisor');
    mock.result = { data: null, error: { message: 'new row violates row-level security policy' } };
    const action = await store.dispatch(
      saveEmployeePositionThunk({ employeeName: 'John Smith', roleCategory: 'Foreman', hourlyRate: 60 })
    );
    expect(action.type).toBe(saveEmployeePositionThunk.rejected.type);
    expect(action.payload).toMatch(/row-level security/);
    expect(store.getState().db.employeePositions).toEqual({});
  });

  it('rejects invalid roles and rates without calling the database', async () => {
    const store = makeStore('Supervisor');
    const badRole = await store.dispatch(saveEmployeePositionThunk({ employeeName: 'A B', roleCategory: 'Wizard', hourlyRate: 60 }));
    const badRate = await store.dispatch(saveEmployeePositionThunk({ employeeName: 'A B', roleCategory: 'Foreman', hourlyRate: -1 }));
    expect(badRole.type).toBe(saveEmployeePositionThunk.rejected.type);
    expect(badRate.type).toBe(saveEmployeePositionThunk.rejected.type);
    expect(mock.calls).toHaveLength(0);
  });
});

describe('Scenario E: timesheet upload with a saved assignment', () => {
  it('stores source values and applies the assignment at calculation time', async () => {
    const store = makeStore('Supervisor');
    mock.result = { data: savedRow('John Smith', 'General Foreman', 65), error: null };
    await store.dispatch(saveEmployeePositionThunk({ employeeName: 'John Smith', roleCategory: 'General Foreman', hourlyRate: 65 }));

    mock.result = { data: null, error: null };
    const uploaded = {
      work_order_number: '100',
      employee_name: 'John Smith',
      shift_date: '2026-08-10',
      shift_hours: 10,
      hourly_rate: 53.72,
      ot_hours: 2,
      ot_cost: 0,
      dt_hours: 0,
      dt_cost: 0,
      benefits_cost: 0,
      benefits_rate: 0,
      line_labor_cost: 0,
      role_category: 'Journeyman',
    } as LaborEntry;
    await store.dispatch(uploadTimesheetThunk([uploaded]));

    const persisted = mock.calls.find((c) => c.table === 'connecteam_labor_entries')!.payload as Record<string, number | string>[];
    expect(persisted[0].hourly_rate).toBe(53.72); // source rate kept for audit
    expect(persisted[0].line_labor_cost).toBe(829.82); // source cost: 429.76 + 161.16 + 238.90

    const stored = store.getState().db.laborEntries[0];
    const effective = computeLaborEntryCost(stored, selectLaborCalcContext(store.getState()));
    expect(effective.role).toBe('General Foreman');
    expect(effective.totalCost).toBe(967.2);
  });
});
