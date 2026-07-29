-- Account-safe push subscription register/revoke (atomic, JWT-scoped).

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_platform text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_endpoint IS NULL OR length(trim(p_endpoint)) = 0 THEN
    RAISE EXCEPTION 'invalid_endpoint' USING ERRCODE = '22023';
  END IF;

  UPDATE public.push_subscriptions
  SET
    revoked_at = now(),
    updated_at = now()
  WHERE endpoint = p_endpoint
    AND user_id <> v_user_id
    AND revoked_at IS NULL;

  INSERT INTO public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    platform,
    revoked_at,
    failure_count,
    updated_at
  )
  VALUES (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_platform,
    NULL,
    0,
    now()
  )
  ON CONFLICT ON CONSTRAINT push_subscriptions_user_endpoint DO UPDATE
  SET
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    platform = EXCLUDED.platform,
    revoked_at = NULL,
    failure_count = 0,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_push_subscription(
  p_endpoint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_endpoint IS NULL OR length(trim(p_endpoint)) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.push_subscriptions
  SET
    revoked_at = now(),
    updated_at = now()
  WHERE endpoint = p_endpoint
    AND user_id = v_user_id
    AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_push_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_push_subscription(text) TO authenticated;

CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint_active
  ON public.push_subscriptions (endpoint)
  WHERE revoked_at IS NULL;

COMMENT ON FUNCTION public.register_push_subscription IS
  'Atomically claim a browser push endpoint for auth.uid(), revoking other users.';

COMMENT ON FUNCTION public.revoke_push_subscription IS
  'Revoke the authenticated user push subscription for the given endpoint.';

NOTIFY pgrst, 'reload schema';
