import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Equipment } from "@/integrations/supabase/database.types";
import { audit } from "@/lib/inventory/audit";
import {
  EQUIPMENT_TYPES,
  CALIBRATION_FREQUENCIES,
  STATUS_OPTIONS,
} from "@/lib/inventory/employees";
import { PageHeader } from "@/components/inventory/page-header";
import { TableSkeleton } from "@/components/inventory/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/equipment-edit/$id")({
  ssr: false,
  component: EquipmentEditPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  purchased_date: z.string().min(1, "Required"),
  purchased_from: z.string().trim().min(1, "Required").max(200),
  status: z.enum(["active", "inactive"]),
  calibration_frequency: z.enum(["6_monthly", "yearly"]),
  equipment_type: z.enum(["process", "measuring"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

function EquipmentEditPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Equipment;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: equipment
      ? {
          name: equipment.name,
          purchased_date: equipment.purchased_date,
          purchased_from: equipment.purchased_from,
          status: equipment.status as "active" | "inactive",
          calibration_frequency: equipment.calibration_frequency as "6_monthly" | "yearly",
          equipment_type: equipment.equipment_type as "process" | "measuring",
          notes: equipment.notes ?? "",
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase
        .from("equipment")
        .update({
          name: v.name,
          purchased_date: v.purchased_date,
          purchased_from: v.purchased_from,
          status: v.status,
          calibration_frequency: v.calibration_frequency,
          equipment_type: v.equipment_type,
          notes: v.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipment updated");
      qc.invalidateQueries({ queryKey: ["equipment"] });
      qc.invalidateQueries({ queryKey: ["equipment", id] });
      audit("update", "equipment", id);
      navigate({ to: "/equipment" });
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <TableSkeleton />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Equipment not found.</p>
        <Link to="/equipment">
          <Button variant="link" className="mt-2">
            Back to Equipment
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Edit Equipment"
        description={`Editing ${equipment.equipment_id} — ${equipment.name}`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/equipment" })}
            className="text-[13px]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Equipment
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5 max-w-2xl">
            <div>
              <Label className="label-caps">Name of Equipment *</Label>
              <Input {...form.register("name")} className="mt-1" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="label-caps">Purchased Date *</Label>
                <Input type="date" {...form.register("purchased_date")} className="mt-1" />
                {form.formState.errors.purchased_date && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.purchased_date.message}
                  </p>
                )}
              </div>
              <div>
                <Label className="label-caps">Purchased From *</Label>
                <Input {...form.register("purchased_from")} className="mt-1" />
                {form.formState.errors.purchased_from && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.purchased_from.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label className="label-caps">Equipment Status *</Label>
              <RadioGroup
                value={form.watch("status")}
                onValueChange={(v) =>
                  form.setValue("status", v as "active" | "inactive", {
                    shouldValidate: true,
                  })
                }
                className="flex flex-row gap-4 mt-1"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value} id={`eq-status-${opt.value}`} />
                    <Label htmlFor={`eq-status-${opt.value}`} className="cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="label-caps">Calibration Frequency *</Label>
              <RadioGroup
                value={form.watch("calibration_frequency")}
                onValueChange={(v) =>
                  form.setValue("calibration_frequency", v as "6_monthly" | "yearly", {
                    shouldValidate: true,
                  })
                }
                className="flex flex-row gap-4 mt-1"
              >
                {CALIBRATION_FREQUENCIES.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value} id={`eq-cal-${opt.value}`} />
                    <Label htmlFor={`eq-cal-${opt.value}`} className="cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="label-caps">Equipment Type *</Label>
              <RadioGroup
                value={form.watch("equipment_type")}
                onValueChange={(v) =>
                  form.setValue("equipment_type", v as "process" | "measuring", {
                    shouldValidate: true,
                  })
                }
                className="flex flex-row gap-4 mt-1"
              >
                {EQUIPMENT_TYPES.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value} id={`eq-type-${opt.value}`} />
                    <Label htmlFor={`eq-type-${opt.value}`} className="cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="label-caps">Notes</Label>
              <Textarea rows={3} {...form.register("notes")} className="mt-1" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/equipment" })}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
