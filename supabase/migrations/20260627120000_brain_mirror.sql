-- Brain Mirror: optional AI-structured summary on inbox/archive items
ALTER TABLE public.inbox
  ADD COLUMN IF NOT EXISTS brain_mirror JSONB;

ALTER TABLE public.archive
  ADD COLUMN IF NOT EXISTS brain_mirror JSONB;
