-- Web Push subscriptions and server-scheduled reminders (closed-app delivery).

CREATE TYPE public.reminder_status AS ENUM (
  'pending',
  'processing',
  'sent',
  'cancelled',
  'failed'
);

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE INDEX push_subscriptions_user_active
  ON public.push_subscriptions (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

CREATE TABLE public.scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL,
  due_at_utc TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status public.reminder_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_reminders_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX scheduled_reminders_due_pending
  ON public.scheduled_reminders (due_at_utc)
  WHERE status = 'pending';

CREATE INDEX scheduled_reminders_user_schedule
  ON public.scheduled_reminders (user_id, schedule_id);

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_reminders_select_own ON public.scheduled_reminders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY scheduled_reminders_insert_own ON public.scheduled_reminders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY scheduled_reminders_update_own ON public.scheduled_reminders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.scheduled_reminders TO authenticated;
GRANT ALL ON public.scheduled_reminders TO service_role;

-- Atomically claim due reminders (service role only).
CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_batch_size INT DEFAULT 50)
RETURNS SETOF public.scheduled_reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scheduled_reminders AS sr
  SET
    status = 'processing',
    attempt_count = sr.attempt_count + 1,
    updated_at = now()
  WHERE sr.id IN (
    SELECT r.id
    FROM public.scheduled_reminders AS r
    WHERE r.status = 'pending'
      AND r.due_at_utc <= now()
    ORDER BY r.due_at_utc ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING sr.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_reminders(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(INT) TO service_role;

COMMENT ON TABLE public.push_subscriptions IS 'Web Push subscription keys per user/device.';
COMMENT ON TABLE public.scheduled_reminders IS 'Server-side reminder queue; processed by process-reminders Edge Function.';
