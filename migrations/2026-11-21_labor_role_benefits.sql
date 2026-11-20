BEGIN;

UPDATE public.labor_rate_categories
SET benefits_rate = 15.48
WHERE category_name = 'Operator';

UPDATE public.labor_rate_categories AS trench_digger
SET benefits_rate = groundman.benefits_rate
FROM public.labor_rate_categories AS groundman
WHERE trench_digger.category_name = 'Trench Digger'
  AND groundman.category_name = 'Groundman';

-- Preserve existing employee assignments when retiring the position.
DELETE FROM public.labor_rate_categories AS category
WHERE category.category_name = 'Administrative Operations'
  AND NOT EXISTS (
    SELECT 1
    FROM public.employee_position_overrides AS assignment
    WHERE assignment.role_category = category.category_name
  );

COMMIT;
