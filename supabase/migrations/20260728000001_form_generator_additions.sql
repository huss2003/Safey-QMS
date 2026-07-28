-- Add columns to inspection_form_templates for form generator feature
ALTER TABLE public.inspection_form_templates
  ADD COLUMN IF NOT EXISTS form_schema JSONB,
  ADD COLUMN IF NOT EXISTS source_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT false;

-- Create storage bucket for form template uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('form-templates', 'form-templates', true, 20971520, 
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public Read FT" ON storage.objects 
  FOR SELECT USING (bucket_id = 'form-templates');

-- Allow insert (open access — no auth required)
CREATE POLICY "Allow insert FT" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'form-templates');

-- Allow delete (open access — no auth required)
CREATE POLICY "Allow delete FT" ON storage.objects 
  FOR DELETE USING (bucket_id = 'form-templates');
