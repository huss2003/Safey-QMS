import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Wand2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { extractDocxText } from "@/integrations/supabase/storage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { FormSchema, GenerateStatus, GenerateSchemaResult } from "@/lib/form-schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  text: "secondary",
  number: "default",
  select: "outline",
  yesno: "secondary",
  date: "outline",
  textarea: "secondary",
  signature: "outline",
  section: "default",
  table: "destructive",
  image: "outline",
};

export function DocxUploadDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<GenerateSchemaResult | null>(null);
  const [editedSchema, setEditedSchema] = useState<FormSchema | null>(null);
  const [recordPrefix, setRecordPrefix] = useState("");

  const reset = useCallback(() => {
    setStatus("idle");
    setFile(null);
    setDragOver(false);
    setResult(null);
    setEditedSchema(null);
    setRecordPrefix("");
  }, []);

  // Auto-generate record_id from prefix + next number
  const genRecordId = useMutation({
    mutationFn: async (prefix: string) => {
      const { data } = await (supabase.rpc("next_record_number") as any)({ p_prefix: prefix });
      const n = (data ?? 0) as number;
      return `${prefix}${String(n).padStart(3, "0")}`;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editedSchema) throw new Error("No schema to save");
      // Generate record_id
      let recordId = editedSchema.form_number ?? editedSchema.form_title;
      if (recordPrefix) {
        const { data } = await (supabase.rpc("next_record_number") as any)({
          p_prefix: recordPrefix,
        });
        const n = (data ?? 0) as number;
        recordId = `${recordPrefix}${String(n).padStart(3, "0")}`;
      }
      const { error } = await (supabase.from("inspection_form_templates") as any).insert({
        part_id: null,
        part_name: editedSchema.form_title,
        record_id: recordId,
        record_prefix: recordPrefix || null,
        tolerance: editedSchema.metadata?.default_tolerance ?? 0,
        form_schema: editedSchema,
        source_doc_url: "",
        is_ai_generated: true,
        field_a: null,
        field_b: null,
        field_c: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Form template created from DOCX");
      qc.invalidateQueries({ queryKey: ["inspection_templates"] });
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Failed to save template");
      setStatus("preview");
    },
  });

  const processFile = async (f: File) => {
    if (!f.name.endsWith(".docx")) {
      toast.error("Please select a .docx file");
      return;
    }
    setFile(f);
    setStatus("uploading");

    try {
      // 1. Extract text client-side (fast for small docs)
      const docxText = await extractDocxText(f);

      // 2. Call edge function immediately (skip storage upload — it's unreliable)
      setStatus("processing");
      const SUPABASE_URL = (supabase as any).supabaseUrl;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-form-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docxText, fileName: f.name }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? `Edge function returned ${res.status}`);
      }

      const data: GenerateSchemaResult = await res.json();
      setResult(data);
      setEditedSchema(data.schema);
      setStatus("preview");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to process DOCX");
      setStatus("error");
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const updateSchema = (patch: Partial<FormSchema>) =>
    setEditedSchema((s) => (s ? { ...s, ...patch } : s));

  const renderDropZone = () => (
    <div
      className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Drop your .docx file here</p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
      </div>
      <input
        type="file"
        accept=".docx"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={onFileSelect}
      />
    </div>
  );

  const renderProgress = () => (
    <div className="flex flex-col items-center gap-4 py-12">
      {status === "uploading" && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Extracting document…</p>
        </>
      )}
      {status === "processing" && (
        <>
          <Wand2 className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">AI is analyzing your document…</p>
        </>
      )}
    </div>
  );

  const renderPreview = () => {
    if (!editedSchema) return null;
    return (
      <div className="space-y-4">
        <div>
          <Label className="label-caps">Form Title</Label>
          <Input
            value={editedSchema.form_title}
            onChange={(e) => updateSchema({ form_title: e.target.value })}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="label-caps">Record ID Prefix</Label>
            <Input
              value={recordPrefix}
              onChange={(e) => setRecordPrefix(e.target.value)}
              placeholder="e.g. FORM_PSP_QI_"
              className="mt-1 font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Number will auto-generate (001, 002…)
            </p>
          </div>
          <div>
            <Label className="label-caps">Revision</Label>
            <Input
              value={editedSchema.revision ?? ""}
              onChange={(e) => updateSchema({ revision: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
          {editedSchema.sections.map((section, si) => (
            <Card key={si}>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.fields.map((field, fi) => (
                    <div key={fi} className="flex items-center gap-2 text-xs">
                      <span className="font-medium truncate min-w-0 flex-1">{field.label}</span>
                      <Badge
                        variant={typeBadgeVariant[field.type] ?? "outline"}
                        className="shrink-0 text-[10px] px-1.5 py-0"
                      >
                        {field.type}
                      </Badge>
                      {field.required && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] border-amber-500/50 text-amber-400 px-1.5 py-0"
                        >
                          req
                        </Badge>
                      )}
                      <code className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {field.key}
                      </code>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div>
          <Label className="label-caps">Raw JSON</Label>
          <Textarea
            className="mt-1 font-mono text-xs min-h-[140px]"
            value={JSON.stringify(editedSchema, null, 2)}
            onChange={(e) => {
              try {
                setEditedSchema(JSON.parse(e.target.value));
              } catch {}
            }}
          />
        </div>
      </div>
    );
  };

  const renderError = () => (
    <div className="flex flex-col items-center gap-3 py-8">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {status === "idle" && "Generate from DOCX"}
            {status === "uploading" && "Extracting…"}
            {status === "processing" && "Analyzing Document…"}
            {status === "preview" && "Review Generated Schema"}
            {status === "saving" && "Saving…"}
            {status === "done" && "Done"}
            {status === "error" && "Error"}
          </DialogTitle>
        </DialogHeader>
        {status === "idle" && renderDropZone()}
        {(status === "uploading" || status === "processing") && renderProgress()}
        {status === "preview" && renderPreview()}
        {status === "error" && renderError()}
        {status === "preview" && (
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setStatus("saving");
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Template
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
