import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, ShieldCheck } from "lucide-react";

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

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      maintenance_date: new Date().toISOString().slice(0, 10),
      maintenance_done_by: "",
      maintenance_types: [],
    },
  });

  const types = form.watch("maintenance_types") ?? [];

  function toggleType(val: string) {
    const next = types.includes(val) ? types.filter((t) => t !== val) : [...types, val];
    form.setValue("maintenance_types", next, { shouldValidate: true });
  }

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
      const path = `${equipmentId}/maintenance/${Date.now()}_${selected.name}`;
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
      const { error } = await (supabase as any).from("equipment_maintenance").insert({
        equipment_id: equipmentId,
        maintenance_date: v.maintenance_date,
        maintenance_done_by: v.maintenance_done_by,
        maintenance_types: v.maintenance_types,
        document_url: uploadedUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Maintenance record added");
      qc.invalidateQueries({ queryKey: ["equipment", equipmentId, "maintenance"] });
      audit("create", "equipment_maintenance");
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
            <p className="text-[11px] text-muted-foreground mt-1">PDF, JPEG, or PNG — max 10 MB</p>
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
