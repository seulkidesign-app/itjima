-- Admin access: idempotent bootstrap + reliable self-role check (RLS-safe via SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.bootstrap_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  IF admin_count > 0 THEN
    RAISE EXCEPTION 'Admin already exists';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin_total int;
  i_am_admin boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'is_admin', false,
      'admin_count', 0
    );
  END IF;

  SELECT COUNT(*)::int INTO admin_total
  FROM public.user_roles
  WHERE role = 'admin';

  i_am_admin := public.has_role(uid, 'admin');

  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', uid,
    'is_admin', i_am_admin,
    'admin_count', admin_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_admin_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_admin_status() TO authenticated;
