-- ========================================================================
-- Safey-QMS: Employee Records Migration (2026-07-26)
-- Tables: employee_interviews, employee_trainings,
--         employee_performance_evaluations, employee_health_records
-- RLS: public_all policies
-- Storage: employee-files bucket
-- ========================================================================

-- ========================================================================
-- 1. employee_interviews
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.employee_interviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  interviewer         TEXT,
  interview_date      DATE,
  years_experience    TEXT,
  education           TEXT,
  skills              JSONB NOT NULL DEFAULT '[]',
  total_score         NUMERIC,
  is_completed        BOOLEAN DEFAULT false,
  documents           TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 2. employee_trainings
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.employee_trainings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  training_name       TEXT NOT NULL,
  training_date       DATE,
  trainer             TEXT,
  notes               TEXT,
  documents           TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 3. employee_performance_evaluations
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.employee_performance_evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluation_date     DATE,
  evaluator           TEXT,
  criteria            TEXT,
  rating              TEXT,
  notes               TEXT,
  documents           TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 4. employee_health_records
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.employee_health_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  record_date         DATE,
  record_type         TEXT,
  description         TEXT,
  documents           TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- updated_at trigger for employee_interviews
-- ========================================================================
CREATE OR REPLACE FUNCTION public.update_employee_interviews_updated_at()
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

DROP TRIGGER IF EXISTS trg_update_employee_interviews_updated_at ON public.employee_interviews;
CREATE TRIGGER trg_update_employee_interviews_updated_at
  BEFORE UPDATE ON public.employee_interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_employee_interviews_updated_at();

-- ========================================================================
-- Indexes
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_employee_interviews_employee_id
  ON public.employee_interviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_trainings_employee_id
  ON public.employee_trainings(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_performance_evaluations_employee_id
  ON public.employee_performance_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_health_records_employee_id
  ON public.employee_health_records(employee_id);

-- ========================================================================
-- RLS — public_all policy on each table
-- ========================================================================
ALTER TABLE public.employee_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_performance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_health_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_interviews' AND policyname = 'public_all') THEN
    CREATE POLICY public_all ON public.employee_interviews FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_trainings' AND policyname = 'public_all') THEN
    CREATE POLICY public_all ON public.employee_trainings FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_performance_evaluations' AND policyname = 'public_all') THEN
    CREATE POLICY public_all ON public.employee_performance_evaluations FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_health_records' AND policyname = 'public_all') THEN
    CREATE POLICY public_all ON public.employee_health_records FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ========================================================================
-- Grants
-- ========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_interviews TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_trainings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_performance_evaluations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_health_records TO anon, authenticated;

-- ========================================================================
-- Storage: employee-files bucket + policies
-- ========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-files', 'employee-files', true, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public read" ON storage.objects
      FOR SELECT USING (bucket_id = 'employee-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Allow insert" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'employee-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Allow delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'employee-files');
  END IF;
END $$;
