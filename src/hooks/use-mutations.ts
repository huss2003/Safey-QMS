import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/inventory/audit";
import type {
  VendorInsert,
  RawMaterialInsert,
  PartInsert,
} from "@/integrations/supabase/database.types";

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VendorInsert) => {
      const { error } = await (supabase.from("vendors") as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor added");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      audit("create", "vendor");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create vendor"),
  });
}

export function useCreateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RawMaterialInsert) => {
      const { data, error } = await (supabase.from("raw_materials") as any)
        .insert({ ...payload, remaining_quantity_kg: payload.initial_quantity_kg })
        .select("batch_number")
        .single();
      if (error) throw error;
      return data.batch_number;
    },
    onSuccess: (batch) => {
      toast.success(`Raw material added: ${batch}`);
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      audit("create", "raw_material", batch);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create raw material"),
  });
}

export function useCreatePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PartInsert) => {
      const { error } = await (supabase.from("parts") as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Part added");
      qc.invalidateQueries({ queryKey: ["parts"] });
      audit("create", "part");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create part"),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      product_name: string;
      product_code: string;
      description?: string | null;
    }) => {
      const { error } = await (supabase.from("products") as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product added");
      qc.invalidateQueries({ queryKey: ["products"] });
      audit("create", "product");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create product"),
  });
}

export function useCreateProductionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      batch_number?: string;
      product_id: string;
      quantity_produced: number;
      expected_raw_material_kg: number;
      actual_raw_material_kg: number;
      production_date: string;
      status?: string;
      notes?: string | null;
    }) => {
      const { error } = await (supabase.from("production_batches") as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Production batch created");
      qc.invalidateQueries({ queryKey: ["production_batches"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      audit("create", "production_batch");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create production batch"),
  });
}
