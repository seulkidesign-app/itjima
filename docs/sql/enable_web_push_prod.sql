-- enable_web_push_prod.sql
-- Safe, idempotent Web Push schema for production Supabase.
--
-- Creates ONLY:
--   public.reminder_status
--   public.push_subscriptions
--   public.scheduled_reminders
--   related indexes, RLS policies, claim_due_reminders()
--
-- Does NOT touch: inbox, schedules, archive, user_roles, or any existing data.
-- Does NOT use: DROP TABLE, TRUNCATE, DELETE.
--
-- Run manually in Supabase Dashboard → SQL Editor (or psql) as a privileged role.
-- See docs/WEB_PUSH_SETUP.md for Edge Function secrets and cron setup.
--
-- After this script succeeds, run docs/sql/enable_reminder_cron_prod.sql separately.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enum (create only when missing)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'reminder_status'
  ) THEN
    CREATE TYPE public.reminder_status AS ENUM (
      'pending',
      'processing',
      'sent',
      'cancelled',
      'failed'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. push_subscriptions (create only when missing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
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

CREATE INDEX IF NOT EXISTS push_subscriptions_user_active
  ON public.push_subscriptions (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push subscription keys per user/device.';

-- ---------------------------------------------------------------------------
-- 3. scheduled_reminders (create only when missing)
--    schedule_id is intentionally NOT a FK to schedules (supports server push test UUID).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
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

CREATE INDEX IF NOT EXISTS scheduled_reminders_due_pending
  ON public.scheduled_reminders (due_at_utc)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS scheduled_reminders_user_schedule
  ON public.scheduled_reminders (user_id, schedule_id);

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_reminders_select_own ON public.scheduled_reminders;
CREATE POLICY scheduled_reminders_select_own ON public.scheduled_reminders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS scheduled_reminders_insert_own ON public.scheduled_reminders;
CREATE POLICY scheduled_reminders_insert_own ON public.scheduled_reminders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS scheduled_reminders_update_own ON public.scheduled_reminders;
CREATE POLICY scheduled_reminders_update_own ON public.scheduled_reminders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.scheduled_reminders TO authenticated;
GRANT ALL ON public.scheduled_reminders TO service_role;

COMMENT ON TABLE public.scheduled_reminders IS
  'Server-side reminder queue; processed by process-reminders Edge Function.';

-- ---------------------------------------------------------------------------
-- 4. claim_due_reminders (service role only; used by process-reminders)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. Read-only verification (same transaction, before commit)
-- ---------------------------------------------------------------------------
SELECT
  'reminder_status enum' AS check_item,
  EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'reminder_status'
  ) AS ok;

SELECT
  table_name,
  'table exists' AS check_item,
  TRUE AS ok
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('push_subscriptions', 'scheduled_reminders')
ORDER BY table_name;

SELECT
  tablename,
  indexname,
  'index exists' AS check_item,
  TRUE AS ok
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('push_subscriptions', 'scheduled_reminders')
ORDER BY tablename, indexname;

SELECT
  tablename,
  policyname,
  cmd,
  'rls policy' AS check_item,
  TRUE AS ok
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('push_subscriptions', 'scheduled_reminders')
ORDER BY tablename, policyname;

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  'rls enabled' AS check_item,
  c.relrowsecurity AS ok
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('push_subscriptions', 'scheduled_reminders')
ORDER BY c.relname;

SELECT
  p.proname AS function_name,
  'claim_due_reminders exists' AS check_item,
  TRUE AS ok
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_due_reminders';

SELECT
  grantee,
  table_name,
  privilege_type,
  'table grant' AS check_item,
  TRUE AS ok
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('push_subscriptions', 'scheduled_reminders')
  AND grantee IN ('authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

COMMIT;
