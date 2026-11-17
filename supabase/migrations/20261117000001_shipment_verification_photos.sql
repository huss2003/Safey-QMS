-- Verification photos per shipment, stored on udi_registrations (no new table).
-- Shape: { "empty_stage": [{path,name}], "midway_pack": [...], "before_taping": [...], "final_wrap": [...] }
ALTER TABLE public.udi_registrations
  ADD COLUMN IF NOT EXISTS verification_photos jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('shipment-photos', 'shipment-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "shipment-photos open access" ON storage.objects;
CREATE POLICY "shipment-photos open access" ON storage.objects
  FOR ALL
  USING (bucket_id = 'shipment-photos')
  WITH CHECK (bucket_id = 'shipment-photos');
