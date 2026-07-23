import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/inventory/audit";
import {
  EQUIPMENT_TYPES,
  CALIBRATION_FREQUENCIES,
  STATUS_OPTIONS,
} from "@/lib/inventory/employees";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/equipment-new")({
  ssr: false,
  component: EquipmentNewPage,
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

function EquipmentNewPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      purchased_date: new Date().toISOString().slice(0, 10),
      purchased_from: "",
      status: "active",
      calibration_frequency: "yearly",
      equipment_type: "process",
      notes: "",
    },
  });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const { data, error } = await supabase
        .from("equipment")
        .insert({
          name: v.name,
          purchased_date: v.purchased_date,
          purchased_from: v.purchased_from,
          status: v.status,
          calibration_frequency: v.calibration_frequency,
          equipment_type: v.equipment_type,
          notes: v.notes || null,
        })
        .select("equipment_id")
        .single();
      if (error) throw error;
      return data.equipment_id;
    },
    onSuccess: (eqId) => {
      toast.success(`Equipment added: ${eqId}`);
      qc.invalidateQueries({ queryKey: ["equipment"] });
      audit("create", "equipment", eqId);
      navigate({ to: "/equipment" });
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <div>
      <PageHeader
        title="New Equipment"
        description="Add a new process or measuring equipment item."
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
                Save Equipment
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
