-- Add COA/PO/Invoice fields to raw_materials
ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS coa_number TEXT,
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS coa_documents JSONB,
  ADD COLUMN IF NOT EXISTS po_documents JSONB,
  ADD COLUMN IF NOT EXISTS invoice_documents JSONB;
