-- Update employee_role CHECK constraint to include all HRM roles
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employee_role_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employee_role_check
  CHECK (employee_role IN (
    'operator',
    'supervisor',
    'qc_inspector',
    'production_manager',
    'factory_site_manager',
    'product_quality_lead',
    'head_of_sales',
    'supplier_and_purchase_management',
    'injection_moulding_engineer',
    'production_executive'
  ));
