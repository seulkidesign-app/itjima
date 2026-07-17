-- Independent start/end all-day flags (QA #7)
-- Existing rows keep NULL; client falls back to all_day + times when unset.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS start_all_day BOOLEAN,
  ADD COLUMN IF NOT EXISTS end_all_day BOOLEAN;

NOTIFY pgrst, 'reload schema';
