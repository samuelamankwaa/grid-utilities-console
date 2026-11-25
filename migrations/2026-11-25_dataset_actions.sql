BEGIN;

-- Fill in columns missing from databases that previously accepted the legacy upload payload.
ALTER TABLE public.connecteam_labor_entries
    ADD COLUMN IF NOT EXISTS start_date TEXT,
    ADD COLUMN IF NOT EXISTS end_date TEXT,
    ADD COLUMN IF NOT EXISTS dt_hours NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dt_cost NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS benefits_rate NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS benefits_cost NUMERIC NOT NULL DEFAULT 0;

-- The supported export has no persistent shift ID. Use the recorded shift and
-- payroll inputs as identity. Reclassification and derived costs do not affect it.
CREATE OR REPLACE FUNCTION public.connecteam_import_key(
    work_order_number TEXT, employee_name TEXT, shift_date TEXT, start_date TEXT, end_date TEXT,
    clock_in TEXT, clock_out TEXT, shift_hours NUMERIC, hourly_rate NUMERIC,
    ot_hours NUMERIC, dt_hours NUMERIC
)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
        btrim(work_order_number),
        lower(btrim(regexp_replace(employee_name, '\s+', ' ', 'g'))),
        btrim(shift_date),
        COALESCE(NULLIF(btrim(start_date), ''), btrim(shift_date)),
        COALESCE(NULLIF(btrim(end_date), ''), btrim(shift_date)),
        NULLIF(btrim(clock_in), ''),
        NULLIF(btrim(clock_out), ''),
        trim_scale(shift_hours), trim_scale(hourly_rate), trim_scale(ot_hours), trim_scale(dt_hours)
    )::text, 'UTF8')), 'hex');
$$;

ALTER TABLE public.connecteam_labor_entries
    ADD COLUMN IF NOT EXISTS import_key TEXT GENERATED ALWAYS AS (
        public.connecteam_import_key(work_order_number, employee_name, shift_date, start_date, end_date,
            clock_in, clock_out, shift_hours, hourly_rate, ot_hours, dt_hours)
    ) STORED;

-- Retain the most recent stored row for each matching shift. The ALTER TABLE
-- lock holds through COMMIT, so imports cannot race cleanup and index creation.
WITH ranked_entries AS (
    SELECT id, row_number() OVER (PARTITION BY import_key ORDER BY created_at DESC NULLS LAST, id) AS occurrence
    FROM public.connecteam_labor_entries
)
DELETE FROM public.connecteam_labor_entries AS entry
USING ranked_entries AS ranked
WHERE entry.id = ranked.id AND ranked.occurrence > 1;

CREATE UNIQUE INDEX IF NOT EXISTS connecteam_labor_entries_import_key_idx
    ON public.connecteam_labor_entries (import_key);

CREATE OR REPLACE FUNCTION public.import_connecteam_labor_entries(entries jsonb)
RETURNS SETOF public.connecteam_labor_entries
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF COALESCE(public.current_user_role(), '') NOT IN ('Supervisor', 'Admin') THEN
        RAISE EXCEPTION 'Only Supervisors and Admins can import timesheets.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.connecteam_labor_entries (
        work_order_number, employee_name, shift_date, start_date, end_date, clock_in, clock_out,
        shift_hours, hourly_rate, ot_hours, ot_cost, dt_hours, dt_cost,
        benefits_rate, benefits_cost, line_labor_cost, role_category
    )
    SELECT entry.work_order_number, entry.employee_name, entry.shift_date, entry.start_date, entry.end_date,
        entry.clock_in, entry.clock_out, entry.shift_hours, entry.hourly_rate, entry.ot_hours, entry.ot_cost,
        entry.dt_hours, entry.dt_cost, entry.benefits_rate, entry.benefits_cost, entry.line_labor_cost, entry.role_category
    FROM pg_catalog.jsonb_populate_recordset(NULL::public.connecteam_labor_entries, entries) AS entry
    -- Take unique-index locks in the same order for overlapping concurrent imports.
    ORDER BY public.connecteam_import_key(
        entry.work_order_number, entry.employee_name, entry.shift_date, entry.start_date, entry.end_date,
        entry.clock_in, entry.clock_out, entry.shift_hours, entry.hourly_rate, entry.ot_hours, entry.dt_hours
    )
    ON CONFLICT (import_key) DO NOTHING;

    -- A separate statement sees rows inserted by another upload that won a conflict.
    -- Return persisted matches on retries as well as new rows for the client cache.
    RETURN QUERY
    SELECT stored.*
    FROM public.connecteam_labor_entries AS stored
    JOIN (
        SELECT DISTINCT public.connecteam_import_key(
            entry.work_order_number, entry.employee_name, entry.shift_date, entry.start_date, entry.end_date,
            entry.clock_in, entry.clock_out, entry.shift_hours, entry.hourly_rate, entry.ot_hours, entry.dt_hours
        ) AS import_key
        FROM pg_catalog.jsonb_populate_recordset(NULL::public.connecteam_labor_entries, entries) AS entry
    ) AS uploaded ON stored.import_key = uploaded.import_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_uploaded_datasets()
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF COALESCE(public.current_user_role(), '') NOT IN ('Supervisor', 'Admin') THEN
        RAISE EXCEPTION 'Only Supervisors and Admins can clear uploaded data.' USING ERRCODE = '42501';
    END IF;

    LOCK TABLE public.work_orders, public.invoices, public.connecteam_labor_entries IN SHARE ROW EXCLUSIVE MODE;

    DELETE FROM public.invoices;
    DELETE FROM public.connecteam_labor_entries;
    DELETE FROM public.work_orders;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_connecteam_labor_entries(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_uploaded_datasets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_connecteam_labor_entries(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_uploaded_datasets() TO authenticated;

COMMIT;
