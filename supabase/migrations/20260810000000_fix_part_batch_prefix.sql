-- Fix: part batch_number trigger should use part_code (e.g. TPX-001) 
-- instead of part_name (e.g. "Top cover") for the batch prefix.
-- "Top cover" → TOPC-B001 (wrong), "TPX-001" → TPX-B001 (correct)

CREATE OR REPLACE FUNCTION public.part_batch_gen_batch_number() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_next INTEGER;
  v_prefix TEXT;
  v_code TEXT;
  v_name TEXT;
  v_stripped TEXT;
BEGIN
  -- If client supplied a non-empty batch_number, keep it.
  IF NEW.batch_number IS NOT NULL AND NEW.batch_number <> '' THEN
    RETURN NEW;
  END IF;

  -- Prefer part_code over part_name for prefix.
  SELECT COALESCE(part_code, ''), COALESCE(part_name, '') 
    INTO v_code, v_name 
    FROM public.parts WHERE id = NEW.part_id;

  -- Strip non-alphanumeric, take first 4 chars.
  IF v_code IS NOT NULL AND v_code <> '' THEN
    v_stripped := regexp_replace(v_code, '[^A-Za-z0-9]', '', 'g');
  ELSE
    v_stripped := regexp_replace(v_name, '[^A-Za-z0-9]', '', 'g');
  END IF;
  v_stripped := upper(substring(v_stripped from 1 for 4));

  -- Fallback chain.
  IF v_stripped IS NULL OR v_stripped = '' THEN
    v_stripped := upper(substring(replace(NEW.part_id::text, '-', '') from 1 for 4));
  END IF;
  IF v_stripped IS NULL OR v_stripped = '' THEN
    v_stripped := 'PART';
  END IF;

  v_prefix := v_stripped || '-B';
  v_next := public.next_number_for_prefix(v_prefix, 'part_batches', 'batch_number');
  NEW.batch_number := v_prefix || lpad(v_next::TEXT, 3, '0');

  RETURN NEW;
END $$;
