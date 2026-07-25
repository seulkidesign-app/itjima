-- pg_cron job to invoke process-reminders Edge Function every minute.
-- Requires pg_cron + pg_net (enabled on Supabase hosted projects).
-- Set CRON_SECRET in Edge Function secrets and replace YOUR_PROJECT_REF below.

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
    url := 'https://qikgvovbzliqcfcfgvcd.supabase.co/functions/v1/process-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Invokes process-reminders Edge Function for closed-app Web Push delivery.';
