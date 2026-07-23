import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/inventory/audit";
import { EMPLOYEES, MAINTENANCE_TYPES } from "@/lib/inventory/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

const schema = z.object({
  maintenance_date: z.string().min(1, "Required"),
  maintenance_done_by: z.string().min(1, "Required"),
  maintenance_types: z.array(z.string()).min(1, "Select at least one maintenance type"),
});
type FormValues = z.infer<typeof schema>;

export function CreateMaintenanceDialog({
  open,
  onOpenChange,
  equipmentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  equipmentId: string;
}) {
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      maintenance_date: new Date().toISOString().slice(0, 10),
      maintenance_done_by: "",
      maintenance_types: [],
    },
  });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase.from("equipment_maintenance").insert({
        equipment_id: equipmentId,
        maintenance_date: v.maintenance_date,
        maintenance_done_by: v.maintenance_done_by,
        maintenance_types: v.maintenance_types,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Maintenance record added");
      qc.invalidateQueries({ queryKey: ["equipment", equipmentId, "maintenance"] });
      audit("create", "equipment_maintenance");
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const types = form.watch("maintenance_types") ?? [];

  function toggleType(val: string) {
    const next = types.includes(val) ? types.filter((t) => t !== val) : [...types, val];
    form.setValue("maintenance_types", next, { shouldValidate: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Add Maintenance Record
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          {/* Row 1: Date + Done By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">
                Maintenance Date <span className="text-destructive">*</span>
              </Label>
              <Input type="date" {...form.register("maintenance_date")} className="mt-1" />
              {form.formState.errors.maintenance_date && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.maintenance_date.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">
                Maintenance Done By <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("maintenance_done_by")}
                onValueChange={(v) =>
                  form.setValue("maintenance_done_by", v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.maintenance_done_by && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.maintenance_done_by.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Maintenance Types (multi-checkboxes) */}
          <div>
            <Label className="label-caps">
              Maintenance Types <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {MAINTENANCE_TYPES.map((mt) => (
                <div
                  key={mt.value}
                  role="checkbox"
                  aria-checked={types.includes(mt.value)}
                  tabIndex={0}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 transition-colors cursor-pointer ${
                    types.includes(mt.value)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => toggleType(mt.value)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggleType(mt.value);
                    }
                  }}
                >
                  <Checkbox
                    id={`mt-${mt.value}`}
                    checked={types.includes(mt.value)}
                    onCheckedChange={() => toggleType(mt.value)}
                  />
                  <Label htmlFor={`mt-${mt.value}`} className="cursor-pointer text-sm">
                    {mt.label}
                  </Label>
                </div>
              ))}
            </div>
            {form.formState.errors.maintenance_types && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.maintenance_types.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
