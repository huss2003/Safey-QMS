-- Add record_prefix for auto-generated record IDs
ALTER TABLE public.inspection_form_templates
  ADD COLUMN IF NOT EXISTS record_prefix TEXT;

-- Function: get next record number for a prefix
CREATE OR REPLACE FUNCTION public.next_record_number(p_prefix TEXT)
RETURNS INTEGER
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(MAX(CAST(SUBSTRING(record_id FROM LENGTH(p_prefix) + 1) AS INTEGER)), 0) + 1
  FROM public.inspection_form_templates
  WHERE record_prefix = p_prefix AND record_id LIKE p_prefix || '%';
$$;
