-- Provenance + schedule status/alarm for v0.2 core quality
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS brain_mirror JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS alarm_at TIMESTAMPTZ;

ALTER TABLE public.archive
  ADD COLUMN IF NOT EXISTS raw_text TEXT;
