-- ========================================================================
-- Safey-QMS: QMS Improvements Migration (2026-07-24)
--
-- 1. get_stock_overview() RPC — single JSON query replacing 4 separate
--    frontend queries for raw_materials, parts, products, other_items counts
-- 2. Additional index on wastage_logs(reference_id) for traceability
-- 3. get_unread_alerts_count() RPC
-- 4. activity_log table + trigger function to log DML on tracked tables
-- 5. Trigger attachments for vendors, raw_materials, parts, part_batches,
--    production_batches
-- ========================================================================

-- ========================================================================
-- 1. get_stock_overview: return counts for all stock categories in one call
-- ========================================================================
CREATE OR REPLACE FUNCTION public.get_stock_overview()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'raw_materials_count', (SELECT COUNT(*)::int FROM public.raw_materials),
    'parts_count',         (SELECT COUNT(*)::int FROM public.parts),
    'products_count',      (SELECT COUNT(*)::int FROM public.products),
    'other_items_count',   (SELECT COUNT(*)::int FROM public.other_items)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_stock_overview() TO anon, authenticated;

-- ========================================================================
-- 2. Additional index on wastage_logs(reference_id) for faster traceability
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_wastage_logs_reference_id
  ON public.wastage_logs(reference_id);

-- ========================================================================
-- 3. get_unread_alerts_count: return count of unread alerts
-- ========================================================================
CREATE OR REPLACE FUNCTION public.get_unread_alerts_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.alerts WHERE NOT is_read;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_alerts_count() TO anon, authenticated;

-- ========================================================================
-- 4. activity_log table for audit tracking
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id    UUID NOT NULL,
  old_data     JSONB,
  new_data     JSONB,
  performed_by TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_table_name
  ON public.activity_log(table_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_record_id
  ON public.activity_log(record_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON public.activity_log(created_at DESC);

GRANT SELECT, INSERT ON public.activity_log TO anon, authenticated;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_log' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.activity_log
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ========================================================================
-- 5. Trigger function: log_activity
--    Logs INSERT/UPDATE/DELETE on tracked tables into activity_log.
--    Extracts performed_by from JWT claim email if available.
-- ========================================================================
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action      TEXT;
  v_old_data    JSONB;
  v_new_data    JSONB;
  v_performed_by TEXT;
  v_record_id   UUID;
BEGIN
  -- Determine action and capture data
  IF TG_OP = 'INSERT' THEN
    v_action   := 'INSERT';
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action   := 'UPDATE';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action   := 'DELETE';
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_record_id := OLD.id;
  ELSE
    RETURN NULL;
  END IF;

  -- Try to extract the user email from JWT claim, fall back to current_user
  BEGIN
    v_performed_by := nullif(
      current_setting('request.jwt.claims', true)::json->>'email',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    v_performed_by := current_user;
  END;

  IF v_performed_by IS NULL THEN
    v_performed_by := current_user;
  END IF;

  INSERT INTO public.activity_log (table_name, action, record_id, old_data, new_data, performed_by)
  VALUES (TG_TABLE_NAME, v_action, v_record_id, v_old_data, v_new_data, v_performed_by);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ========================================================================
-- 6. Attach triggers to tracked tables
-- ========================================================================

-- vendors
DROP TRIGGER IF EXISTS trg_vendors_activity ON public.vendors;
CREATE TRIGGER trg_vendors_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- raw_materials
DROP TRIGGER IF EXISTS trg_raw_materials_activity ON public.raw_materials;
CREATE TRIGGER trg_raw_materials_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.raw_materials
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- parts
DROP TRIGGER IF EXISTS trg_parts_activity ON public.parts;
CREATE TRIGGER trg_parts_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- part_batches
DROP TRIGGER IF EXISTS trg_part_batches_activity ON public.part_batches;
CREATE TRIGGER trg_part_batches_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.part_batches
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- production_batches
DROP TRIGGER IF EXISTS trg_production_batches_activity ON public.production_batches;
CREATE TRIGGER trg_production_batches_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
