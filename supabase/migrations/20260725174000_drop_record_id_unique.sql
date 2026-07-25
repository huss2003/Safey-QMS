-- Drop fragile unique constraints on record_id (they cause duplicate key on re-creation)
ALTER TABLE public.employee_trainings DROP CONSTRAINT IF EXISTS employee_trainings_record_id_key;
ALTER TABLE public.employee_health_records DROP CONSTRAINT IF EXISTS employee_health_records_record_id_key;
