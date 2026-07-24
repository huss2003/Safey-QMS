import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, Settings2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/inventory/audit";
import { EMPLOYEES } from "@/lib/inventory/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const schema = z.object({
  adjustment_date: z.string().min(1, "Required"),
  managed_by: z.string().min(1, "Required"),
  notes: z.string().trim().min(1, "Required").max(1000),
  measurements_before: z.coerce.number({ invalid_type_error: "Must be a number" }),
  measurements_after: z.coerce.number({ invalid_type_error: "Must be a number" }),
  company_name: z.string().trim().min(1, "Required").max(200),
  company_address: z.string().trim().min(1, "Required").max(500),
});
type FormValues = z.infer<typeof schema>;

export function CreateAdjustmentDialog({
  open,
  onOpenChange,
  equipmentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  equipmentId: string;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      adjustment_date: new Date().toISOString().slice(0, 10),
      managed_by: "",
      notes: "",
      measurements_before: 0,
      measurements_after: 0,
      company_name: "",
      company_address: "",
    },
  });

  const before = form.watch("measurements_before");
  const after = form.watch("measurements_after");
  const deviation = before !== 0 ? (((after - before) / before) * 100).toFixed(2) : "0.00";

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error("Only PDF, JPEG, and PNG files are allowed");
      return;
    }
    if (selected.size > MAX_SIZE) {
      toast.error("File must be under 10MB");
      return;
    }

    setFile(selected);
    setUploading(true);
    try {
      const path = `${equipmentId}/adjustment/${Date.now()}_${selected.name}`;
      const { error } = await supabase.storage
        .from("equipment-files")
        .upload(path, selected, { contentType: selected.type });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("equipment-files").getPublicUrl(path);
      setUploadedUrl(urlData.publicUrl);
      toast.success("File uploaded");
    } catch (err) {
      toast.error((err as Error).message ?? "Upload failed");
      setFile(null);
      setUploadedUrl(null);
    } finally {
      setUploading(false);
    }
  }

  function removeFile() {
    setFile(null);
    setUploadedUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await (supabase as any).from("equipment_adjustments").insert({
        equipment_id: equipmentId,
        adjustment_date: v.adjustment_date,
        adjustment_managed_by: v.managed_by,
        adjustment_notes: v.notes,
        measurements_before: String(v.measurements_before),
        measurements_after: String(v.measurements_after),
        company_name: v.company_name,
        company_address: v.company_address,
        evidence_url: uploadedUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adjustment record added");
      qc.invalidateQueries({ queryKey: ["equipment", equipmentId, "adjustments"] });
      audit("create", "equipment_adjustment");
      onOpenChange(false);
      form.reset();
      setFile(null);
      setUploadedUrl(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const devNum = parseFloat(deviation);
  const devColor =
    devNum === 0
      ? "text-muted-foreground"
      : Math.abs(devNum) <= 5
        ? "text-success"
        : "text-destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Add Adjustment Record
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          {/* Row 1: Date + Managed By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">
                Adjustment Date <span className="text-destructive">*</span>
              </Label>
              <Input type="date" {...form.register("adjustment_date")} className="mt-1" />
              {form.formState.errors.adjustment_date && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.adjustment_date.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">
                Managed By <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("managed_by")}
                onValueChange={(v) => form.setValue("managed_by", v, { shouldValidate: true })}
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
              {form.formState.errors.managed_by && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.managed_by.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Notes */}
          <div>
            <Label className="label-caps">
              Adjustment Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea rows={3} {...form.register("notes")} className="mt-1" />
            {form.formState.errors.notes && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.notes.message}</p>
            )}
          </div>

          {/* Row 3: Measurement Before + After + Deviation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="label-caps">
                Measurement Before <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                {...form.register("measurements_before")}
                className="mt-1"
              />
              {form.formState.errors.measurements_before && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.measurements_before.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">
                Measurement After <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                {...form.register("measurements_after")}
                className="mt-1"
              />
              {form.formState.errors.measurements_after && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.measurements_after.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">Deviation (%)</Label>
              <div className="mt-1 h-10 flex items-center px-3 rounded-md border bg-muted/50">
                <span className={`text-sm font-medium ${devColor}`}>{deviation}%</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Auto-calculated from before/after
              </p>
            </div>
          </div>

          {/* Row 4: Company Name + Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input {...form.register("company_name")} className="mt-1" />
              {form.formState.errors.company_name && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.company_name.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">
                Company Address <span className="text-destructive">*</span>
              </Label>
              <Textarea rows={2} {...form.register("company_address")} className="mt-1" />
              {form.formState.errors.company_address && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.company_address.message}
                </p>
              )}
            </div>
          </div>

          {/* File Upload */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <Label className="label-caps">Upload Evidence</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex items-center gap-3 mt-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{file.name}</span>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : uploadedUrl ? (
                  <span className="text-xs text-success">Uploaded</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={removeFile}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Choose File
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">PDF, JPEG, or PNG — max 10MB</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || uploading}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
