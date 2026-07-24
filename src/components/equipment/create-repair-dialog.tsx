import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, Wrench } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/inventory/audit";
import { EMPLOYEES, TEST_RUN_OPTIONS } from "@/lib/inventory/employees";
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
  repair_date: z.string().min(1, "Required"),
  notes: z.string().trim().min(1, "Required").max(1000),
  repaired_by: z.string().min(1, "Required"),
  test_run: z.enum(["success", "failed"]),
  test_run_notes: z.string().max(1000).optional().or(z.literal("")),
  tested_by: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

export function CreateRepairDialog({
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
      repair_date: new Date().toISOString().slice(0, 10),
      notes: "",
      repaired_by: "",
      test_run: "success",
      test_run_notes: "",
      tested_by: "",
    },
  });

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
      const path = `${equipmentId}/repair/${Date.now()}_${selected.name}`;
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
      const { error } = await supabase.from("equipment_repairs").insert({
        equipment_id: equipmentId,
        repair_date: v.repair_date,
        repair_notes: v.notes,
        repaired_by: v.repaired_by,
        test_run: v.test_run,
        test_run_notes: v.test_run_notes || "",
        tested_by: v.tested_by,
        document_url: uploadedUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Repair record added");
      qc.invalidateQueries({ queryKey: ["equipment", equipmentId, "repairs"] });
      audit("create", "equipment_repair");
      onOpenChange(false);
      form.reset();
      removeFile();
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Add Repair Record
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
          {/* Row 1: Date + Repaired By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">
                Repair Date <span className="text-destructive">*</span>
              </Label>
              <Input type="date" {...form.register("repair_date")} className="mt-1" />
              {form.formState.errors.repair_date && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.repair_date.message}
                </p>
              )}
            </div>
            <div>
              <Label className="label-caps">
                Repaired By <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("repaired_by")}
                onValueChange={(v) => form.setValue("repaired_by", v, { shouldValidate: true })}
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
              {form.formState.errors.repaired_by && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.repaired_by.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Repair Notes */}
          <div>
            <Label className="label-caps">
              Repair Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea rows={3} {...form.register("notes")} className="mt-1" />
            {form.formState.errors.notes && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.notes.message}</p>
            )}
          </div>

          {/* Row 3: Test Run + Tested By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">
                Test Run <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={form.watch("test_run")}
                onValueChange={(v) =>
                  form.setValue("test_run", v as "success" | "failed", { shouldValidate: true })
                }
                className="flex flex-row gap-4 mt-2"
              >
                {TEST_RUN_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value} id={`test-${opt.value}`} />
                    <Label htmlFor={`test-${opt.value}`} className="cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label className="label-caps">
                Tested By <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("tested_by")}
                onValueChange={(v) => form.setValue("tested_by", v, { shouldValidate: true })}
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
              {form.formState.errors.tested_by && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.tested_by.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 4: Test Run Notes */}
          <div>
            <Label className="label-caps">Test Run Notes</Label>
            <Textarea rows={2} {...form.register("test_run_notes")} className="mt-1" />
          </div>

          {/* File Upload */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <Label className="label-caps">Supporting Document</Label>
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
            <p className="text-[11px] text-muted-foreground mt-1">
              PDF, JPEG, or PNG — max 10 MB
            </p>
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
