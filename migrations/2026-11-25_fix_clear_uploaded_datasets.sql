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

    -- Each ID is a primary key. Explicitly select all rows for pg-safeupdate.
    DELETE FROM public.invoices WHERE id IS NOT NULL;
    DELETE FROM public.connecteam_labor_entries WHERE id IS NOT NULL;
    DELETE FROM public.work_orders WHERE id IS NOT NULL;
END;
$$;
