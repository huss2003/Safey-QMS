import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Loader2, Upload, X, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/integrations/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/lib/inventory/employees";
import { fmtDate } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────── */

interface TrainingRecord {
  id: string;
  employee_id: string;
  training_id: string;
  training_name: string;
  training_program_id: string;
  trainee_name: string;
  trainee_role: string;
  trainer: string;
  performance_date: string | null;
  evaluation_marks: string | null;
  performance_evaluation: string | null;
  duration: string | null;
  schedule: string | null;
  documents: string[];
  created_at: string;
}

/* ── Props ─────────────────────────────────────────────────── */

interface Props {
  employee: Employee;
}

/* ── Formats ───────────────────────────────────────────────── */

function trnId(i: number) {
  return `TRN-${String(i + 1).padStart(3, "0")}`;
}

/* ── Component ─────────────────────────────────────────────── */

export function EmployeeTrainings({ employee }: Props) {
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["employee-trainings", employee.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employee_trainings")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingRecord[];
    },
  });

  /* ── Create dialog ─────────────────────────────── */
  const [createOpen, setCreateOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [performanceDate, setPerformanceDate] = useState("");
  const [evaluationMarks, setEvaluationMarks] = useState("");
  const [files, setFiles] = useState<{ file: File; previewUrl: string }[]>([]);

  const { data: programs = [] } = useQuery({
    queryKey: ["training-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_programs")
        .select("*")
        .order("training_name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: createOpen,
  });

  const selectedProgram = programs.find((p: any) => p.id === selectedProgramId);

  function resetCreate() {
    setStep(1);
    setSelectedProgramId("");
    setPerformanceDate("");
    setEvaluationMarks("");
    setFiles([]);
    setCreateOpen(false);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProgram) throw new Error("No training program selected");

      // Generate next REC_HRM_TR_ID
      const { count } = await (supabase as any).from("employee_trainings").select("*", { count: "exact", head: true }).eq("employee_id", employee.id);
      const nextNum = String((count || 0) + 1).padStart(3, "0");
      const recordId = `REC_HRM_TR_${nextNum}`;

      const docUrls: string[] = [];

      // Upload files first
      for (const f of files) {
        const path = `employee-training/${employee.id}/${Date.now()}_${f.file.name}`;
        const { error: upErr } = await supabase.storage
          .from("equipment-files")
          .upload(path, f.file, { contentType: f.file.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage
          .from("equipment-files")
          .getPublicUrl(path);
        docUrls.push(urlData.publicUrl);
      }

      const { error } = await (supabase as any).from("employee_trainings").insert({
        record_id: recordId,
        employee_id: employee.id,
        training_id: selectedProgram.training_id,
        training_name: selectedProgram.training_name,
        training_program_id: selectedProgram.id,
        trainee_name: employee.employee_name,
        trainee_role: employee.employee_role,
        trainer: selectedProgram.trainer,
        performance_date: performanceDate || null,
        evaluation_marks: evaluationMarks || null,
        performance_evaluation: selectedProgram.performance_evaluation || null,
        duration: selectedProgram.training_duration || null,
        schedule: selectedProgram.schedule || null,
        documents: docUrls,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Training record created");
      qc.invalidateQueries({ queryKey: ["employee-trainings", employee.id] });
      resetCreate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create training record"),
  });

  function addFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFiles((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  /* ── View detail dialog ───────────────────────── */
  const [viewRecord, setViewRecord] = useState<TrainingRecord | null>(null);

  /* ── Edit dialog (reuses create flow with prefill) ── */
  const [editRecord, setEditRecord] = useState<TrainingRecord | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<TrainingRecord>) => {
      const { error } = await (supabase as any)
        .from("employee_trainings")
        .update(payload)
        .eq("id", editRecord!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Training record updated");
      qc.invalidateQueries({ queryKey: ["employee-trainings", employee.id] });
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update"),
  });

  /* ── Render ────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {records.length} record{records.length !== 1 ? "s" : ""}
        </h3>
        <Button size="sm" className="text-[13px]" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Training
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">No training records found.</p>
      ) : (
        <div className="overflow-hidden border border-border/60 rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-b">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Trainee Name</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Trainee Role</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">ID</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Trainer</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Training Name</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Performance Date</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r, i) => (
                <TableRow key={r.id} className="border-b border-border/40">
                  <TableCell className="text-[13px] font-medium">{r.trainee_name || employee.employee_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      {roleLabel(r.trainee_role || employee.employee_role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground font-mono">{r.record_id || trnId(i)}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{r.trainer}</TableCell>
                  <TableCell className="text-[13px] font-medium">{r.training_name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{fmtDate(r.performance_date)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewRecord(r)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRecord(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => (o ? undefined : resetCreate())}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Training Record</DialogTitle>
            <div className="flex items-center gap-2 pt-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className={cn("h-1.5 flex-1 rounded-full", step >= n ? "bg-primary" : "bg-muted")} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">Step {step} of 3</p>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="label-caps">Select Training Program *</Label>
                <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a training program" />
                  </SelectTrigger>
                  <SelectContent>
                    {(programs as any[]).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.training_name} ({p.training_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetCreate}>Cancel</Button>
                <Button onClick={() => setStep(2)} disabled={!selectedProgramId}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {step === 2 && selectedProgram && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="label-caps">Training Name</Label>
                  <Input value={selectedProgram.training_name} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Training ID</Label>
                  <Input value={selectedProgram.training_id} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Trainee Name</Label>
                  <Input value={employee.employee_name} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Trainee Role</Label>
                  <Input value={roleLabel(employee.employee_role)} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Trainer</Label>
                  <Input value={selectedProgram.trainer} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Duration</Label>
                  <Input value={selectedProgram.training_duration ?? "—"} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Schedule</Label>
                  <Input value={selectedProgram.schedule} disabled className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="label-caps">Performance Evaluation Factors</Label>
                <Textarea value={selectedProgram.performance_evaluation ?? "—"} readOnly className="mt-1" rows={3} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && selectedProgram && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="label-caps">Performance Date *</Label>
                  <Input type="date" value={performanceDate} onChange={(e) => setPerformanceDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Evaluation Marks</Label>
                  <Input value={evaluationMarks} onChange={(e) => setEvaluationMarks(e.target.value)} className="mt-1" placeholder="e.g. 85/100" />
                </div>
              </div>

              <div>
                <Label className="label-caps">Attach Documents</Label>
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <Button variant="outline" size="sm" className="text-[13px]" asChild>
                    <span>
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Upload
                    </span>
                  </Button>
                  <input type="file" className="hidden" onChange={addFile} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground truncate max-w-[300px]">{f.file.name}</span>
                        <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !performanceDate}
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Training Record
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── View Detail Dialog ── */}
      <Dialog open={!!viewRecord} onOpenChange={(o) => { if (!o) setViewRecord(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Training Detail</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="label-caps">Training Name</Label>
                  <Input value={viewRecord.training_name} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Training ID</Label>
                  <Input value={viewRecord.record_id || "—"} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Trainee Name</Label>
                  <Input value={viewRecord.trainee_name || employee.employee_name} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Trainee Role</Label>
                  <Input value={roleLabel(viewRecord.trainee_role || employee.employee_role)} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Trainer</Label>
                  <Input value={viewRecord.trainer} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Performance Date</Label>
                  <Input value={fmtDate(viewRecord.performance_date)} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Evaluation Marks</Label>
                  <Input value={viewRecord.evaluation_marks ?? "—"} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Duration</Label>
                  <Input value={viewRecord.duration ?? "—"} disabled className="mt-1" />
                </div>
                <div>
                  <Label className="label-caps">Schedule</Label>
                  <Input value={viewRecord.schedule ?? "—"} disabled className="mt-1" />
                </div>
              </div>
              {viewRecord.performance_evaluation && (
                <div>
                  <Label className="label-caps">Performance Evaluation Factors</Label>
                  <Textarea value={viewRecord.performance_evaluation} readOnly className="mt-1" rows={3} />
                </div>
              )}
              {viewRecord.documents && viewRecord.documents.length > 0 && (
                <div>
                  <Label className="label-caps">Documents</Label>
                  <ul className="mt-1 space-y-1">
                    {viewRecord.documents.map((url, i) => (
                      <li key={i}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {url.split("/").pop() ?? `Document ${i + 1}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRecord(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editRecord} onOpenChange={(o) => { if (!o) setEditRecord(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Training Record</DialogTitle>
          </DialogHeader>
          {editRecord && (
            <EditForm
              record={editRecord}
              employee={employee}
              onSave={(payload) => updateMutation.mutate(payload)}
              saving={updateMutation.isPending}
              onCancel={() => setEditRecord(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Edit Form ─────────────────────────────────────────────── */

function EditForm({
  record,
  employee,
  onSave,
  saving,
  onCancel,
}: {
  record: TrainingRecord;
  employee: Employee;
  onSave: (payload: Partial<TrainingRecord>) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(record.performance_date ?? "");
  const [marks, setMarks] = useState(record.evaluation_marks ?? "");
  const [files, setFiles] = useState<{ file: File; previewUrl: string }[]>([]);

  function addFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFiles((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {(
          [
            ["Training Name", record.training_name],
            ["Training ID", record.training_id],
            ["Trainee Name", record.trainee_name || employee.employee_name],
            ["Trainee Role", roleLabel(record.trainee_role || employee.employee_role)],
            ["Trainer", record.trainer],
            ["Duration", record.duration ?? "—"],
            ["Schedule", record.schedule ?? "—"],
          ] as const
        ).map(([label, val]) => (
          <div key={label}>
            <Label className="label-caps">{label}</Label>
            <Input value={val} disabled className="mt-1" />
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="label-caps">Performance Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="label-caps">Evaluation Marks</Label>
          <Input value={marks} onChange={(e) => setMarks(e.target.value)} className="mt-1" placeholder="e.g. 85/100" />
        </div>
      </div>

      {record.performance_evaluation && (
        <div>
          <Label className="label-caps">Performance Evaluation Factors</Label>
          <Textarea value={record.performance_evaluation} readOnly className="mt-1" rows={3} />
        </div>
      )}

      <div>
        <Label className="label-caps">Documents</Label>
        <label className="flex items-center gap-2 mt-1 cursor-pointer">
          <Button variant="outline" size="sm" className="text-[13px]" asChild>
            <span>
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload
            </span>
          </Button>
          <input type="file" className="hidden" onChange={addFile} />
        </label>
        {record.documents && record.documents.length > 0 && (
          <ul className="mt-2 space-y-1">
            {record.documents.map((url, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Download className="h-3 w-3 text-muted-foreground" />
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[300px]">
                  {url.split("/").pop()}
                </a>
              </li>
            ))}
          </ul>
        )}
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground truncate max-w-[300px]">{f.file.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ performance_date: date || null, evaluation_marks: marks || null })} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </DialogFooter>
    </div>
  );
}
