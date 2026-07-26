-- Create inspection_form_templates table
CREATE TABLE IF NOT EXISTS public.inspection_form_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  tolerance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on inspection_form_templates"
  ON public.inspection_form_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);
