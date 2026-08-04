CREATE TABLE IF NOT EXISTS public.udi_registrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL,
  customer_name text NOT NULL,
  date_logged date,
  invoice_date date,
  customer_address text,
  warranty_term text,
  products jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.udi_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON public.udi_registrations FOR ALL USING (true);
