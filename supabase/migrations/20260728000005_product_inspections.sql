-- Table for storing product inspection form submissions
CREATE TABLE IF NOT EXISTS public.product_inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.inspection_form_templates(id) ON DELETE SET NULL,
  form_no TEXT NOT NULL,
  part_name TEXT,
  date DATE,
  fcr_var TEXT,
  batch_number TEXT,
  operator_name TEXT,
  operator_id TEXT,
  equipment_name TEXT,
  equipment_id TEXT,
  is_device_validated BOOLEAN,
  quantity_of_device_x INTEGER,
  device_type TEXT,
  labelled_at_all_sides BOOLEAN,
  number_of_conforming_devices INTEGER,
  number_of_non_conforming_devices INTEGER,
  pull_test TEXT,
  shear_test TEXT,
  weld_seam TEXT,
  drop_test TEXT,
  overall_use_of_job TEXT,
  use_of_job_1 TEXT,
  use_of_job_2 TEXT,
  eoo_rbi_verification BOOLEAN,
  performed_by TEXT,
  signature_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_inspections ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all on product_inspections" ON public.product_inspections FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_product_inspections_product_id ON public.product_inspections(product_id);
CREATE INDEX idx_product_inspections_template_id ON public.product_inspections(template_id);
CREATE INDEX idx_product_inspections_batch_number ON public.product_inspections(batch_number);