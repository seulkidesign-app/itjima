-- Canonical Memory entity (v1 foundation)
-- Legacy inbox/schedules/archive tables are preserved for migration period.

CREATE TABLE public.memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('captured', 'waiting', 'kept', 'resolved')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB,
  resurface_at TIMESTAMPTZ,
  resurface_on DATE,
  resurface_timezone TEXT NOT NULL DEFAULT 'UTC',
  resurface_precision TEXT CHECK (resurface_precision IN ('exact', 'day')),
  resurface_reason TEXT,
  resurface_reason_source TEXT CHECK (
    resurface_reason_source IN ('ai', 'manual', 'legacy', 'system')
  ),
  timing_confidence REAL,
  snooze_count INTEGER NOT NULL DEFAULT 0 CHECK (snooze_count >= 0),
  resolution_kind TEXT CHECK (resolution_kind IN ('completed', 'no_longer_needed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memories_waiting_resurface CHECK (
    status <> 'waiting'
    OR resurface_at IS NOT NULL
    OR resurface_on IS NOT NULL
  ),
  CONSTRAINT memories_resolved_kind CHECK (
    status <> 'resolved'
    OR resolution_kind IS NOT NULL
  ),
  CONSTRAINT memories_exact_day_exclusive CHECK (
    (resurface_at IS NULL OR resurface_on IS NULL)
  )
);

CREATE INDEX memories_user_status_idx
  ON public.memories (user_id, status);

CREATE INDEX memories_user_resurface_at_idx
  ON public.memories (user_id, resurface_at)
  WHERE resurface_at IS NOT NULL;

CREATE INDEX memories_user_resurface_on_idx
  ON public.memories (user_id, resurface_on)
  WHERE resurface_on IS NOT NULL;

CREATE UNIQUE INDEX memories_user_legacy_unique
  ON public.memories (
    user_id,
    (provenance->>'legacy_source'),
    (provenance->>'legacy_id')
  )
  WHERE provenance IS NOT NULL
    AND provenance->>'legacy_source' IS NOT NULL
    AND provenance->>'legacy_id' IS NOT NULL;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own memories select"
  ON public.memories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own memories insert"
  ON public.memories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own memories update"
  ON public.memories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own memories delete"
  ON public.memories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;

CREATE OR REPLACE FUNCTION public.set_memories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER memories_set_updated_at
  BEFORE UPDATE ON public.memories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_memories_updated_at();
