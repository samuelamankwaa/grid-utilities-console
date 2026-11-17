-- Adds the remaining crew positions to the role list so they can be chosen in
-- "Add Position" (employee_position_overrides.role_category references this table).
-- These roles have no published rate card yet, so their rates are NULL:
--   * the hourly rate is entered per employee in the Add Position modal;
--   * they are never used to guess a role from a timesheet rate;
--   * benefits are $0 until benefits_rate is filled in.
-- To set rates later: UPDATE public.labor_rate_categories SET standard_rate = ..., ot_rate = ...,
--   dt_rate = ..., benefits_rate = ... WHERE category_name = '...';
-- (and mirror the values in DEFAULT_LABOR_RATE_CATEGORIES in src/utils/helpers.ts).
-- Safe to run more than once; existing rows are left unchanged.

ALTER TABLE public.labor_rate_categories
  ALTER COLUMN standard_rate DROP NOT NULL;

INSERT INTO public.labor_rate_categories (category_name, standard_rate, ot_rate, dt_rate, benefits_rate, match_tolerance)
VALUES
    ('Superintendent', NULL, NULL, NULL, NULL, 0.20),
    ('Operator', NULL, NULL, NULL, NULL, 0.20),
    ('Trench Digger', NULL, NULL, NULL, NULL, 0.20),
    ('Apprentice 1st Period', NULL, NULL, NULL, NULL, 0.20),
    ('Apprentice- 5th Period', NULL, NULL, NULL, NULL, 0.20),
    ('Apprentice- 7th Period', NULL, NULL, NULL, NULL, 0.20),
    ('Groundman- 1st Year', NULL, NULL, NULL, NULL, 0.20),
    ('Groundman- Thereafter', NULL, NULL, NULL, NULL, 0.20),
    ('Administrative Operations', NULL, NULL, NULL, NULL, 0.20)
ON CONFLICT (category_name) DO NOTHING;
