-- Add document_url column to equipment_repairs and equipment_maintenance
-- so users can attach supporting documents to repair and maintenance records.

ALTER TABLE public.equipment_repairs
  ADD COLUMN IF NOT EXISTS document_url TEXT;

ALTER TABLE public.equipment_maintenance
  ADD COLUMN IF NOT EXISTS document_url TEXT;
