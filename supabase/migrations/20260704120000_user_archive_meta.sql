-- Per-user archive UI metadata (pins, titles, groups, schedule pins, etc.)
CREATE TABLE public.user_archive_meta (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_archive_meta TO authenticated;
GRANT ALL ON public.user_archive_meta TO service_role;

ALTER TABLE public.user_archive_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own archive meta"
  ON public.user_archive_meta
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
