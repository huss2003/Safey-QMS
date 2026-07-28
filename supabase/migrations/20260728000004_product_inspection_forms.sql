-- Junction table linking products to inspection form templates
CREATE TABLE IF NOT EXISTS public.product_inspection_forms (
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.inspection_form_templates(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (product_id, template_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_inspection_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on product_inspection_forms"
  ON public.product_inspection_forms
  FOR ALL
  USING (true)
  WITH CHECK (true);
