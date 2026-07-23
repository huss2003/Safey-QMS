-- ========================================================================
-- Safey-QMS: Equipment Management System Migration (2026-07-25)
--
-- Tables:
--   1. equipment              — main equipment registry
--   2. equipment_repairs      — repair history for each equipment
--   3. equipment_calibrations — calibration records
--   4. equipment_adjustments  — adjustment / verification records
--   5. equipment_maintenance  — maintenance activities
--
-- Functions:
--   - next_equipment_id()     — generates sequential EQ01, EQ02, …
--   - generate_equipment_id() — trigger to auto-populate equipment_id
--   - update_equipment_updated_at() — trigger to keep updated_at current
--
-- RLS: public_all policy on all tables
-- Grants: SELECT, INSERT, UPDATE, DELETE to anon + authenticated
-- Indexes: on all foreign keys and key lookup columns
-- ========================================================================

-- ========================================================================
-- 1. Equipment table
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.equipment (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id            TEXT    NOT NULL UNIQUE,
  name                    TEXT    NOT NULL,
  purchased_date          DATE    NOT NULL,
  purchased_from          TEXT,
  status                  TEXT    NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
  calibration_frequency   TEXT    NOT NULL
                              CHECK (calibration_frequency IN ('6_monthly', 'yearly')),
  equipment_type          TEXT    NOT NULL
                              CHECK (equipment_type IN ('process', 'measuring')),
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 2. Equipment repairs
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.equipment_repairs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id      UUID   NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  repair_date       DATE   NOT NULL,
  repair_notes      TEXT,
  repaired_by       TEXT,
  test_run          TEXT   CHECK (test_run IN ('success', 'failed')),
  test_run_notes    TEXT,
  tested_by         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 3. Equipment calibrations
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.equipment_calibrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id          UUID   NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  calibration_date      DATE   NOT NULL,
  calibration_managed_by TEXT,
  lab_name              TEXT,
  lab_address           TEXT,
  next_calibration_date DATE,
  calibration_report_url TEXT,
  calibration_status    TEXT   NOT NULL DEFAULT 'active'
                          CHECK (calibration_status IN ('active', 'inactive')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 4. Equipment adjustments
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.equipment_adjustments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id        UUID   NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  adjustment_date     DATE   NOT NULL,
  adjustment_managed_by TEXT,
  adjustment_notes    TEXT,
  measurements_before TEXT,
  measurements_after  TEXT   CHECK (measurements_after IN ('accurate', 'inaccurate')),
  company_name        TEXT,
  company_address     TEXT,
  evidence_url        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 5. Equipment maintenance
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.equipment_maintenance (
  id                 UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id       UUID   NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  maintenance_date   DATE   NOT NULL,
  maintenance_done_by TEXT,
  maintenance_types  TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 6. RPC function: next_equipment_id()
--    Returns the next sequential equipment_id in the format EQ01, EQ02, …
-- ========================================================================
CREATE OR REPLACE FUNCTION public.next_equipment_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num INT;
  next_num INT;
  next_id TEXT;
BEGIN
  -- Extract the numeric part from the highest equipment_id, or 0 if none exist
  SELECT COALESCE(
    MAX((regexp_replace(equipment_id, '^EQ', ''))::int),
    0
  )
  INTO max_num
  FROM public.equipment;

  next_num := max_num + 1;
  next_id  := 'EQ' || LPAD(next_num::text, 2, '0');

  RETURN next_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_equipment_id() TO anon, authenticated;

-- ========================================================================
-- 7. Trigger function: generate_equipment_id()
--    Auto-populates equipment_id on INSERT if not already provided.
-- ========================================================================
CREATE OR REPLACE FUNCTION public.generate_equipment_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.equipment_id IS NULL OR NEW.equipment_id = '' THEN
    NEW.equipment_id := public.next_equipment_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_equipment_id ON public.equipment;
CREATE TRIGGER trg_generate_equipment_id
  BEFORE INSERT ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_equipment_id();

-- ========================================================================
-- 8. Trigger function: update_equipment_updated_at()
--    Keeps updated_at current on every UPDATE to the equipment table.
-- ========================================================================
CREATE OR REPLACE FUNCTION public.update_equipment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_equipment_updated_at ON public.equipment;
CREATE TRIGGER trg_update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_equipment_updated_at();

-- ========================================================================
-- 9. Indexes
-- ========================================================================

-- Equipment
CREATE INDEX IF NOT EXISTS idx_equipment_equipment_id
  ON public.equipment(equipment_id);

-- Child tables — foreign key index on equipment_id
CREATE INDEX IF NOT EXISTS idx_equipment_repairs_equipment_id
  ON public.equipment_repairs(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_calibrations_equipment_id
  ON public.equipment_calibrations(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_adjustments_equipment_id
  ON public.equipment_adjustments(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment_id
  ON public.equipment_maintenance(equipment_id);

-- Calibration-specific indexes
CREATE INDEX IF NOT EXISTS idx_equipment_calibrations_calibration_date
  ON public.equipment_calibrations(calibration_date);

CREATE INDEX IF NOT EXISTS idx_equipment_calibrations_calibration_status
  ON public.equipment_calibrations(calibration_status);

-- ========================================================================
-- 10. RLS — Enable Row Level Security + public_all policies
-- ========================================================================

-- Equipment
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'equipment' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.equipment
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Equipment repairs
ALTER TABLE public.equipment_repairs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'equipment_repairs' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.equipment_repairs
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Equipment calibrations
ALTER TABLE public.equipment_calibrations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'equipment_calibrations' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.equipment_calibrations
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Equipment adjustments
ALTER TABLE public.equipment_adjustments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'equipment_adjustments' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.equipment_adjustments
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Equipment maintenance
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'equipment_maintenance' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.equipment_maintenance
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ========================================================================
-- 11. Grants — full CRUD for anon and authenticated
-- ========================================================================

-- Equipment
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO anon, authenticated;

-- Equipment repairs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_repairs TO anon, authenticated;

-- Equipment calibrations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_calibrations TO anon, authenticated;

-- Equipment adjustments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_adjustments TO anon, authenticated;

-- Equipment maintenance
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_maintenance TO anon, authenticated;
