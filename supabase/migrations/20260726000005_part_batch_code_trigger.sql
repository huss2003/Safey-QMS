-- Update batch number trigger to use part_code instead of part_name
CREATE OR REPLACE FUNCTION public.part_batch_gen_batch_number() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_next INTEGER;
  v_prefix TEXT;
  v_code TEXT;
BEGIN
  IF NEW.batch_number IS NOT NULL AND NEW.batch_number <> '' THEN
    RETURN NEW;
  END IF;

  -- Get the part's code (e.g. "BACK-" or "TPX-")
  SELECT COALESCE(part_code, '') INTO v_code FROM public.parts WHERE id = NEW.part_id;

  IF v_code = '' THEN
    -- Fallback: derive from part_name like before
    SELECT COALESCE(part_name, '') INTO v_code FROM public.parts WHERE id = NEW.part_id;
    v_prefix := upper(substring(regexp_replace(v_code, '[^a-zA-Z]', '', 'g') from 1 for 4)) || '-B';
  ELSE
    v_prefix := v_code || '-B';
  END IF;

  v_next := public.next_number_for_prefix(v_prefix, 'part_batches', 'batch_number');
  NEW.batch_number := v_prefix || lpad(v_next::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

-- Add inspection_result and inspection_form_id columns to part_batches
ALTER TABLE public.part_batches ADD COLUMN IF NOT EXISTS inspection_result TEXT;
ALTER TABLE public.part_batches ADD COLUMN IF NOT EXISTS inspection_form_id UUID REFERENCES public.inspection_form_templates(id);
