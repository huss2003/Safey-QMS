import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2, FileText, Save, Wand2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { DocxUploadDialog } from "@/components/inspection/docx-upload-dialog";
import { FormSchemaRenderer } from "@/components/inspection/form-schema-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/inventory/skeletons";

export const Route = createFileRoute("/_authenticated/inspection-form-template")({
  ssr: false,
  component: InspectionFormTemplatePage,
});

interface PartOption {
  id: string; part_name: string; part_code: string;
}

interface InspectionTemplate {
  id: string; part_id: string; part_name: string; record_id: string;
  record_prefix: string | null; tolerance: number;
  field_a: string | null; field_b: string | null; field_c: string | null;
  form_schema: any; is_ai_generated: boolean; created_at: string;
}

interface FormValues {
  part_id: string; part_name_input: string; record_id: string;
  tolerance: number | string; field_a: string; field_b: string; field_c: string;
}

function InspectionFormTemplatePage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<InspectionTemplate | null>(null);
  const [form, setForm] = useState<FormValues>({
    part_id: "", part_name_input: "", record_id: "", tolerance: "",
    field_a: "", field_b: "", field_c: "",
  });
  const [docxOpen, setDocxOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<InspectionTemplate | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>({});
  const [fillMode, setFillMode] = useState(false);

  // ── Edit state for AI forms (name + prefix) ──
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [aiEditId, setAiEditId] = useState<string | null>(null);
  const [aiEditName, setAiEditName] = useState("");
  const [aiEditPrefix, setAiEditPrefix] = useState("");

  const { data: parts = [], isLoading: loadingParts } = useQuery({
    queryKey: ["parts_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("id, part_name, part_code").order("part_name");
      if (error) throw error;
      return (data ?? []) as PartOption[];
    },
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["inspection_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspection_form_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InspectionTemplate[];
    },
  });

  const aiTemplates = templates.filter((t) => t.is_ai_generated);
  const manualTemplates = templates.filter((t) => !t.is_ai_generated);

  const partMap = new Map(parts.map((p) => [p.id, `${p.part_name} (${p.part_code})`]));

  const saveMutation = useMutation({
    mutationFn: async (v: FormValues & { id?: string }) => {
      const matched = parts.find((p) => p.part_name.toLowerCase() === v.part_name_input.toLowerCase());
      const partId = matched?.id ?? null;
      const partName = v.part_name_input || (matched ? `${matched.part_name} (${matched.part_code})` : v.part_id);
      const fields = { field_a: v.field_a || null, field_b: v.field_b || null, field_c: v.field_c || null };
      if (v.id) {
        const { error } = await supabase.from("inspection_form_templates").update({
          part_id: partId, part_name: partName, record_id: v.record_id, tolerance: Number(v.tolerance), ...fields,
        }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inspection_form_templates").insert({
          part_id: partId, part_name: partName, record_id: v.record_id, tolerance: Number(v.tolerance), ...fields,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, v) => {
      toast.success(v.id ? "Template updated" : "Template created");
      qc.invalidateQueries({ queryKey: ["inspection_templates"] });
      setAddOpen(false); setEditOpen(false);
      setForm({ part_id: "", part_name_input: "", record_id: "", tolerance: "", field_a: "", field_b: "", field_c: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspection_form_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Template deleted"); qc.invalidateQueries({ queryKey: ["inspection_templates"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!viewRecord) throw new Error("No template selected");
      const { error } = await (supabase.from("form_submissions") as any).insert({
        template_id: viewRecord.id, form_title: viewRecord.part_name,
        form_number: viewRecord.record_id, filled_values: formValues,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Form submitted");
      setViewRecord(null); setFormValues({}); setFillMode(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit"),
  });

  // ── AI edit: update name + prefix ──
  const aiEditMutation = useMutation({
    mutationFn: async () => {
      if (!aiEditId) throw new Error("No template selected");
      // Auto-generate record_id from prefix
      let recordId = aiEditPrefix;
      if (aiEditPrefix) {
        const { data } = await (supabase.rpc("next_record_number") as any)({ p_prefix: aiEditPrefix });
        recordId = `${aiEditPrefix}${String((data ?? 0) as number).padStart(3, "0")}`;
      }
      const { error } = await (supabase.from("inspection_form_templates") as any).update({
        part_name: aiEditName, record_id: recordId, record_prefix: aiEditPrefix || null,
      }).eq("id", aiEditId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template updated");
      qc.invalidateQueries({ queryKey: ["inspection_templates"] });
      setAiEditOpen(false); setAiEditId(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const openAdd = () => {
    setForm({ part_id: "", part_name_input: "", record_id: "", tolerance: "", field_a: "", field_b: "", field_c: "" });
    setAddOpen(true);
  };

  const openEdit = (r: InspectionTemplate) => {
    setEditRecord(r);
    setForm({
      part_id: r.part_id, part_name_input: r.part_name, record_id: r.record_id,
      tolerance: r.tolerance, field_a: r.field_a ?? "", field_b: r.field_b ?? "", field_c: r.field_c ?? "",
    });
    setEditOpen(true);
  };

  const canSave = form.part_name_input && form.record_id && form.tolerance !== "" && Number(form.tolerance) > 0;

  const renderTable = (items: InspectionTemplate[], emptyMsg: string) => (
    <div className="overflow-x-auto">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{emptyMsg}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 border-b">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Record ID</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Tolerance</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => (
              <TableRow key={t.id} className="border-b border-border/40">
                <TableCell className="text-[13px] font-medium">{t.part_name}</TableCell>
                <TableCell className="text-[12.5px] font-mono text-muted-foreground">{t.record_id}</TableCell>
                <TableCell className="text-[12.5px]"><Badge variant="secondary">{t.tolerance}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {t.form_schema && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewRecord(t)}>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {t.is_ai_generated ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setAiEditId(t.id); setAiEditName(t.part_name); setAiEditPrefix(t.record_prefix ?? ""); setAiEditOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  if (isLoading || loadingParts) {
    return <div className="p-4"><TableSkeleton /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Inspection Form Template"
        description="Manage QC inspection form templates."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDocxOpen(true)}>
              <Wand2 className="h-4 w-4 mr-2" /> Generate from DOCX
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> New Template
            </Button>
          </div>
        }
      />

      {/* ── AI Workflow ── */}
      {aiTemplates.length > 0 && (
        <Card className="overflow-hidden p-0 mb-6">
          <CardHeader className="py-2.5 px-4 bg-gradient-to-r from-purple-50/80 to-blue-50/80 border-b">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-600" />
              <CardTitle className="text-sm font-semibold">Inspection Form for Products</CardTitle>
              <Badge variant="secondary" className="text-[10px] ml-auto">{aiTemplates.length} templates</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {renderTable(aiTemplates, "No AI-generated templates yet.")}
          </CardContent>
        </Card>
      )}

      {/* ── Manual Workflow ── */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="py-2.5 px-4 bg-gradient-to-r from-slate-50/80 to-gray-50/80 border-b">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold">Inspection Form for Parts</CardTitle>
            <Badge variant="secondary" className="text-[10px] ml-auto">{manualTemplates.length} templates</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {renderTable(manualTemplates, "No manual templates yet.")}
        </CardContent>
      </Card>

      {/* ── AI Edit Dialog ── */}
      <Dialog open={aiEditOpen} onOpenChange={(v) => { if (!v) setAiEditOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit AI-Generated Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="label-caps">Form Name</Label>
              <Input value={aiEditName} onChange={(e) => setAiEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="label-caps">Record ID Prefix</Label>
              <Input value={aiEditPrefix} onChange={(e) => setAiEditPrefix(e.target.value)}
                placeholder="e.g. FORM_PSP_QI_" className="mt-1 font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">Number auto-generates on save (001, 002…)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiEditOpen(false)}>Cancel</Button>
            <Button onClick={() => aiEditMutation.mutate()} disabled={aiEditMutation.isPending}>
              {aiEditMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Inspection Form Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="label-caps">Part Name *</Label>
              <Input placeholder="Type part name..." value={form.part_name_input}
                onChange={(e) => setForm({ ...form, part_name_input: e.target.value })} className="mt-1" list="parts-datalist" />
              <datalist id="parts-datalist">{parts.map((p) => (<option key={p.id} value={p.part_name} />))}</datalist>
            </div>
            <div>
              <Label className="label-caps">Record ID *</Label>
              <Input placeholder="e.g. INS-FORM-001" value={form.record_id}
                onChange={(e) => setForm({ ...form, record_id: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="label-caps">Tolerance *</Label>
              <Input type="number" min={0} placeholder="e.g. 0.5" value={form.tolerance}
                onChange={(e) => setForm({ ...form, tolerance: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="label-caps">A</Label><Input placeholder="Field A" value={form.field_a} onChange={(e) => setForm({ ...form, field_a: e.target.value })} className="mt-1" /></div>
              <div><Label className="label-caps">B</Label><Input placeholder="Field B" value={form.field_b} onChange={(e) => setForm({ ...form, field_b: e.target.value })} className="mt-1" /></div>
              <div><Label className="label-caps">C</Label><Input placeholder="Field C" value={form.field_c} onChange={(e) => setForm({ ...form, field_c: e.target.value })} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!canSave || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Inspection Form Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="label-caps">Part Name *</Label><Input placeholder="Type part name..." value={form.part_name_input}
              onChange={(e) => setForm({ ...form, part_name_input: e.target.value })} className="mt-1" list="parts-datalist" />
              <datalist id="parts-datalist">{parts.map((p) => (<option key={p.id} value={p.part_name} />))}</datalist>
            </div>
            <div><Label className="label-caps">Record ID *</Label><Input placeholder="e.g. INS-FORM-001" value={form.record_id}
              onChange={(e) => setForm({ ...form, record_id: e.target.value })} className="mt-1" /></div>
            <div><Label className="label-caps">Tolerance *</Label><Input type="number" min={0} placeholder="e.g. 0.5"
              value={form.tolerance} onChange={(e) => setForm({ ...form, tolerance: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="label-caps">A</Label><Input placeholder="Field A" value={form.field_a} onChange={(e) => setForm({ ...form, field_a: e.target.value })} className="mt-1" /></div>
              <div><Label className="label-caps">B</Label><Input placeholder="Field B" value={form.field_b} onChange={(e) => setForm({ ...form, field_b: e.target.value })} className="mt-1" /></div>
              <div><Label className="label-caps">C</Label><Input placeholder="Field C" value={form.field_c} onChange={(e) => setForm({ ...form, field_c: e.target.value })} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editRecord && saveMutation.mutate({ ...form, id: editRecord.id })} disabled={!canSave || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocxUploadDialog open={docxOpen} onOpenChange={setDocxOpen} />

      {/* ── View / Fill Form Dialog ── */}
      <Dialog open={!!viewRecord} onOpenChange={(v) => { if (!v) { setViewRecord(null); setFormValues({}); setFillMode(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-4 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm">{fillMode ? "Fill Form" : "Form Preview"}</DialogTitle>
              {!fillMode && (
                <Button variant="outline" size="sm" onClick={() => {
                  setFillMode(true);
                  const vals: Record<string, string | number | boolean> = {};
                  viewRecord?.form_schema?.sections?.forEach((s: any) =>
                    s.fields?.forEach((f: any) => { if (f.prefill_from_template) vals[f.key] = f.prefill_from_template; })
                  );
                  setFormValues(vals);
                }}>
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> Fill Form
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="px-6 pb-4">
            {viewRecord?.form_schema && (
              <FormSchemaRenderer schema={viewRecord.form_schema} values={formValues}
                onChange={fillMode ? (key, value) => setFormValues(v => ({ ...v, [key]: value })) : undefined}
                readOnly={!fillMode} />
            )}
          </div>
          {fillMode && (
            <div className="flex justify-end gap-2 px-6 pb-4 pt-3 border-t">
              <Button variant="outline" onClick={() => { setFillMode(false); setFormValues({}); }}>Cancel</Button>
              <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                <Save className="h-3.5 w-3.5 mr-1.5" /> Submit
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
