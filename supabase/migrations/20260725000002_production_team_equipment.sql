-- ========================================================================
-- Safey-QMS: Add production team assignment & equipment tracking
-- (2026-07-25)
--
-- Changes:
--   1. Add assigned_employee, process_equipment_id, measuring_equipment_id
--      to production_batches.
--   2. Update commit_production RPC to accept and store the new fields.
-- ========================================================================

-- ========================================================================
-- 1. Add columns to production_batches
-- ========================================================================
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS assigned_employee    TEXT,
  ADD COLUMN IF NOT EXISTS process_equipment_id  UUID REFERENCES public.equipment(id),
  ADD COLUMN IF NOT EXISTS measuring_equipment_id UUID REFERENCES public.equipment(id);

-- ========================================================================
-- 2. Update commit_production RPC with new params
-- ========================================================================
CREATE OR REPLACE FUNCTION public.commit_production(
  p_product_id            UUID,
  p_quantity_produced     INTEGER,
  p_production_date       DATE,
  p_expected_raw_kg       NUMERIC,
  p_actual_raw_kg         NUMERIC,
  p_notes                 TEXT,
  p_picks                 JSONB,
  p_assigned_employee     TEXT DEFAULT NULL,
  p_process_equipment_id  UUID DEFAULT NULL,
  p_measuring_equipment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id        UUID;
  v_batch_number    TEXT;
  v_part_id         UUID;
  v_quantity_used   NUMERIC;
  v_remaining       NUMERIC;
  v_pick            JSONB;
BEGIN
  IF p_picks IS NULL OR jsonb_typeof(p_picks) <> 'array' OR jsonb_array_length(p_picks) = 0 THEN
    RAISE EXCEPTION 'picks must be a non-empty array';
  END IF;

  -- 1. Pre-flight: every picked batch must have enough remaining.
  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    SELECT pb.part_id,
           pb.quantity - COALESCE((
             SELECT SUM(pbp.quantity_used)
             FROM public.production_batch_parts pbp
             WHERE pbp.part_batch_id = (v_pick->>'part_batch_id')::uuid
           ), 0)
      INTO v_part_id, v_remaining
      FROM public.part_batches pb
     WHERE pb.id = (v_pick->>'part_batch_id')::uuid
       AND NOT pb.is_blocked;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'part_batch % not found or blocked', v_pick->>'part_batch_id';
    END IF;
    v_quantity_used := (v_pick->>'quantity_used')::numeric;
    IF v_remaining < v_quantity_used THEN
      RAISE EXCEPTION 'part_batch % has only % remaining, requested %', v_pick->>'part_batch_id', v_remaining, v_quantity_used;
    END IF;
  END LOOP;

  -- 2. Insert production_batches row (with new fields).
  INSERT INTO public.production_batches (
    batch_number,
    product_id,
    quantity_produced,
    expected_raw_material_kg,
    actual_raw_material_kg,
    production_date,
    status,
    notes,
    assigned_employee,
    process_equipment_id,
    measuring_equipment_id
  ) VALUES (
    '',
    p_product_id,
    p_quantity_produced,
    p_expected_raw_kg,
    p_actual_raw_kg,
    COALESCE(p_production_date, CURRENT_DATE),
    'completed',
    p_notes,
    p_assigned_employee,
    p_process_equipment_id,
    p_measuring_equipment_id
  )
  RETURNING id, batch_number INTO v_batch_id, v_batch_number;

  -- 3. Insert junction rows (trigger handles parts.current_stock deduction).
  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    INSERT INTO public.production_batch_parts (
      production_batch_id,
      part_batch_id,
      quantity_used
    ) VALUES (
      v_batch_id,
      (v_pick->>'part_batch_id')::uuid,
      (v_pick->>'quantity_used')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_batch_id, 'batch_number', v_batch_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.commit_production(
  UUID, INTEGER, DATE, NUMERIC, NUMERIC, TEXT, JSONB,
  TEXT, UUID, UUID
) TO authenticated;
