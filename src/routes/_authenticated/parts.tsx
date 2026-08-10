import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Puzzle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Loader2,
  Factory,
  ClipboardCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Part, PartBatch } from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { EmptyState } from "@/components/inventory/empty-state";
import { MaterialBadge } from "@/components/inventory/material-badge";
import { TableSkeleton } from "@/components/inventory/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WASTAGE_REASONS,
  fmtDate,
  fmtKg,
  fmtNum,
  wastageReasonLabel,
} from "@/lib/inventory/format";
import { PartProduceDialog } from "@/components/inventory/part-produce-dialog";
import { audit } from "@/lib/inventory/audit";

export const Route = createFileRoute("/_authenticated/parts")({
  component: PartsPage,
});

const schema = z.object({
  part_name: z.string().trim().min(1).max(100),
  part_code: z.string().trim().max(20).optional().or(z.literal("")),
  material_type: z.string().min(1, "Required").max(40),
  masterbatch_id: z.string().optional().or(z.literal("")),
  masterbatch_qty_kg: z.coerce.number().min(0).optional(),
  consumption_per_unit_kg: z.coerce.number().positive("Must be > 0"),
  low_stock_threshold: z.coerce.number().min(0),
  notes: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

type PartBatchJoined = PartBatch & {
  raw_materials?: { batch_number: string; vendors?: { name: string } | null } | null;
};

function PartsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Part | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [produce, setProduce] = useState<Part | null>(null);

  const { data: parts, isLoading } = useQuery({
    queryKey: ["parts", "all"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      ((await supabase.from("parts").select("*").order("part_name")).data as Part[]) ?? [],
  });

  const totalStock = (parts ?? []).reduce((s, p) => s + Number(p.current_stock), 0);
  const knownMaterials = Array.from(new Set((parts ?? []).map((p) => p.material_type))).sort();

  return (
    <div>
      <PageHeader
        title="Parts"
        subtitle={`${parts?.length ?? 0} parts · ${fmtNum(totalStock)} units total in stock`}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Part
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : (parts ?? []).length === 0 ? (
            <EmptyState
              icon={Puzzle}
              title="No parts yet"
              description="Define the parts that make up your products."
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Part
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Consumption/unit</TableHead>
                  <TableHead className="w-52">Stock vs Threshold</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts?.map((p) => {
                  const pct =
                    p.low_stock_threshold > 0
                      ? Math.min(
                          100,
                          (Number(p.current_stock) / Number(p.low_stock_threshold)) * 100,
                        )
                      : 100;
                  const color =
                    pct > 80 ? "bg-success" : pct > 40 ? "bg-warning" : "bg-destructive";
                  const isOpen = expanded === p.id;
                  return [
                    <TableRow
                      key={p.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{p.part_name}</TableCell>
                      <TableCell>
                        <MaterialBadge material={p.material_type} />
                      </TableCell>
                      <TableCell>{fmtKg(p.consumption_per_unit_kg, 4)}</TableCell>
                      <TableCell>
                        <div className="text-xs mb-1">
                          {fmtNum(p.current_stock)} / {fmtNum(p.low_stock_threshold)}
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${color}`}
                            style={{ width: `${Math.max(3, pct)}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => setProduce(p)}>
                          <Factory className="h-4 w-4" /> Produce
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>,
                    isOpen ? <PartBatchesRow key={`${p.id}-batches`} partId={p.id} /> : null,
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PartForm
        open={addOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditing(null);
          }
        }}
        part={editing}
      />
      <PartProduceDialog
        open={!!produce}
        onOpenChange={(o) => !o && setProduce(null)}
        part={produce}
      />
    </div>
  );
}

function InspectionPicker({ batchId, currentResult }: { batchId: string; currentResult?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isSubmitted = !!currentResult; // inspection_result exists → form was submitted

  const { data: templates = [] } = useQuery({
    queryKey: ["inspection_templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inspection_form_templates")
        .select("id, part_name, record_id, tolerance, field_a, field_b, field_c")
        .order("part_name");
      return (data ?? []) as {
        id: string;
        part_name: string;
        record_id: string;
        tolerance: number;
        field_a: string | null;
        field_b: string | null;
        field_c: string | null;
      }[];
    },
    staleTime: 60_000,
  });

  const filtered = templates.filter(
    (t) =>
      t.part_name.toLowerCase().includes(search.toLowerCase()) ||
      t.record_id.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const select = async (template: (typeof templates)[number]) => {
    // Check if inspection_record already exists for this batch
    const { data: existing } = await supabase
      .from("inspection_records" as any)
      .select("id")
      .eq("batch_id", batchId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      toast.success("Opening existing inspection form");
      setOpen(false);
      setSearch("");
      navigate({ to: "/inspection-form/$batchId", params: { batchId } });
      return;
    }

    // Look up batch_number from part_batches
    const { data: batch } = await supabase
      .from("part_batches")
      .select("batch_number")
      .eq("id", batchId)
      .single();

    const batchNumber = batch?.batch_number ?? "";

    // Generate 39 empty QC rows
    const qcRows = Array.from({ length: 39 }, (_, i) => ({
      part_num: i + 1,
      a_actual: parseFloat(String(template.field_a).replace(/[^0-9.\-]/g, "")) || 0,
      a_measured: 0,
      a_difference: 0,
      b_actual: parseFloat(String(template.field_b).replace(/[^0-9.\-]/g, "")) || 0,
      b_measured: 0,
      b_difference: 0,
      c_actual: parseFloat(String(template.field_c).replace(/[^0-9.\-]/g, "")) || 0,
      c_measured: 0,
      c_difference: 0,
      tolerance: template.tolerance,
      result: "Pending",
    }));

    const { error } = await supabase.from("inspection_records" as any).insert({
      batch_id: batchId,
      template_id: template.id,
      form_id: template.record_id,
      part_name: template.part_name,
      batch_number: batchNumber,
      tolerance: template.tolerance,
      qc_rows: qcRows,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Inspection form created");
      setOpen(false);
      setSearch("");
      navigate({ to: "/inspection-form/$batchId", params: { batchId } });
    }
  };

  // If already submitted → clickable checkmark that opens form in view mode
  if (isSubmitted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-emerald-600"
        title={`Inspection completed — ${currentResult}. Click to view.`}
        onClick={() =>
          navigate({
            to: "/inspection-form/$batchId",
            params: { batchId },
            search: { view: "1" } as any,
          })
        }
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Start inspection">
          <ClipboardCheck className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="text-[11px] font-medium text-muted-foreground mb-1 px-1">
          Select Inspection Form
        </div>
        <Input
          ref={inputRef}
          placeholder="Search by part name or record ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-[12px] mb-1"
        />
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">No templates found</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                className="w-full text-left px-2 py-1.5 text-[12px] rounded hover:bg-blue-50 hover:text-blue-700 transition-colors"
                onClick={() => select(t)}
              >
                <span className="font-medium">{t.part_name}</span>
                <span className="text-muted-foreground ml-1">({t.record_id})</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PartBatchesRow({ partId }: { partId: string }) {
  const { data } = useQuery({
    queryKey: ["parts", partId, "batches"],
    queryFn: async () =>
      ((
        await supabase
          .from("part_batches")
          .select("*, raw_materials(batch_number, vendors(name))")
          .eq("part_id", partId)
          .order("created_at", { ascending: false })
      ).data as unknown as PartBatchJoined[]) ?? [],
  });
  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-muted/20 p-4">
        {(data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No batches yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Raw material</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Wastage</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Inspection Result</TableHead>
                <TableHead>Icons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((b) => (
                <TableRow key={b.id} className={b.is_blocked ? "opacity-50 bg-red-50/30" : ""}>
                  <TableCell className="font-medium">{b.batch_number}</TableCell>
                  <TableCell>{fmtNum(b.quantity)}</TableCell>
                  <TableCell>{b.raw_materials?.batch_number}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(b.created_at)}
                  </TableCell>
                  <TableCell>{fmtKg(b.wastage_kg)}</TableCell>
                  <TableCell className="text-xs">{wastageReasonLabel(b.wastage_reason)}</TableCell>
                  <TableCell>
                    {b.is_blocked ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {(b as any).inspection_result ? (
                      <Badge
                        variant="secondary"
                        className={
                          (b as any).inspection_result === "Pass"
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            : "bg-red-100 text-red-700 border border-red-200"
                        }
                      >
                        {(b as any).inspection_result}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <InspectionPicker batchId={b.id} currentResult={(b as any).inspection_result} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCell>
    </TableRow>
  );
}

function PartForm({
  open,
  onOpenChange,
  part,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  part: Part | null;
}) {
  const qc = useQueryClient();
  const [masterbatchSearch, setMasterbatchSearch] = useState("");
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw_materials", "for_masterbatch"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      ((
        await supabase
          .from("raw_materials")
          .select("id, batch_number, material_type, remaining_quantity_kg")
          .order("batch_number")
      ).data as any[]) ?? [],
  });
  const filteredMb = rawMaterials.filter(
    (rm) =>
      rm.batch_number?.toLowerCase().includes(masterbatchSearch.toLowerCase()) ||
      rm.material_type?.toLowerCase().includes(masterbatchSearch.toLowerCase()),
  );
  const { data: allParts } = useQuery({
    queryKey: ["parts", "list"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      ((await supabase.from("parts").select("part_name,material_type").order("part_name"))
        .data as unknown as Pick<Part, "part_name" | "material_type">[]) ?? [],
  });
  const knownMaterials = Array.from(new Set((allParts ?? []).map((p) => p.material_type))).sort();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      part_name: "",
      part_code: "",
      material_type: "",
      masterbatch_id: "",
      masterbatch_qty_kg: 0,
      consumption_per_unit_kg: 0.01,
      low_stock_threshold: 100,
      notes: "",
    },
    values: part
      ? {
          part_name: part.part_name,
          part_code: part.part_code ?? "",
          material_type: part.material_type,
          masterbatch_id: (part as any).masterbatch_id ?? "",
          masterbatch_qty_kg: Number((part as any).masterbatch_qty_kg ?? 0),
          consumption_per_unit_kg: Number(part.consumption_per_unit_kg),
          low_stock_threshold: Number(part.low_stock_threshold),
          notes: part.notes ?? "",
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload = { ...v, notes: v.notes || null };
      if (part) {
        const { error } = await (supabase.from("parts") as any).update(payload).eq("id", part.id);
        if (error) throw error;
      } else {
        const nameLower = v.part_name.toLowerCase();
        const dup = (allParts ?? []).find((p) => p.part_name.toLowerCase() === nameLower);
        if (dup) throw new Error(`A part named "${dup.part_name}" already exists`);

        // Auto-increment part_code: if prefix like "TPX-" → TPX-001, TPX-002...
        let finalCode = v.part_code || null;
        if (finalCode) {
          const prefix = finalCode; // e.g. "TPX-"
          const existing = (allParts ?? [])
            .filter((p) => p.part_code?.startsWith(prefix))
            .map((p) => {
              const num = parseInt(p.part_code!.slice(prefix.length), 10);
              return isNaN(num) ? 0 : num;
            });
          const nextNum = (existing.length > 0 ? Math.max(...existing) : 0) + 1;
          finalCode = `${prefix}${String(nextNum).padStart(3, "0")}`;
        }
        const payload = { ...v, part_code: finalCode, notes: v.notes || null };
        const { error } = await (supabase.from("parts") as any).insert(payload);
        if (error) {
          if (error.code === "23505")
            throw new Error(`A part named "${v.part_name}" already exists`);
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(part ? "Part updated" : "Part added");
      qc.invalidateQueries({ queryKey: ["parts"] });
      qc.invalidateQueries({ queryKey: ["parts", "all"] });
      qc.invalidateQueries({ queryKey: ["parts", "list"] });
      audit(part ? "update" : "create", "part");
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{part ? "Edit part" : "Add part"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <div>
            <Label className="label-caps">Part name *</Label>
            <Input {...form.register("part_name")} className="mt-1" />
            {form.formState.errors.part_name && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.part_name.message}
              </p>
            )}
          </div>
          <div>
            <Label className="label-caps">Part Code</Label>
            <Input
              {...form.register("part_code")}
              placeholder="e.g. TPX- (auto-increments to TPX-001, TPX-002...)"
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Type the prefix only. Numbers are auto-generated (e.g. TPX- → TPX-001).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-caps">Material *</Label>
              <Input
                {...form.register("material_type")}
                placeholder="e.g. Polypropylene, Nylon-6, ABS"
                list="known-materials-part"
                className="mt-1"
              />
              <datalist id="known-materials-part">
                {knownMaterials.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {form.formState.errors.material_type && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.material_type.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">Consumption/unit (kg) *</Label>
              <Input
                type="number"
                step="0.0001"
                {...form.register("consumption_per_unit_kg")}
                className="mt-1"
              />
              {form.formState.errors.consumption_per_unit_kg && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.consumption_per_unit_kg.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Label className="label-caps">Masterbatch</Label>
              <Input
                placeholder="Search raw material batches..."
                value={
                  masterbatchSearch ||
                  (form.watch("masterbatch_id")
                    ? (rawMaterials.find((rm) => rm.id === form.watch("masterbatch_id"))
                        ?.batch_number ?? "")
                    : "")
                }
                onChange={(e) => {
                  setMasterbatchSearch(e.target.value);
                  if (!e.target.value) form.setValue("masterbatch_id", "");
                }}
                onFocus={() => setMasterbatchSearch("")}
                className="mt-1"
              />
              {masterbatchSearch && filteredMb.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                  {filteredMb.map((rm) => (
                    <button
                      key={rm.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => {
                        form.setValue("masterbatch_id", rm.id);
                        setMasterbatchSearch(rm.batch_number);
                      }}
                    >
                      <span className="font-medium">{rm.batch_number}</span>
                      <span className="text-muted-foreground ml-2">
                        ({rm.material_type}) — {rm.remaining_quantity_kg} kg
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="label-caps">Masterbatch quantity (kg)</Label>
              <Input
                type="number"
                step="0.001"
                {...form.register("masterbatch_qty_kg")}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="label-caps">Low stock threshold</Label>
            <Input
              type="number"
              step="0.001"
              {...form.register("low_stock_threshold")}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="label-caps">Notes</Label>
            <Textarea rows={2} {...form.register("notes")} className="mt-1" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
