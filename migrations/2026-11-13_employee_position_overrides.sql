-- ==============================================================================
-- MIGRATION: Employee Position & Labor Rate Overrides
-- Safe to run repeatedly. Requires public.labor_rate_categories and
-- public.current_user_role() from supabase_schema.sql.
-- ==============================================================================

-- 6.1 Table
-- Timesheet rows have no stable employee ID, only employee_name. employee_key is
-- the normalized name (trimmed, whitespace collapsed, lower-cased); the CHECK below
-- guarantees the key is always derived from the stored name the same way the app does
-- (normalizeEmployeeKey in src/utils/laborCost.ts), so two spellings of the same name
-- can never create two competing overrides.
CREATE TABLE IF NOT EXISTS public.employee_position_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_key TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    role_category TEXT NOT NULL,
    hourly_rate NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID DEFAULT auth.uid()
);

-- 6.2 Constraints (drop + add keeps the script repeatable)
ALTER TABLE public.employee_position_overrides
DROP CONSTRAINT IF EXISTS employee_position_overrides_employee_key_key;
ALTER TABLE public.employee_position_overrides
ADD CONSTRAINT employee_position_overrides_employee_key_key UNIQUE (employee_key);

ALTER TABLE public.employee_position_overrides
DROP CONSTRAINT IF EXISTS check_epo_employee_key_normalized;
ALTER TABLE public.employee_position_overrides
ADD CONSTRAINT check_epo_employee_key_normalized CHECK (
    employee_key <> ''
    AND employee_key = lower(regexp_replace(btrim(employee_name), '\s+', ' ', 'g'))
);

ALTER TABLE public.employee_position_overrides
DROP CONSTRAINT IF EXISTS check_epo_hourly_rate_range;
ALTER TABLE public.employee_position_overrides
ADD CONSTRAINT check_epo_hourly_rate_range CHECK (hourly_rate > 0 AND hourly_rate <= 1000);

-- Roles must be one of the existing labor rate categories (no duplicated role list).
ALTER TABLE public.employee_position_overrides
DROP CONSTRAINT IF EXISTS fk_epo_role_category;
ALTER TABLE public.employee_position_overrides
ADD CONSTRAINT fk_epo_role_category FOREIGN KEY (role_category)
    REFERENCES public.labor_rate_categories (category_name)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Supports joining overrides to labor entries by role in SQL reporting.
CREATE INDEX IF NOT EXISTS idx_epo_role_category ON public.employee_position_overrides (role_category);

-- 6.3 Audit trigger: server-controlled timestamps and author (clients cannot spoof them)
CREATE OR REPLACE FUNCTION public.set_employee_position_audit()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    NEW.updated_by := auth.uid();
    IF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
    ELSE
        NEW.created_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_position_audit ON public.employee_position_overrides;
CREATE TRIGGER trg_employee_position_audit
    BEFORE INSERT OR UPDATE ON public.employee_position_overrides
    FOR EACH ROW EXECUTE FUNCTION public.set_employee_position_audit();

-- 6.4 Row Level Security (same model as expense_overrides; Employees may read so their
-- role breakdown matches, but cannot write)
ALTER TABLE public.employee_position_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supervisor full employee_position_overrides" ON public.employee_position_overrides;
DROP POLICY IF EXISTS "Admin read write employee_position_overrides" ON public.employee_position_overrides;
DROP POLICY IF EXISTS "Employee read employee_position_overrides" ON public.employee_position_overrides;

CREATE POLICY "Supervisor full employee_position_overrides" ON public.employee_position_overrides
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

CREATE POLICY "Admin read write employee_position_overrides" ON public.employee_position_overrides
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

CREATE POLICY "Employee read employee_position_overrides" ON public.employee_position_overrides
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'Employee');
