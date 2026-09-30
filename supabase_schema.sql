-- ==============================================================================
-- POWER GRID UTILITIES CONSOLE: COMPLETE DATABASE INITIALIZATION SCHEMA
-- Run this in your Supabase SQL Editor for a fresh or existing database.
-- ==============================================================================

-- Enable required UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CREATE CORE TABLES
-- ==============================================================================

-- 1.1 Work Orders Table
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'Work Pending',
    general_foreman TEXT DEFAULT 'Unassigned GF',
    foreman TEXT DEFAULT 'Unassigned Foreman',
    address TEXT DEFAULT 'Pending Location',
    area TEXT DEFAULT 'HOUSTON',
    latitude NUMERIC DEFAULT 29.7604,
    longitude NUMERIC DEFAULT -95.3698,
    customer_need_date TEXT,
    date_locates_called_in TEXT,
    locate_ticket_number TEXT,
    expiration_date TEXT,
    locate_renewal_date TEXT,
    renewal_expiration_date TEXT,
    date_work_completed TEXT,
    switching_required BOOLEAN DEFAULT FALSE,
    outage_required BOOLEAN DEFAULT FALSE,
    outage_notes TEXT,
    permitting_needed BOOLEAN DEFAULT FALSE,
    locked_gates BOOLEAN DEFAULT FALSE,
    traffic_control_needed BOOLEAN DEFAULT FALSE,
    traffic_control_notes TEXT,
    hydrovac_needed BOOLEAN DEFAULT FALSE,
    hydrovac_notes TEXT,
    tree_trimming_needed BOOLEAN DEFAULT FALSE,
    post_construction_asbuilt TEXT,
    post_construction_notes TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    work_order_number TEXT,
    status TEXT NOT NULL DEFAULT 'Unapproved',
    po_number TEXT DEFAULT '',
    total NUMERIC NOT NULL DEFAULT 0,
    created_date TEXT,
    unanswered_comments BOOLEAN DEFAULT FALSE,
    dispute_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Connecteam Labor Entries Table
CREATE TABLE IF NOT EXISTS public.connecteam_labor_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    shift_date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    shift_hours NUMERIC NOT NULL DEFAULT 0,
    hourly_rate NUMERIC NOT NULL DEFAULT 0,
    ot_hours NUMERIC NOT NULL DEFAULT 0,
    ot_cost NUMERIC NOT NULL DEFAULT 0,
    dt_hours NUMERIC NOT NULL DEFAULT 0,
    dt_cost NUMERIC NOT NULL DEFAULT 0,
    benefits_cost NUMERIC NOT NULL DEFAULT 0,
    benefits_rate NUMERIC NOT NULL DEFAULT 0,
    line_labor_cost NUMERIC NOT NULL DEFAULT 0,
    role_category TEXT NOT NULL DEFAULT 'unclassified',
    start_date TEXT,
    end_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Labor Rate Categories Table
CREATE TABLE IF NOT EXISTS public.labor_rate_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL UNIQUE,
    standard_rate NUMERIC NOT NULL,
    ot_rate NUMERIC,
    dt_rate NUMERIC,
    benefits_rate NUMERIC,
    match_tolerance NUMERIC NOT NULL DEFAULT 0.20,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Expense Overrides Table
CREATE TABLE IF NOT EXISTS public.expense_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_fingerprint TEXT NOT NULL UNIQUE,
    add_amount NUMERIC NOT NULL DEFAULT 0,
    remove_amount NUMERIC NOT NULL DEFAULT 0,
    profit_margin_override NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.6 User Profiles Table (Auth Sync)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    role TEXT DEFAULT 'Employee',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. SEED DEFAULT LABOR RATE CATEGORIES
-- ==============================================================================
INSERT INTO public.labor_rate_categories (category_name, standard_rate, ot_rate, dt_rate, benefits_rate, match_tolerance)
VALUES 
    ('General Foreman', 58.49, 87.74, 116.98, 25.22, 0.20),
    ('Foreman', 57.30, 85.95, 114.60, 24.90, 0.20),
    ('Journeyman', 53.72, 80.58, 107.44, 23.89, 0.20),
    ('Pole Truck Driver', 40.23, 60.35, 80.46, 18.56, 0.20),
    ('Apprentice', 37.60, 56.40, 75.20, 15.48, 0.20),
    ('Groundman', 26.94, 40.41, 53.88, 14.66, 0.20),
    ('Pole Truck Helper', 15.00, 22.50, 30.00, 9.48, 0.20)
ON CONFLICT (category_name) DO UPDATE 
SET standard_rate = EXCLUDED.standard_rate,
    ot_rate = EXCLUDED.ot_rate,
    dt_rate = EXCLUDED.dt_rate,
    benefits_rate = EXCLUDED.benefits_rate,
    match_tolerance = EXCLUDED.match_tolerance;

-- ==============================================================================
-- 3. FINANCIAL INTEGRITY LAYER: POSTGRES CHECK CONSTRAINTS
-- ==============================================================================
ALTER TABLE IF EXISTS public.invoices
DROP CONSTRAINT IF EXISTS check_invoices_total_positive;
ALTER TABLE IF EXISTS public.invoices
ADD CONSTRAINT check_invoices_total_positive CHECK (total >= 0);

