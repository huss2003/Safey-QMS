-- ========================================================================
-- Safey-QMS: Add employee + equipment info to traceability RPCs
-- Updates get_traceability_backward and get_traceability_forward to
-- include assigned_employee, process_equipment_name, measuring_equipment_name
-- ========================================================================

-- ============================================================
-- Update: get_traceability_forward — add employee & equipment to productions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_traceability_forward(p_raw_material_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'raw_material', (
      SELECT to_jsonb(rm) || jsonb_build_object(
        'vendor', to_jsonb(v)
      )
      FROM public.raw_materials rm
      LEFT JOIN public.vendors v ON v.id = rm.vendor_id
      WHERE rm.id = p_raw_material_id
    ),
    'part_batches', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(pb) || jsonb_build_object(
          'part_name', p.part_name,
          'productions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', prb.id,
              'batch_number', prb.batch_number,
              'product_name', pr.product_name,
              'quantity_produced', prb.quantity_produced,
              'production_date', prb.production_date,
              'status', prb.status,
              'quantity_used', pbp.quantity_used,
              'assigned_employee', prb.assigned_employee,
              'process_equipment_name', eqp.name,
              'measuring_equipment_name', eqm.name
            ))
            FROM public.production_batch_parts pbp
            JOIN public.production_batches prb ON prb.id = pbp.production_batch_id
            LEFT JOIN public.products pr ON pr.id = prb.product_id
            LEFT JOIN public.equipment eqp ON eqp.id = prb.process_equipment_id
            LEFT JOIN public.equipment eqm ON eqm.id = prb.measuring_equipment_id
            WHERE pbp.part_batch_id = pb.id
          ), '[]'::jsonb)
        )
      )
      FROM public.part_batches pb
      LEFT JOIN public.parts p ON p.id = pb.part_id
      WHERE pb.raw_material_batch_id = p_raw_material_id
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_traceability_forward(UUID) TO authenticated;

-- ============================================================
-- Update: get_traceability_backward — add employee & equipment to production
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_traceability_backward(p_production_batch_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'production', (
      SELECT to_jsonb(prb) || jsonb_build_object(
        'product_name', pr.product_name,
        'process_equipment_name', eqp.name,
        'measuring_equipment_name', eqm.name
      )
      FROM public.production_batches prb
      LEFT JOIN public.products pr ON pr.id = prb.product_id
      LEFT JOIN public.equipment eqp ON eqp.id = prb.process_equipment_id
      LEFT JOIN public.equipment eqm ON eqm.id = prb.measuring_equipment_id
      WHERE prb.id = p_production_batch_id
    ),
    'parts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'quantity_used', pbp.quantity_used,
        'part_batch', to_jsonb(pb) || jsonb_build_object(
          'part_name', p.part_name,
          'raw_material', to_jsonb(rm) || jsonb_build_object(
            'vendor', to_jsonb(v)
          )
        )
      ))
      FROM public.production_batch_parts pbp
      JOIN public.part_batches pb ON pb.id = pbp.part_batch_id
      LEFT JOIN public.parts p ON p.id = pb.part_id
      LEFT JOIN public.raw_materials rm ON rm.id = pb.raw_material_batch_id
      LEFT JOIN public.vendors v ON v.id = rm.vendor_id
      WHERE pbp.production_batch_id = p_production_batch_id
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_traceability_backward(UUID) TO authenticated;
