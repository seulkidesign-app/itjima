-- Provenance: link schedule/archive rows back to originating thought
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS source_id UUID;

ALTER TABLE public.archive
  ADD COLUMN IF NOT EXISTS source_id UUID;
