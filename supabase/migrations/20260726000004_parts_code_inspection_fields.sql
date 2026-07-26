-- Add part_code column to parts table
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS part_code TEXT;

-- Add A, B, C fields to inspection_form_templates
ALTER TABLE public.inspection_form_templates
  ADD COLUMN IF NOT EXISTS field_a TEXT,
  ADD COLUMN IF NOT EXISTS field_b TEXT,
  ADD COLUMN IF NOT EXISTS field_c TEXT;
