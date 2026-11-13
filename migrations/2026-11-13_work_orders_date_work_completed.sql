-- Persist the Fulcrum completion date on work orders.
-- The column is in supabase_schema.sql, but older databases may not have it.
-- Safe to run more than once.
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS date_work_completed TEXT;

-- Make PostgREST pick up the column immediately.
NOTIFY pgrst, 'reload schema';
