-- SAFEY: Fix commit_production double-counting + part_batches constraint.
--
-- Bug 1: part_batches has CHECK (quantity > 0) but production can legally
--         consume all parts from a batch, setting quantity = 0.
--
-- Bug 2: commit_production decrements part_batches.quantity (step 4) AND
--         inserts production_batch_parts rows (step 3). Then step 5
--         recomputes parts.current_stock using SUM(quantity) - SUM(used),
--         which double-counts the consumption. The production_batch_parts
--         AFTER INSERT trigger already handles parts.current_stock, so
--         steps 4 and 5 in commit_production are redundant and harmful.

-- =====================================================================
-- 1. Fix the CHECK constraint on part_batches.quantity
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'part_batches'
      AND constraint_name = 'part_batches_quantity_check'
  ) THEN
    ALTER TABLE public.part_batches DROP CONSTRAINT part_batches_quantity_check;
  END IF;
END $$;

ALTER TABLE public.part_batches ADD CONSTRAINT part_batches_quantity_check CHECK (quantity >= 0);

-- =====================================================================
-- 2. Fix existing data: restore over-decremented part_batches.quantity.
--
--    The get_part_availability function computes remaining as:
--      quantity - SUM(pbp.quantity_used)
--    So quantity should be the ORIGINAL amount, not decremented.
--    Add back the amounts that were subtracted by prior commit_production runs.
-- =====================================================================
UPDATE public.part_batches pb
SET quantity = quantity + COALESCE((
  SELECT SUM(pbp.quantity_used)
  FROM public.production_batch_parts pbp
  WHERE pbp.part_batch_id = pb.id
), 0);

-- =====================================================================
-- 3. Fix commit_production: remove step 4 (decrement) and step 5
--    (recompute current_stock). The production_batch_parts AFTER INSERT
--    trigger already deducts from parts.current_stock correctly.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.commit_production(
  p_product_id          UUID,
  p_quantity_produced   INTEGER,
  p_production_date     DATE,
  p_expected_raw_kg     NUMERIC,
  p_actual_raw_kg       NUMERIC,
  p_notes               TEXT,
  p_picks               JSONB
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

  -- 2. Insert production_batches row.
  INSERT INTO public.production_batches (
    batch_number,
    product_id,
    quantity_produced,
    expected_raw_material_kg,
    actual_raw_material_kg,
    production_date,
    status,
    notes
  ) VALUES (
    '',
    p_product_id,
    p_quantity_produced,
    p_expected_raw_kg,
    p_actual_raw_kg,
    COALESCE(p_production_date, CURRENT_DATE),
    'completed',
    p_notes
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

GRANT EXECUTE ON FUNCTION public.commit_production(UUID, INTEGER, DATE, NUMERIC, NUMERIC, TEXT, JSONB) TO authenticated;