ALTER TABLE IF EXISTS public.invoices
DROP CONSTRAINT IF EXISTS check_invoices_status_valid;
ALTER TABLE IF EXISTS public.invoices
ADD CONSTRAINT check_invoices_status_valid CHECK (
    status IN ('Approved', 'Unapproved', 'Draft', 'Pending Approval', 'Voided', 'Disputed')
);

ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_hourly_rate_positive;
ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_hourly_rate_positive CHECK (hourly_rate >= 0);

ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_shift_hours_positive;
ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_shift_hours_positive CHECK (shift_hours >= 0);

ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_ot_hours_positive;
ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_ot_hours_positive CHECK (ot_hours >= 0);

ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_dt_hours_positive;
ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_dt_hours_positive CHECK (dt_hours >= 0);

-- ==============================================================================
-- 4. SERVER-SIDE AGGREGATION VIEW
-- ==============================================================================
CREATE OR REPLACE VIEW public.v_work_order_profit_margin AS
SELECT 
    w.work_order_number,
    w.status AS wo_status,
    w.general_foreman,
    w.foreman,
    w.area,
    w.address,
    w.customer_need_date,
    w.date_work_completed,
    COALESCE(inv.total_invoiced, 0) AS total_invoiced,
    COALESCE(inv.invoice_count, 0) AS invoice_count,
    COALESCE(lab.total_labor_cost, 0) AS total_labor_cost,
    COALESCE(lab.total_shift_hours, 0) AS total_shift_hours,
    (COALESCE(inv.total_invoiced, 0) - COALESCE(lab.total_labor_cost, 0)) AS gross_margin,
    CASE 
        WHEN COALESCE(inv.total_invoiced, 0) > 0 
        THEN ROUND((((COALESCE(inv.total_invoiced, 0) - COALESCE(lab.total_labor_cost, 0)) / inv.total_invoiced) * 100)::numeric, 2)
        ELSE 0 
    END AS profit_margin_pct
FROM public.work_orders w
LEFT JOIN (
    SELECT work_order_number, SUM(total) AS total_invoiced, COUNT(*) AS invoice_count
    FROM public.invoices
    GROUP BY work_order_number
) inv ON w.work_order_number = inv.work_order_number
LEFT JOIN (
    SELECT work_order_number, SUM(line_labor_cost) AS total_labor_cost, SUM(shift_hours) AS total_shift_hours
    FROM public.connecteam_labor_entries
    GROUP BY work_order_number
) lab ON w.work_order_number = lab.work_order_number;

-- ==============================================================================
-- 5. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connecteam_labor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rate_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to extract user role from JWT token
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claim.user_metadata', true)::jsonb ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role',
        'Employee'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN 'Employee';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5.1 Work Orders Policies
DROP POLICY IF EXISTS "Allow public all work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Supervisor full work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Admin read write work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Employee read work_orders" ON public.work_orders;

CREATE POLICY "Supervisor full work_orders" ON public.work_orders
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

CREATE POLICY "Admin read write work_orders" ON public.work_orders
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

CREATE POLICY "Employee read work_orders" ON public.work_orders
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'Employee');

-- 5.2 Invoices Policies (Employees Denied)
DROP POLICY IF EXISTS "Allow public all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Supervisor full invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin read write invoices" ON public.invoices;

CREATE POLICY "Supervisor full invoices" ON public.invoices
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

CREATE POLICY "Admin read write invoices" ON public.invoices
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

-- 5.3 Connecteam Labor Entries Policies
DROP POLICY IF EXISTS "Allow public all connecteam_labor_entries" ON public.connecteam_labor_entries;
DROP POLICY IF EXISTS "Supervisor full labor_entries" ON public.connecteam_labor_entries;
DROP POLICY IF EXISTS "Admin read write labor_entries" ON public.connecteam_labor_entries;
DROP POLICY IF EXISTS "Employee read labor_entries" ON public.connecteam_labor_entries;

CREATE POLICY "Supervisor full labor_entries" ON public.connecteam_labor_entries
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

CREATE POLICY "Admin read write labor_entries" ON public.connecteam_labor_entries
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

CREATE POLICY "Employee read labor_entries" ON public.connecteam_labor_entries
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'Employee');

-- 5.4 Labor Rate Categories Policies
DROP POLICY IF EXISTS "Allow public all labor_rate_categories" ON public.labor_rate_categories;
DROP POLICY IF EXISTS "Supervisor full labor_rate_categories" ON public.labor_rate_categories;
DROP POLICY IF EXISTS "Admin Employee read labor_rate_categories" ON public.labor_rate_categories;

CREATE POLICY "Supervisor full labor_rate_categories" ON public.labor_rate_categories
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

CREATE POLICY "Admin Employee read labor_rate_categories" ON public.labor_rate_categories
    FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('Admin', 'Employee'));

-- 5.5 Expense Overrides Policies
DROP POLICY IF EXISTS "Allow public all expense_overrides" ON public.expense_overrides;
DROP POLICY IF EXISTS "Supervisor full expense_overrides" ON public.expense_overrides;
DROP POLICY IF EXISTS "Admin read write expense_overrides" ON public.expense_overrides;

CREATE POLICY "Supervisor full expense_overrides" ON public.expense_overrides
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

CREATE POLICY "Admin read write expense_overrides" ON public.expense_overrides
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

-- 5.6 Profiles Policies
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated write profile" ON public.profiles;

CREATE POLICY "Allow authenticated read profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated write profile" ON public.profiles
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
