-- Sync schedule/inbox fields that were local-only
ALTER TABLE public.inbox
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS repeat TEXT;
