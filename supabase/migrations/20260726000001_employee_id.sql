-- Add employee_id column
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE;

-- Backfill existing rows
UPDATE public.employees e SET employee_id = 'EMP-' || LPAD(
  (SELECT COUNT(*) FROM public.employees e2 WHERE e2.created_at <= e.created_at)::TEXT, 3, '0'
) WHERE employee_id IS NULL;

-- Auto-generate function for new rows
CREATE OR REPLACE FUNCTION public.generate_employee_id() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := 'EMP-' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, 5) AS INT)), 0) + 1 FROM public.employees)::TEXT, 3, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_employee_id ON public.employees;
CREATE TRIGGER trg_generate_employee_id
  BEFORE INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.generate_employee_id();
