-- Add masterbatch columns to parts table
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS masterbatch_id UUID REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS masterbatch_qty_kg NUMERIC(10,3) DEFAULT 0;
