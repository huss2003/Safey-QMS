-- ========================================================================
-- Safey-QMS: Employee Roles Migration (2026-07-25)
--
-- Tables:
--   1. employees — employee registry with role assignments
--
-- RLS: public_all policy
-- Grants: SELECT, INSERT, UPDATE, DELETE to anon + authenticated
-- ========================================================================

-- ========================================================================
-- 1. Employees table
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name   TEXT    NOT NULL,
  employee_role   TEXT    NOT NULL
                      CHECK (employee_role IN ('operator', 'supervisor', 'qc_inspector', 'production_manager')),
  date_of_birth   DATE,
  recruited_date  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 2. Trigger function: update_employees_updated_at()
--    Keeps updated_at current on every UPDATE to the employees table.
-- ========================================================================
CREATE OR REPLACE FUNCTION public.update_employees_updated_at()
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

DROP TRIGGER IF EXISTS trg_update_employees_updated_at ON public.employees;
CREATE TRIGGER trg_update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_employees_updated_at();

-- ========================================================================
-- 3. Indexes
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_employees_employee_role
  ON public.employees(employee_role);

CREATE INDEX IF NOT EXISTS idx_employees_employee_name
  ON public.employees(employee_name);

-- ========================================================================
-- 4. RLS — Enable Row Level Security + public_all policy
-- ========================================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employees' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.employees
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ========================================================================
-- 5. Grants — full CRUD for anon and authenticated
-- ========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO anon, authenticated;
