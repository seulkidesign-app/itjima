-- Run in Supabase SQL Editor if you already applied 20260705180000_admin_bootstrap.sql

CREATE OR REPLACE FUNCTION public.get_admin_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.user_roles WHERE role = 'admin';
$$;

REVOKE ALL ON FUNCTION public.get_admin_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_count() TO authenticated;
