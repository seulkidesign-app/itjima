-- Single-owner admin lockdown.
-- Existing admin rows are preserved. Production users can never self-promote
-- or grant/revoke admin roles from the client. Admin provisioning is an
-- explicit server/service-role operation.

REVOKE EXECUTE ON FUNCTION public.bootstrap_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_role(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_count() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.bootstrap_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_count() TO service_role;

-- Even an authenticated admin session must not mutate role assignments through
-- the public table API. This keeps the production admin identity server-managed.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM authenticated;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

-- Keep role reads minimal: users may read their own role; an existing admin may
-- read roles for operational checks. No client-side role mutation policy exists.
DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
