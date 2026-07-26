import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  id: string;
  part_name: string;
  part_code: string;
}

interface InspectionTemplate {
  id: string;
  part_id: string;
  part_name: string;
  record_id: string;
  tolerance: number;
  field_a: string | null;
  field_b: string | null;
  field_c: string | null;
  created_at: string;
}

interface FormValues {
  part_id: string;
  part_name_input: string;
  record_id: string;
  tolerance: number | string;
  field_a: string;
  field_b: string;
  field_c: string;
}

function InspectionFormTemplatePage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<InspectionTemplate | null>(null);
  const [form, setForm] = useState<FormValues>({ part_id: "", part_name_input: "", record_id: "", tolerance: "", field_a: "", field_b: "", field_c: "" });

  const { data: parts = [], isLoading: loadingParts } = useQuery({
    queryKey: ["parts_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts")
        .select("id, part_name, part_code")
        .order("part_name");
      if (error) throw error;
      return (data ?? []) as PartOption[];
    },
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["inspection_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_form_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InspectionTemplate[];
    },
  });

  const partMap = new Map(parts.map((p) => [p.id, `${p.part_name} (${p.part_code})`]));

  const saveMutation = useMutation({
    mutationFn: async (v: FormValues & { id?: string }) => {
      const matched = parts.find((p) => p.part_name.toLowerCase() === v.part_name_input.toLowerCase());
      const partId = matched?.id ?? v.part_id;
      const partName = v.part_name_input || (matched ? `${matched.part_name} (${matched.part_code})` : v.part_id);
      const fields = { field_a: v.field_a || null, field_b: v.field_b || null, field_c: v.field_c || null };
      if (v.id) {
        const { error } = await supabase
          .from("inspection_form_templates")
          .update({ part_id: partId, part_name: partName, record_id: v.record_id, tolerance: Number(v.tolerance), ...fields })
          .eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("inspection_form_templates")
          .insert({ part_id: partId, part_name: partName, record_id: v.record_id, tolerance: Number(v.tolerance), ...fields });
        if (error) throw error;
      }
    },
    onSuccess: (_, v) => {
      toast.success(v.id ? "Template updated" : "Template created");
      qc.invalidateQueries({ queryKey: ["inspection_templates"] });
      setAddOpen(false);
      setEditOpen(false);
      setForm({ part_id: "", part_name_input: "", record_id: "", tolerance: "", field_a: "", field_b: "", field_c: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspection_form_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["inspection_templates"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const openAdd = () => {
    setForm({ part_id: "", part_name_input: "", record_id: "", tolerance: "", field_a: "", field_b: "", field_c: "" });
    setAddOpen(true);
  };

  const openEdit = (r: InspectionTemplate) => {
    setEditRecord(r);
    setForm({ part_id: r.part_id, part_name_input: r.part_name, record_id: r.record_id, tolerance: r.tolerance, field_a: r.field_a ?? "", field_b: r.field_b ?? "", field_c: r.field_c ?? "" });
    setEditOpen(true);
  };

  const canSave = form.part_name_input && form.record_id && form.tolerance !== "" && Number(form.tolerance) > 0;

  if (isLoading || loadingParts) {
    return <div className="p-4"><TableSkeleton /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Inspection Form Template"
        description="Create inspection form templates linked to parts with tolerance settings."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="p-4">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inspection form templates created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 border-b">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Part Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Record ID</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Tolerance</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id} className="border-b border-border/40">
                      <TableCell className="text-[13px] font-medium">{t.part_name}</TableCell>
                      <TableCell className="text-[12.5px] font-mono text-muted-foreground">{t.record_id}</TableCell>
                      <TableCell className="text-[12.5px]">
                        <Badge variant="secondary">{t.tolerance}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Inspection Form Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="label-caps">Part Name *</Label>
              <Input
                placeholder="Type part name..."
                value={form.part_name_input}
                onChange={(e) => setForm({ ...form, part_name_input: e.target.value })}
                className="mt-1"
                list="parts-datalist"
              />
              <datalist id="parts-datalist">
                {parts.map((p) => (
                  <option key={p.id} value={p.part_name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label className="label-caps">Record ID of the Form *</Label>
              <Input
                placeholder="e.g. INS-FORM-001"
                value={form.record_id}
                onChange={(e) => setForm({ ...form, record_id: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="label-caps">Tolerance *</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 0.5"
                value={form.tolerance}
                onChange={(e) => setForm({ ...form, tolerance: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="label-caps">A</Label>
                <Input
                  placeholder="Field A"
                  value={form.field_a}
                  onChange={(e) => setForm({ ...form, field_a: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="label-caps">B</Label>
                <Input
                  placeholder="Field B"
                  value={form.field_b}
                  onChange={(e) => setForm({ ...form, field_b: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="label-caps">C</Label>
                <Input
                  placeholder="Field C"
                  value={form.field_c}
                  onChange={(e) => setForm({ ...form, field_c: e.target.value })}
                  className="mt-1"
                />
              </div>
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

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Inspection Form Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="label-caps">Part Name *</Label>
              <Input
                placeholder="Type part name..."
                value={form.part_name_input}
                onChange={(e) => setForm({ ...form, part_name_input: e.target.value })}
                className="mt-1"
                list="parts-datalist"
              />
              <datalist id="parts-datalist">
                {parts.map((p) => (
                  <option key={p.id} value={p.part_name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label className="label-caps">Record ID of the Form *</Label>
              <Input
                placeholder="e.g. INS-FORM-001"
                value={form.record_id}
                onChange={(e) => setForm({ ...form, record_id: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="label-caps">Tolerance *</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 0.5"
                value={form.tolerance}
                onChange={(e) => setForm({ ...form, tolerance: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="label-caps">A</Label>
                <Input
                  placeholder="Field A"
                  value={form.field_a}
                  onChange={(e) => setForm({ ...form, field_a: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="label-caps">B</Label>
                <Input
                  placeholder="Field B"
                  value={form.field_b}
                  onChange={(e) => setForm({ ...form, field_b: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="label-caps">C</Label>
                <Input
                  placeholder="Field C"
                  value={form.field_c}
                  onChange={(e) => setForm({ ...form, field_c: e.target.value })}
                  className="mt-1"
                />
              </div>
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
    </div>
  );
}
