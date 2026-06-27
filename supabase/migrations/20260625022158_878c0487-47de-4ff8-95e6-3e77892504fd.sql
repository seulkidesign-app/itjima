
CREATE TYPE public.feedback_category AS ENUM ('bug', 'suggestion', 'praise', 'other');
CREATE TYPE public.feedback_status AS ENUM ('new', 'reviewing', 'resolved', 'archived');

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NULL,
  category public.feedback_category NOT NULL DEFAULT 'other',
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  status public.feedback_status NOT NULL DEFAULT 'new',
  user_agent text NULL,
  page_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or signed-in) can submit feedback. Signed-in users must set user_id to themselves; anon users must leave it null.
CREATE POLICY "anyone can submit feedback"
  ON public.feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- Users can see their own feedback
CREATE POLICY "users can view own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view and manage everything
CREATE POLICY "admins view all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete feedback"
  ON public.feedback FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX feedback_created_at_idx ON public.feedback (created_at DESC);
CREATE INDEX feedback_status_idx ON public.feedback (status);
