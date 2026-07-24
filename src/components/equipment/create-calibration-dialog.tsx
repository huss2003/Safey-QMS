import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, FlaskConical } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/inventory/audit";
import { EMPLOYEES } from "@/lib/inventory/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  calibration_date: z.string().min(1, "Required"),
  managed_by: z.string().min(1, "Required"),
  lab_name: z.string().trim().min(1, "Required").max(200),
  lab_address: z.string().trim().min(1, "Required").max(500),
  notes: z.string().max(1000).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});
type FormValues = z.infer<typeof schema>;

export function CreateCalibrationDialog({
  open,
  onOpenChange,
  equipmentId,
  calibrationFrequency,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  equipmentId: string;
  calibrationFrequency: string;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      calibration_date: new Date().toISOString().slice(0, 10),
      managed_by: "",
      lab_name: "",
      lab_address: "",
      notes: "",
      status: "active",
    },
  });

  // Auto-calculated next calibration date (read-only)
  const calibrationDate = form.watch("calibration_date");
  const nextCalDate = (() => {
    if (!calibrationDate) return "";
    const d = new Date(calibrationDate);
    const months = calibrationFrequency === "6_monthly" ? 6 : 12;
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  })();

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
      const path = `${equipmentId}/calibration/${Date.now()}_${selected.name}`;
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
      const { error } = await (supabase as any).from("equipment_calibrations").insert({
        equipment_id: equipmentId,
        calibration_date: v.calibration_date,
        calibration_managed_by: v.managed_by,
        lab_name: v.lab_name,
        lab_address: v.lab_address,
        next_calibration_date: nextCalDate,
        calibration_report_url: uploadedUrl || null,
        calibration_status: v.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Calibration record added");
      qc.invalidateQueries({ queryKey: ["equipment", equipmentId, "calibrations"] });
      audit("create", "equipment_calibration");
      onOpenChange(false);
      form.reset();
      setFile(null);
      setUploadedUrl(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Add Calibration Record
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          {/* Row 1: Date + Managed By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">
                Calibration Date <span className="text-destructive">*</span>
              </Label>
              <Input type="date" {...form.register("calibration_date")} className="mt-1" />
              {form.formState.errors.calibration_date && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.calibration_date.message}
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

          {/* Row 2: Lab Name + Lab Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">
                Name of Lab <span className="text-destructive">*</span>
              </Label>
              <Input {...form.register("lab_name")} className="mt-1" />
              {form.formState.errors.lab_name && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.lab_name.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">
                Address of Lab <span className="text-destructive">*</span>
              </Label>
              <Textarea rows={3} {...form.register("lab_address")} className="mt-1" />
              {form.formState.errors.lab_address && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.lab_address.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 3: Next Date (read-only) + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">Next Calibration Date</Label>
              <Input type="date" value={nextCalDate} readOnly className="mt-1 bg-muted/50" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Auto-calculated based on calibration frequency
              </p>
            </div>
            <div>
              <Label className="label-caps">
                Calibration Status <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={form.watch("status")}
                onValueChange={(v) =>
                  form.setValue("status", v as "active" | "inactive", { shouldValidate: true })
                }
                className="flex flex-row gap-4 mt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="active" id="cal-active" />
                  <Label htmlFor="cal-active" className="cursor-pointer">
                    Active
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="inactive" id="cal-inactive" />
                  <Label htmlFor="cal-inactive" className="cursor-pointer">
                    Inactive
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="label-caps">Notes</Label>
            <Textarea rows={2} {...form.register("notes")} className="mt-1" />
          </div>

          {/* File Upload */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <Label className="label-caps">Upload Report</Label>
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
