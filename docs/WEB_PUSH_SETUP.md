# Web Push closed-app reminders

## Architecture

1. Client registers push subscription → `push_subscriptions` (RLS: own rows only)
2. Schedule alarm set/edit → `scheduled_reminders` upsert via `syncScheduleReminder`
3. pg_cron → `process-reminders` Edge Function every minute
4. Edge Function claims due rows atomically (`claim_due_reminders`) and sends Web Push
5. Service worker handles `push` + `notificationclick` only — **no in-memory timers**

## Secrets (Supabase Dashboard)

| Secret | Where |
|--------|-------|
| `VAPID_PUBLIC_KEY` | Edge Function + `VITE_VAPID_PUBLIC_KEY` in client |
| `VAPID_PRIVATE_KEY` | Edge Function only — never client |
| `VAPID_SUBJECT` | Edge Function (e.g. `mailto:support@itjima.app`) |
| `CRON_SECRET` | Edge Function + pg_cron HTTP header |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto on hosted Supabase |

Generate VAPID keys: `npx web-push generate-vapid-keys`

## Cron

Migration `20260725120100_reminder_cron.sql` schedules `process-reminders` via pg_cron + pg_net.

Store secrets in Supabase Vault **once** before the cron job runs (Dashboard → SQL Editor, or CLI). Never commit actual values:

```sql
SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');
```

The cron job reads `project_url` and `cron_secret` from `vault.decrypted_secrets`. The same `CRON_SECRET` value must be set on the `process-reminders` Edge Function.

## Real-device QA

See `docs/REAL_DEVICE_QA.md`. Required proof (iOS + Android installed PWA):

- App fully closed, device locked
- Reminder received once
- Tap opens `/schedule?open={id}`
- Edit cancels old reminder; delete cancels reminder

**Status: BLOCKED** — not executed in CI/sandbox.

## Foreground fallback

`bindInAppReminders` in `src/lib/scheduleReminders.ts` remains for open-tab convenience.
UI must not claim closed-app delivery without active push subscription (`ensurePushSubscription`).
