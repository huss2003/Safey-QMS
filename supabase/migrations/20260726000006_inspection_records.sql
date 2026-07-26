-- inspection_records: stores full inspection form data per batch
CREATE TABLE IF NOT EXISTS public.inspection_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.part_batches(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.inspection_form_templates(id),
  
  -- Form header
  form_id TEXT NOT NULL, -- user-entered record ID like FORM_PSP_QI_02_
  part_name TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Process Equipment Details
  process_equipment_name TEXT,
  process_engineer_id UUID REFERENCES public.employees(id),
  process_engineer_name TEXT,
  process_equipment_id TEXT,
  equipment_servicing_date DATE,
  equipment_servicing_due_date DATE,
  
  -- Part Details
  part_id TEXT, -- part_code
  mold_id TEXT DEFAULT 'xx001',
  quantity_parts INTEGER,
  
  -- Equipment Parameter Settings (placeholder fields)
  injection_pressure TEXT,
  melt_temperature TEXT,
  mold_temperature TEXT,
  clamping_force TEXT,
  holding_time TEXT,
  screw_barrel_size TEXT,
  settings_screenshot_attached BOOLEAN DEFAULT false,
  settings_screenshot_data TEXT,
  
  -- Raw Material Details
  polymer_name TEXT,
  masterbatch_name TEXT,
  polymer_batch_id TEXT,
  masterbatch_batch_id TEXT,
  polymer_quantity_kg NUMERIC,
  masterbatch_quantity_kg NUMERIC,
  drying_time TEXT,
  drying_temperature TEXT,
  
  -- Measuring Equipment Details
  measuring_equipment_name TEXT,
  measuring_equipment_id TEXT,
  measuring_calibration_date DATE,
  measuring_next_calibration_date DATE,
  equipment_verified BOOLEAN DEFAULT false,
  
  -- Quality control rows stored as JSONB array
  -- Each row: { part_num, a_actual, a_measured, a_difference, b_actual, b_measured, b_difference, c_actual, c_measured, c_difference, tolerance, result }
  qc_rows JSONB DEFAULT '[]'::jsonb,
  
  -- Overall result
  overall_result TEXT, -- Pass/Fail
  tolerance NUMERIC,
  
  -- Signature
  signature_name TEXT,
  signature_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on inspection_records" ON public.inspection_records FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_inspection_records_updated BEFORE UPDATE ON public.inspection_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
