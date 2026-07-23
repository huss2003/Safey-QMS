-- Create storage bucket for equipment file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('equipment-files', 'equipment-files', true, 10485760, 
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Public read policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'equipment-files');
  END IF;
END $$;

-- Allow insert policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Allow insert" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'equipment-files');
  END IF;
END $$;

-- Allow delete policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Allow delete" ON storage.objects 
    FOR DELETE USING (bucket_id = 'equipment-files');
  END IF;
END $$;
