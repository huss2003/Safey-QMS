-- Table for storing filled dynamic form submissions
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.inspection_form_templates(id) ON DELETE CASCADE NOT NULL,
  form_title TEXT NOT NULL,
  form_number TEXT,
  filled_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on form_submissions" ON public.form_submissions FOR ALL USING (true) WITH CHECK (true);
