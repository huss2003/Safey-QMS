import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Save, Loader2, CheckCircle2, FileText } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { MaterialBadge } from "@/components/inventory/material-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtKg } from "@/lib/inventory/format";
import { audit } from "@/lib/inventory/audit";

export const Route = createFileRoute("/_authenticated/products-bom/$id")({
  component: BomEditor,
});

interface InspectionTemplate {
  id: string;
  part_name: string;
  record_id: string;
  tolerance: number;
  form_schema: any;
  is_ai_generated: boolean;
}

function BomEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: product } = useQuery({
    queryKey: ["products", id],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select(
            "*, product_bom(part_id, quantity_required, parts(part_name, material_type, consumption_per_unit_kg))",
          )
          .eq("id", id)
          .single()
      ).data,
  });
  const { data: parts } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => (await supabase.from("parts").select("*").order("part_name")).data ?? [],
  });

  // Fetch AI-generated inspection form templates
  const { data: inspectionTemplates = [] } = useQuery({
    queryKey: ["inspection_templates_ai"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_form_templates")
        .select("*")
        .eq("is_ai_generated", true)
        .order("part_name");
      if (error) throw error;
      return (data ?? []) as InspectionTemplate[];
    },
  });

  // Fetch existing product inspection forms
  const { data: productInspectionForms } = useQuery({
    queryKey: ["product_inspection_forms", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_inspection_forms")
        .select("template_id")
        .eq("product_id", id);
      if (error) throw error;
      return (data ?? []) as { template_id: string }[];
    },
  });

  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (productInspectionForms && !initialized) {
      setSelectedTemplates(new Set(productInspectionForms.map((f) => f.template_id)));
      setInitialized(true);
    }
  }, [productInspectionForms, initialized]);

  const [bom, setBom] = useState<Array<{ part_id: string; quantity_required: number }>>([]);
  useEffect(() => {
    if (product?.product_bom)
      setBom(
        product.product_bom.map((b: any) => ({
          part_id: b.part_id,
          quantity_required: Number(b.quantity_required),
        })),
      );
  }, [product?.id, product?.product_bom]);

  const partById = new Map((parts ?? []).map((p: any) => [p.id, p]));
  const available = (parts ?? []).filter((p: any) => !bom.some((b) => b.part_id === p.id));

  const save = useMutation({
    mutationFn: async () => {
      if (bom.length === 0) throw new Error("Add at least one part to the BOM.");
      const { error: delErr } = await supabase.from("product_bom").delete().eq("product_id", id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from("product_bom")
        .insert(bom.map((b) => ({ ...b, product_id: id })));
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("BOM saved");
      qc.invalidateQueries({ queryKey: ["products"] });
      audit("update", "product_bom", id);
      navigate({ to: "/products" });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const [saveInspectionForms, setSaved] = useState(false);

  // Mutation to save inspection form selections
  const saveFormSelection = useMutation({
    mutationFn: async () => {
      const { error: delErr } = await supabase
        .from("product_inspection_forms")
        .delete()
        .eq("product_id", id);
      if (delErr) throw delErr;
      if (selectedTemplates.size > 0) {
        const inserts = Array.from(selectedTemplates).map((templateId) => ({
          product_id: id,
          template_id: templateId,
        }));
        const { error: insErr } = await supabase.from("product_inspection_forms").insert(inserts);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Inspection forms saved");
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["product_inspection_forms", id] });
      audit("update", "product_inspection_forms", id);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save inspection forms"),
  });

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title={`BOM · ${product?.product_name ?? "…"}`}
        subtitle="Define the parts required to build one unit of this product"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/products">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}{" "}
              Save BOM
            </Button>
          </>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="label-caps mb-3">Available parts</div>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">All parts already in BOM.</p>
            ) : (
              <ul className="space-y-1">
                {available.map((p: any) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between border rounded-md p-2 hover:bg-accent"
                  >
                    <div>
                      <div className="text-sm font-medium">{p.part_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <MaterialBadge material={p.material_type} />{" "}
                        {fmtKg(p.consumption_per_unit_kg, 4)}/unit
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBom((b) => [...b, { part_id: p.id, quantity_required: 1 }])}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="label-caps mb-3">Bill of Materials</div>
            {bom.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add parts from the left.</p>
            ) : (
              <ul className="space-y-2">
                {bom.map((row, idx) => {
                  const p: any = partById.get(row.part_id);
                  return (
                    <li key={row.part_id} className="flex items-center gap-2 border rounded-md p-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{p?.part_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <MaterialBadge material={p?.material_type ?? ""} />
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={row.quantity_required}
                        onChange={(e) =>
                          setBom((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, quantity_required: Number(e.target.value) } : r,
                            ),
                          )
                        }
                        className="w-20"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setBom((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inspection Form Selection */}
      {!saveInspectionForms ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Inspection Forms for Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Select the applicable inspection forms for this product. These forms will be available
              during quality inspection.
            </p>
            {inspectionTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No inspection form templates available.
              </p>
            ) : (
              <div className="grid gap-3">
                {inspectionTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`flex items-center justify-between rounded-xl p-4 cursor-pointer transition-all ${
                      selectedTemplates.has(template.id)
                        ? "bg-[#E0E7FF] border-2 border-[#1E3A8A]"
                        : "bg-white border border-[#CBD5E1] hover:border-[#1E3A8A] hover:shadow-sm"
                    }`}
                    role="checkbox"
                    aria-checked={selectedTemplates.has(template.id)}
                    tabIndex={0}
                    onClick={() => toggleTemplate(template.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleTemplate(template.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                          selectedTemplates.has(template.id)
                            ? "bg-[#1E3A8A] border-[#1E3A8A] text-white"
                            : "bg-white border-[#CBD5E1]"
                        }`}
                      >
                        {selectedTemplates.has(template.id) && (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#0F172A]">
                          {template.part_name}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {template.record_id} • Tolerance: {template.tolerance}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              className="mt-4"
              onClick={() => saveFormSelection.mutate()}
              disabled={saveFormSelection.isPending}
            >
              {saveFormSelection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Inspection Forms
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Inspection Forms for Products
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setSaved(false)}>
              Edit Selection
            </Button>
          </CardHeader>
          <CardContent>
            {selectedTemplates.size === 0 ? (
              <p className="text-sm text-muted-foreground">No forms selected.</p>
            ) : (
              <div className="grid gap-2">
                {inspectionTemplates
                  .filter((t) => selectedTemplates.has(t.id))
                  .map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#E0E7FF] border-2 border-[#1E3A8A]"
                    >
                      <div className="w-5 h-5 rounded bg-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#0F172A]">
                          {template.part_name}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {template.record_id} • Tolerance: {template.tolerance}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
