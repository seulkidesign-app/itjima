-- pg_cron job to invoke process-reminders Edge Function every minute.
-- Requires pg_cron + pg_net (enabled on Supabase hosted projects).
-- Before this job runs, create Vault secrets once (see docs/WEB_PUSH_SETUP.md):
--   project_url  -> https://<project-ref>.supabase.co
--   cron_secret  -> same value as CRON_SECRET Edge Function secret

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Idempotent: remove prior job if re-run
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-reminders';

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

COMMENT ON EXTENSION pg_cron IS 'Invokes process-reminders Edge Function for closed-app Web Push delivery.';
