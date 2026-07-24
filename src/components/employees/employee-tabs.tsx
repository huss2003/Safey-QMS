import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/inventory/empty-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fmtDate } from "@/lib/inventory/format";
import { FileUpload, FileList } from "@/components/inventory/file-upload";

interface Props { employeeId: string; employeeName?: string; }

export function EmployeePerformanceTab({ employeeId, employeeName }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<any>(null);
  const [editRecord, setEditRecord] = useState<any>(null);

  const { data: records } = useQuery({
    queryKey: ["employee-perf", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_performance_evaluations")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-muted-foreground">{(records?.length ?? 0)} record(s)</span>
        <Button size="sm" className="h-7 text-[12px]" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add Evaluation
        </Button>
      </div>

      {!records?.length ? (
        <EmptyState icon={Eye} title="No evaluations" description="Add performance evaluations linked to training programs." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Personnel</TableHead>
                <TableHead>Training Program</TableHead>
                <TableHead>Final Result</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r: any) => (
                <TableRow key={r.id} className="row-rule">
                  <TableCell className="text-[12px]">{fmtDate(r.evaluation_date)}</TableCell>
                  <TableCell className="text-[12px]">{employeeName || "—"}</TableCell>
                  <TableCell className="text-[12px] max-w-[200px] truncate">{r.training_name || "—"}</TableCell>
                  <TableCell className="text-[12px]">
                    <Badge variant="secondary" className={r.final_result === "pass" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                      {r.final_result === "pass" ? "Pass" : r.final_result === "fail" ? "Fail" : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12px]"><FileList urls={r.documents} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewRecord(r)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRecord(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreatePerfDialog
        open={open}
        onOpenChange={setOpen}
        employeeId={employeeId}
        employeeName={employeeName}
      />
      <ViewPerfDialog record={viewRecord} onClose={() => setViewRecord(null)} />
      <EditPerfDialog
        record={editRecord}
        onClose={() => setEditRecord(null)}
        employeeId={employeeId}
        employeeName={employeeName}
      />
    </div>
  );
}

function parseEvaluationFactors(text: string | null | undefined): string[] {
  if (!text) return [];
  // Try numbered items first: "1) text 2) text"
  let items = text.split(/\d+\)\s*/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 300);
  if (items.length > 1) return items;
  // Fallback: split by ". " or ".\n" (period-separated sentences)
  items = text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 300);
  if (items.length > 1) return items;
  // Last resort: split by newlines
  items = text.split(/\n/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 300);
  return items.length > 0 ? items : [text];
}

function CreatePerfDialog({ open, onOpenChange, employeeId, employeeName }: Props & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"select" | "evaluate">("select");
  const [selectedTrainingId, setSelectedTrainingId] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<{ criterion: string; marks: string; result: string }[]>([]);
  const [documents, setDocuments] = useState<string[]>([]);

  const { data: trainings } = useQuery({
    queryKey: ["employee-trainings-list", employeeId],
    queryFn: async () => {
      const { data } = await supabase.from("employee_trainings").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: trainingProgram } = useQuery({
    queryKey: ["training-program-by-name", selectedTrainingId],
    queryFn: async () => {
      const training = (trainings ?? []).find((t: any) => t.id === selectedTrainingId);
      if (!training?.training_name) return null;
      const { data } = await supabase.from("training_programs").select("*").eq("training_name", training.training_name).maybeSingle();
      return data as any;
    },
    enabled: !!selectedTrainingId,
  });

  const handleSelectTraining = () => {
    const training = trainings?.find((t: any) => t.id === selectedTrainingId);
    if (!trainingProgram?.performance_evaluation) {
      toast.error("This training program has no evaluation criteria");
      return;
    }
    const criteria = parseEvaluationFactors(trainingProgram.performance_evaluation);
    if (criteria.length === 0) {
      toast.error("Could not parse evaluation criteria from training program");
      return;
    }
    setItems(criteria.map((c: string) => ({ criterion: c, marks: "", result: "" })));
    setStep("evaluate");
  };

  const totalMarks = items.reduce((sum, i) => sum + (parseInt(i.marks) || 0), 0);
  const maxMarks = items.length * 100;
  const finalResult = maxMarks > 0 && totalMarks >= maxMarks * 0.6 ? "pass" : "fail";

  const save = useMutation({
    mutationFn: async () => {
      const training = trainings?.find((t: any) => t.id === selectedTrainingId);
      const { error } = await (supabase as any).from("employee_performance_evaluations").insert({
        employee_id: employeeId,
        evaluation_date: date || null,
        training_program_id: trainingProgram?.training_id || null,
        training_name: training?.training_name || null,
        total_marks: totalMarks,
        final_result: finalResult,
        evaluation_items: items,
        documents,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evaluation saved");
      qc.invalidateQueries({ queryKey: ["employee-perf", employeeId] });
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = () => { setStep("select"); setSelectedTrainingId(""); setDate(""); setItems([]); setDocuments([]); };

  const handleOpenChange = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Performance Evaluation</DialogTitle></DialogHeader>

        {step === "select" ? (
          <div className="space-y-4">
            <div>
              <Label className="label-caps">Select Training Record *</Label>
              <Select value={selectedTrainingId} onValueChange={setSelectedTrainingId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a completed training" /></SelectTrigger>
                <SelectContent>
                  {(trainings ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.training_name || t.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {trainingProgram && (
              <div className="text-[12px] text-muted-foreground p-3 rounded bg-muted/50">
                Training Program: <span className="font-medium text-foreground">{trainingProgram.training_name}</span>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button disabled={!selectedTrainingId || !trainingProgram} onClick={handleSelectTraining}>Next — Evaluate</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-[12px] text-muted-foreground">
              Training: <span className="font-medium text-foreground">{trainings?.find((t: any) => t.id === selectedTrainingId)?.training_name}</span>
            </div>

            <div>
              <Label className="label-caps">Evaluation Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 max-w-[200px]" />
            </div>

            <div className="rounded border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Evaluation Criteria</TableHead>
                    <TableHead className="w-[80px]">Marks</TableHead>
                    <TableHead className="w-[100px]">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[12px] leading-relaxed">{item.criterion}</TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={100} value={item.marks}
                          onChange={e => { const next = [...items]; next[i].marks = e.target.value; setItems(next); }}
                          className="h-8 w-20 text-[12px]" />
                      </TableCell>
                      <TableCell>
                        <select value={item.result} onChange={e => { const next = [...items]; next[i].result = e.target.value; setItems(next); }}
                          className="h-8 text-[12px] rounded border border-input bg-background px-2">
                          <option value="">Select</option>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded text-[13px]">
              <span>Total: <strong>{totalMarks}/{maxMarks}</strong></span>
              <span>Final Result: <Badge variant="secondary" className={finalResult === "pass" ? "bg-success/10 text-success" : totalMarks > 0 ? "bg-destructive/10 text-destructive" : ""}>{totalMarks > 0 ? (finalResult === "pass" ? "Pass" : "Fail") : "—"}</Badge></span>
            </div>

            <div>
              <Label className="label-caps">Attach Documents</Label>
              <FileUpload pathPrefix={`employee-perf/${employeeId}`} onFilesChange={setDocuments} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={() => save.mutate()} disabled={!date || save.isPending}>
                {save.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Save Evaluation
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ViewPerfDialog({ record, onClose }: { record: any; onClose: () => void }) {
  const items: { criterion: string; marks: string; result: string }[] = record?.evaluation_items || [];
  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Evaluation Details</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <div className="grid grid-cols-2 gap-4">
            <div><div className="label-caps text-muted-foreground">Date</div><div>{fmtDate(record?.evaluation_date)}</div></div>
            <div><div className="label-caps text-muted-foreground">Training Program</div><div>{record?.training_name || "—"}</div></div>
          </div>
          {items.length > 0 && (
            <div className="rounded border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Criteria</TableHead><TableHead className="w-16">Marks</TableHead><TableHead className="w-20">Result</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-[12px]">{item.criterion}</TableCell>
                      <TableCell className="text-[12px]">{item.marks || "—"}</TableCell>
                      <TableCell className="text-[12px]"><Badge variant="outline" className={item.result === "pass" ? "bg-success/10 text-success" : item.result === "fail" ? "bg-destructive/10 text-destructive" : ""}>{item.result || "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="label-caps text-muted-foreground">Total: {record?.total_marks || "—"}</div>
            <div className="label-caps text-muted-foreground">Final Result: <Badge variant="secondary" className={record?.final_result === "pass" ? "bg-success/10 text-success" : record?.final_result === "fail" ? "bg-destructive/10 text-destructive" : ""}>{record?.final_result === "pass" ? "Pass" : record?.final_result === "fail" ? "Fail" : "—"}</Badge></div>
          </div>
          <div><div className="label-caps text-muted-foreground">Documents</div><FileList urls={record?.documents} /></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditPerfDialog({ record, onClose, employeeId, employeeName }: { record: any; onClose: () => void } & Props) {
  const qc = useQueryClient();
  const [date, setDate] = useState(record?.evaluation_date?.slice(0, 10) || "");
  const [items, setItems] = useState<{ criterion: string; marks: string; result: string }[]>(record?.evaluation_items?.map((i: any) => ({ ...i })) || []);
  const [documents, setDocuments] = useState<string[]>(record?.documents || []);

  const totalMarks = items.reduce((sum, i) => sum + (parseInt(i.marks) || 0), 0);
  const maxMarks = items.length * 100;
  const finalResult = maxMarks > 0 && totalMarks >= maxMarks * 0.6 ? "pass" : "fail";

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("employee_performance_evaluations").update({
        evaluation_date: date || null, total_marks: totalMarks, final_result: finalResult, evaluation_items: items, documents,
      }).eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["employee-perf", employeeId] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Evaluation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label className="label-caps">Evaluation Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 max-w-[200px]" /></div>
          <div className="rounded border border-border overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Criteria</TableHead><TableHead className="w-20">Marks</TableHead><TableHead className="w-24">Result</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[12px]">{item.criterion}</TableCell>
                    <TableCell><Input type="number" min={0} max={100} value={item.marks} onChange={e => { const n = [...items]; n[i].marks = e.target.value; setItems(n); }} className="h-8 w-20 text-[12px]" /></TableCell>
                    <TableCell>
                      <select value={item.result} onChange={e => { const n = [...items]; n[i].result = e.target.value; setItems(n); }} className="h-8 text-[12px] rounded border border-input bg-background px-2">
                        <option value="">Select</option><option value="pass">Pass</option><option value="fail">Fail</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-4 text-[13px]">
            <span>Total: <strong>{totalMarks}/{maxMarks}</strong></span>
            <span>Result: <Badge variant="secondary" className={finalResult === "pass" ? "bg-success/10 text-success" : totalMarks > 0 ? "bg-destructive/10 text-destructive" : ""}>{totalMarks > 0 ? (finalResult === "pass" ? "Pass" : "Fail") : "—"}</Badge></span>
          </div>
          <div><Label className="label-caps">Documents</Label><FileUpload pathPrefix={`employee-perf/${employeeId}`} onFilesChange={setDocuments} existingUrls={documents} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Update</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewHealthDialog({ record, employee }: { record: any; employee?: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)}><Eye className="h-3.5 w-3.5" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Health Record Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <div><div className="label-caps text-muted-foreground">Date</div><div>{fmtDate(record.record_date) || "—"}</div></div>
            <div><div className="label-caps text-muted-foreground">Gender</div><div>{record.gender || "—"}</div></div>
            <div><div className="label-caps text-muted-foreground">Age</div><div>{record.age ?? "—"}</div></div>
            <div><div className="label-caps text-muted-foreground">Weight</div><div>{record.weight ? `${record.weight} kg` : "—"}</div></div>
            <div><div className="label-caps text-muted-foreground">Height</div><div>{record.height ? `${record.height} cm` : "—"}</div></div>
            <div><div className="label-caps text-muted-foreground">Eyesight</div><div>{record.eyesight || "—"}</div></div>
            <div><div className="label-caps text-muted-foreground">Diabetes</div><div>{record.diabetes || "—"}</div></div>
            <div><div className="label-caps text-muted-foreground">Blood Pressure</div><div>{record.blood_pressure || "—"}</div></div>
            <div className="col-span-2"><div className="label-caps text-muted-foreground">Chronic/Communicable Disease</div><div>{record.chronic_disease || "—"}</div></div>
            <div className="col-span-2"><div className="label-caps text-muted-foreground">Documents</div><FileList urls={record.documents} /></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EmployeeHealthTab({ employeeId, employee }: Props & { employee?: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [gender, setGender] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [eyesight, setEyesight] = useState("");
  const [diabetes, setDiabetes] = useState("");
  const [bp, setBp] = useState("");
  const [chronic, setChronic] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);

  // Auto-calc age from DOB
  const age = employee?.date_of_birth
    ? Math.floor((Date.now() - new Date(employee.date_of_birth).getTime()) / 31557600000)
    : null;

  const { data: records } = useQuery({
    queryKey: ["employee-health", employeeId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("employee_health_records").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("employee_health_records").insert({
        employee_id: employeeId, record_date: date || null, gender, age, weight: weight ? parseFloat(weight) : null, height: height ? parseFloat(height) : null, eyesight: eyesight || null, diabetes: diabetes || null, blood_pressure: bp || null, chronic_disease: chronic || null, documents,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["employee-health", employeeId] }); setOpen(false); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = () => { setDate(""); setGender(""); setWeight(""); setHeight(""); setEyesight(""); setDiabetes(""); setBp(""); setChronic(""); setDocuments([]); };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-muted-foreground">{(records?.length ?? 0)} record(s)</span>
        <Button size="sm" className="h-7 text-[12px]" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" /> Add Record</Button>
      </div>
      {!records?.length ? (
        <EmptyState icon={Eye} title="No health records" description="Add health records." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Gender</TableHead><TableHead>Age</TableHead><TableHead>Weight</TableHead><TableHead>Height</TableHead><TableHead>Date</TableHead><TableHead className="w-12">View</TableHead>
          </TableRow></TableHeader><TableBody>
            {(records ?? []).map((r: any) => (
              <TableRow key={r.id} className="row-rule">
                <TableCell className="text-[12px]">{r.gender || "—"}</TableCell>
                <TableCell className="text-[12px]">{r.age ?? "—"}</TableCell>
                <TableCell className="text-[12px]">{r.weight ? `${r.weight} kg` : "—"}</TableCell>
                <TableCell className="text-[12px]">{r.height ? `${r.height} cm` : "—"}</TableCell>
                <TableCell className="text-[12px]">{fmtDate(r.record_date)}</TableCell>
                <TableCell className="text-right"><ViewHealthDialog record={r} employee={employee} /></TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </Card>
      )}
      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Health Record</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><Label className="label-caps">Record Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
            <div><Label className="label-caps">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="label-caps">Age (auto from DOB)</Label><Input value={age ?? ""} disabled className="mt-1 text-[12px]" /></div>
            <div><Label className="label-caps">Weight (kg)</Label><Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="mt-1" /></div>
            <div><Label className="label-caps">Height (cm)</Label><Input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} className="mt-1" /></div>
            <div><Label className="label-caps">Eyesight</Label>
              <Select value={eyesight} onValueChange={setEyesight}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Corrected">Corrected</SelectItem>
                  <SelectItem value="Below Normal">Below Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="label-caps">Diabetes</Label>
              <Select value={diabetes} onValueChange={setDiabetes}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Type 1">Type 1</SelectItem>
                  <SelectItem value="Type 2">Type 2</SelectItem>
                  <SelectItem value="Pre-diabetic">Pre-diabetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="label-caps">Blood Pressure</Label>
              <Select value={bp} onValueChange={setBp}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Elevated">Elevated</SelectItem>
                  <SelectItem value="High Stage 1">High Stage 1</SelectItem>
                  <SelectItem value="High Stage 2">High Stage 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="label-caps">Any Chronic or Communicable Disease</Label><Input value={chronic} onChange={e => setChronic(e.target.value)} className="mt-1" /></div>
            <div className="col-span-2"><Label className="label-caps">Attach Documents</Label><FileUpload pathPrefix={`employee-health/${employeeId}`} onFilesChange={setDocuments} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
