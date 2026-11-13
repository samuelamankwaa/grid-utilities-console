import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { buildLaborCalcContext } from '../utils/laborCost';

export const selectWorkOrders = (state: RootState) => state.db.workOrders;
export const selectLaborEntries = (state: RootState) => state.db.laborEntries;
export const selectLaborRateCategories = (state: RootState) => state.db.laborRateCategories;
export const selectEmployeePositions = (state: RootState) => state.db.employeePositions;

/**
 * Memoized calculation context (work order lookup, crew rosters, rate card, employee
 * position overrides). Rebuilt only when one of those inputs changes, so saving an
 * override produces a new context and every consumer re-prices its entries.
 */
export const selectLaborCalcContext = createSelector(
  [selectWorkOrders, selectLaborRateCategories, selectEmployeePositions],
  buildLaborCalcContext
);
