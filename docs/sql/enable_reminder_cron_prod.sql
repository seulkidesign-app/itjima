-- enable_reminder_cron_prod.sql
-- Schedules pg_cron → process-reminders Edge Function (every minute).
--
-- Prerequisites (run BEFORE this script):
--   1. docs/sql/enable_web_push_prod.sql applied successfully
--   2. Edge Function process-reminders deployed with CRON_SECRET set
--   3. Vault secrets created (see docs/WEB_PUSH_SETUP.md):
--        project_url  → https://<project-ref>.supabase.co
--        cron_secret  → same value as CRON_SECRET on the Edge Function
--
-- Does NOT touch: inbox, schedules, archive, user_roles, or any app tables.
-- Does NOT use: DROP TABLE, TRUNCATE, DELETE.
--
-- Run manually in Supabase Dashboard → SQL Editor (or psql) as a privileged role.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 2. Vault secret guard — abort before creating cron if secrets are missing
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_secrets text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing_secrets
  FROM (
    VALUES
      ('project_url'),
      ('cron_secret')
  ) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets AS ds
    WHERE ds.name = required.name
      AND ds.decrypted_secret IS NOT NULL
      AND btrim(ds.decrypted_secret) <> ''
  );

  IF missing_secrets IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enable reminder cron: missing or empty Vault secret(s): %. '
      'Create them first, e.g. '
      'SELECT vault.create_secret(''https://<project-ref>.supabase.co'', ''project_url''); '
      'SELECT vault.create_secret(''<CRON_SECRET>'', ''cron_secret''); '
      'See docs/WEB_PUSH_SETUP.md',
      array_to_string(missing_secrets, ', ');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Idempotent reschedule: remove prior job with the same name
-- ---------------------------------------------------------------------------
SELECT cron.unschedule(job.jobid)
FROM cron.job AS job
WHERE job.jobname = 'process-reminders';

-- ---------------------------------------------------------------------------
-- 4. Schedule process-reminders every minute (x-cron-secret header)
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'process-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'project_url'
    ) || '/functions/v1/process-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Invokes process-reminders Edge Function for closed-app Web Push delivery.';

-- ---------------------------------------------------------------------------
-- 5. Read-only verification (same transaction, before commit)
-- ---------------------------------------------------------------------------
SELECT
  extname,
  extversion,
  'extension enabled' AS check_item,
  TRUE AS ok
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net')
ORDER BY extname;

SELECT
  name,
  'vault secret present' AS check_item,
  TRUE AS ok
FROM vault.decrypted_secrets
WHERE name IN ('project_url', 'cron_secret')
ORDER BY name;

SELECT
  jobid,
  jobname,
  schedule,
  active,
  'cron job registered' AS check_item,
  TRUE AS ok
FROM cron.job
WHERE jobname = 'process-reminders';

SELECT
  d.jobid,
  d.runid,
  d.status,
  d.start_time,
  d.end_time,
  d.return_message,
  'recent cron run (may be empty until first minute)' AS check_item
FROM cron.job_run_details AS d
WHERE d.jobid = (
  SELECT j.jobid
  FROM cron.job AS j
  WHERE j.jobname = 'process-reminders'
  LIMIT 1
)
ORDER BY d.start_time DESC
LIMIT 10;

COMMIT;
