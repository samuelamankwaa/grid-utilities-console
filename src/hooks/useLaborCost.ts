import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectLaborCalcContext, selectLaborEntries } from '../store/selectors';
import { computeLaborEntryCost, LaborCalcContext, LaborCostBreakdown } from '../utils/laborCost';
import { LaborEntry } from '../types/schemas';

export type LaborBreakdownResolver = (entry: LaborEntry) => LaborCostBreakdown;

/**
 * Returns the shared calculation context and a resolver for per-entry cost breakdowns.
 * All loaded labor entries are priced once per (entries, context) pair; the result is
 * recomputed whenever entries, work orders, the rate card, or employee position
 * overrides change, so a saved override immediately re-prices every consumer.
 */
export const useLaborCost = (): { ctx: LaborCalcContext; getBreakdown: LaborBreakdownResolver } => {
  const ctx = useSelector(selectLaborCalcContext);
  const laborEntries = useSelector(selectLaborEntries);

  const breakdowns = useMemo(() => {
    const map = new Map<LaborEntry, LaborCostBreakdown>();
    laborEntries.forEach((e) => map.set(e, computeLaborEntryCost(e, ctx)));
    return map;
  }, [laborEntries, ctx]);

  const getBreakdown = useCallback<LaborBreakdownResolver>(
    (entry) => breakdowns.get(entry) ?? computeLaborEntryCost(entry, ctx),
    [breakdowns, ctx]
  );

  return { ctx, getBreakdown };
};
