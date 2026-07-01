-- Apply in Supabase Dashboard → SQL Editor if you see sync errors like:
-- "Could not find the 'status' / 'all_day' / 'raw_text' column in the schema cache"
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE public.inbox
  ADD COLUMN IF NOT EXISTS brain_mirror JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.archive
  ADD COLUMN IF NOT EXISTS brain_mirror JSONB,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS brain_mirror JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS alarm_at TIMESTAMPTZ;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
