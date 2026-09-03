import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, ChevronDown, Loader2, PackageX } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { TableSkeleton } from "@/components/inventory/skeletons";
import { MaterialBadge } from "@/components/inventory/material-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate, fmtKg, wastageReasonLabel, WASTAGE_REASONS } from "@/lib/inventory/format";
import { audit } from "@/lib/inventory/audit";

export const Route = createFileRoute("/_authenticated/wastage")({
  component: WastagePage,
});

const schema = z.object({
  raw_material_id: z.string().min(1, "Select a raw material batch"),
  wastage_kg: z.coerce.number().positive("Wastage must be > 0"),
  reason: z.string().min(1, "Select a reason"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface WastageRow {
  id: string;
  reference_id: string;
  level_name: string;
  wastage_kg: number;
  reason: string;
  notes: string | null;
  created_at: string;
  raw_materials?: { batch_number: string | null; material_type: string | null } | null;
}

function WastagePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WastageRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wastage", "raw"],
    queryFn: async () => {
      const [logs, rms] = await Promise.all([
        supabase
          .from("wastage_logs")
          .select("id, reference_id, level_name, wastage_kg, reason, notes, created_at")
          .eq("level", "raw")
          .order("created_at", { ascending: false }),
        supabase.from("raw_materials").select("id, batch_number, material_type"),
      ]);
      const rmMap = new Map((rms.data ?? []).map((r: any) => [r.id, r]));
      return (logs.data ?? []).map((l: any) => ({
        ...l,
        raw_materials: rmMap.get(l.reference_id) ?? null,
      }));
    },
  });

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (row: WastageRow) => {
    setEditing(row);
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Wastage"
        subtitle="Manual raw material wastage entries"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-3.5 w-3.5" /> Add wastage
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <PackageX className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No wastage entries yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Raw material</TableHead>
                  <TableHead className="text-right">Wastage (kg)</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/stock-history/raw/$id"
                        params={{ id: r.reference_id }}
                        className="font-medium hover:underline"
                      >
                        {r.raw_materials?.batch_number ?? r.level_name}
                      </Link>
                      <span className="ml-2 align-middle">
                        {r.raw_materials?.material_type && (
                          <MaterialBadge material={r.raw_materials.material_type} />
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right num font-medium">
                      {fmtKg(r.wastage_kg)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{wastageReasonLabel(r.reason)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <WastageDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["wastage", "raw"] });
          qc.invalidateQueries({ queryKey: ["stock-history"] });
          qc.invalidateQueries({ queryKey: ["stock"] });
          if (editing) {
            qc.invalidateQueries({
              queryKey: ["stock-history", "raw", editing.reference_id],
            });
          }
        }}
      />
    </div>
  );
}

function WastageDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: WastageRow | null;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [rmSearch, setRmSearch] = useState("");
  const [rmFocused, setRmFocused] = useState(false);

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw_materials", "for_wastage"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      ((
        await supabase
          .from("raw_materials")
          .select("id, batch_number, material_type, remaining_quantity_kg, is_blocked")
          .order("batch_number")
      ).data as any[]) ?? [],
  });
  const rms = rawMaterials.filter((rm: any) => !rm.is_blocked);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { raw_material_id: "", wastage_kg: 0, reason: "", notes: "" },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setRmSearch("");
      return;
    }
    if (editing) {
      form.reset({
        raw_material_id: editing.reference_id,
        wastage_kg: Number(editing.wastage_kg),
        reason: editing.reason,
        notes: editing.notes ?? "",
      });
      setRmSearch(editing.raw_materials?.batch_number ?? editing.level_name ?? "");
    } else {
      form.reset({ raw_material_id: "", wastage_kg: 0, reason: "", notes: "" });
      setRmSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const selectedRm = rms.find((rm: any) => rm.id === form.watch("raw_material_id"));

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const rm = rms.find((r: any) => r.id === v.raw_material_id);
      if (!rm) throw new Error("Raw material batch not found");
      const payload = {
        level: "raw",
        reference_id: v.raw_material_id,
        level_name: rm.batch_number ?? "",
        expected_kg: 0,
        actual_kg: v.wastage_kg,
        wastage_kg: v.wastage_kg,
        reason: v.reason,
        notes: v.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("wastage_logs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wastage_logs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Wastage updated" : "Wastage added");
      audit(editing ? "update" : "create", "wastage");
      qc.invalidateQueries({ queryKey: ["wastage", "raw"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const filtered = rms.filter((rm: any) => {
    const q = rmSearch.toLowerCase();
    return (
      !q ||
      rm.batch_number?.toLowerCase().includes(q) ||
      rm.material_type?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit wastage" : "Add wastage"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <div className="relative">
            <Label className="label-caps">Raw material batch *</Label>
            <div className="relative mt-1">
              <Input
                placeholder="Search raw material..."
                value={rmSearch}
                onChange={(e) => {
                  setRmSearch(e.target.value);
                  if (!e.target.value) form.setValue("raw_material_id", "");
                }}
                onFocus={() => setRmFocused(true)}
                onBlur={() => setTimeout(() => setRmFocused(false), 150)}
                className="pr-8 h-9"
              />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            {rmFocused && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-auto">
                {filtered.map((rm: any) => (
                  <button
                    key={rm.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      form.setValue("raw_material_id", rm.id);
                      setRmSearch(rm.batch_number);
                      setRmFocused(false);
                    }}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{rm.batch_number}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                        {rm.material_type}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {rm.remaining_quantity_kg} kg left
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No raw materials found</p>
                )}
              </div>
            )}
            {form.formState.errors.raw_material_id && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.raw_material_id.message}
              </p>
            )}
          </div>

          {selectedRm && (
            <div className="text-xs text-muted-foreground -mt-2">
              Remaining:{" "}
              <span className="font-medium">{fmtKg(selectedRm.remaining_quantity_kg)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 items-start">
            <div>
              <Label className="label-caps">Wastage (kg) *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                {...form.register("wastage_kg")}
                className="mt-1 h-9"
              />
              {form.formState.errors.wastage_kg && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.wastage_kg.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">Reason *</Label>
              <Select
                value={form.watch("reason")}
                onValueChange={(v) => form.setValue("reason", v)}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {WASTAGE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.reason && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="label-caps">Notes</Label>
            <Textarea
              placeholder="Optional notes..."
              {...form.register("notes")}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Save changes" : "Add wastage"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
