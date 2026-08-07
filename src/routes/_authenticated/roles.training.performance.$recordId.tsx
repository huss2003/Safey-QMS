import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Eye,
  Pencil,
  Upload,
  X,
  AlertTriangle,
  FilePlus2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { TableSkeleton } from "@/components/inventory/skeletons";
import { fmtDate } from "@/lib/inventory/format";

export const Route = createFileRoute("/_authenticated/roles/training/performance/$recordId")({
  ssr: false,
  component: TrainingPerformancePage,
});

interface TrainingRecord {
  id: string;
  employee_id: string;
  training_name: string;
  training_id: string;
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

interface EvalDetails {
  marks: number[];
  results: string[];
  total: number;
  finalResult: string;
  evaluationDate: string;
}

function parseEval(marksJson: string | null): EvalDetails | null {
  if (!marksJson) return null;
  try {
    const parsed = JSON.parse(marksJson);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.total === "number" &&
      typeof parsed.finalResult === "string"
    ) {
      return parsed as EvalDetails;
    }
    return null;
  } catch {
    return null;
  }
}

function calcNextDate(lastDate: string, schedule: string): string {
  const d = new Date(lastDate);
  if (schedule.includes("6")) {
    d.setMonth(d.getMonth() + 6);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().split("T")[0];
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TrainingPerformancePage() {
  const { recordId } = useParams({
    from: "/_authenticated/roles/training/performance/$recordId",
  });
  const qc = useQueryClient();

  const { data: record, isLoading } = useQuery({
    queryKey: ["employee-training-record", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_trainings")
        .select("*")
        .eq("id", recordId)
        .single();
      if (error) throw error;
      return data as TrainingRecord;
    },
  });

  const { data: program } = useQuery({
    queryKey: ["training_program", record?.training_program_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_programs")
        .select("performance_evaluation, schedule")
        .eq("id", record!.training_program_id)
        .single();
      if (error) throw error;
      return data as { performance_evaluation: string | null; schedule: string | null };
    },
    enabled: !!record?.training_program_id,
  });

  const criteria = useMemo(
    () =>
      (program?.performance_evaluation ?? "")
        .split(/\.\s*/)
        .map((s) => s.trim())
        .filter(Boolean),
    [program?.performance_evaluation],
  );

  // All evaluations for this training_program_id
  const { data: evaluations = [] } = useQuery({
    queryKey: ["evaluations-for-program", record?.training_program_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_trainings")
        .select(
          "id, training_id, evaluation_marks, performance_date, trainee_name, documents, created_at",
        )
        .eq("training_program_id", record!.training_program_id)
        .not("evaluation_marks", "is", null)
        .order("performance_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingRecord[];
    },
    enabled: !!record?.training_program_id,
  });

  // ── Create dialog ──
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalDate, setEvalDate] = useState("");
  const [marks, setMarks] = useState<string[]>([]);
  const [results, setResults] = useState<string[]>([]);

  const openCreate = () => {
    setEvalDate("");
    setMarks(criteria.map(() => ""));
    setResults(criteria.map(() => ""));
    setEvalOpen(true);
  };

  // ── View dialog ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewEval, setViewEval] = useState<EvalDetails | null>(null);
  const [viewRecord, setViewRecord] = useState<TrainingRecord | null>(null);

  const openView = (r: TrainingRecord) => {
    setViewRecord(r);
    setViewEval(parseEval(r.evaluation_marks));
    setViewOpen(true);
  };

  // ── Edit dialog ──
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<TrainingRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editMarks, setEditMarks] = useState<string[]>([]);
  const [editResults, setEditResults] = useState<string[]>([]);

  const openEdit = (r: TrainingRecord) => {
    setEditRecord(r);
    const parsed = parseEval(r.evaluation_marks);
    setEditDate(parsed?.evaluationDate ?? r.performance_date ?? "");
    setEditMarks(parsed?.marks?.map(String) ?? criteria.map(() => "0"));
    setEditResults(parsed?.results ?? criteria.map(() => ""));
    setEditOpen(true);
  };

  const totalMarks = marks.reduce((s, m) => s + (parseInt(m) || 0), 0);
  const editTotal = editMarks.reduce((s, m) => s + (parseInt(m) || 0), 0);
  const maxMarks = criteria.length * 100;

  const finalResult = (t: number) => (t >= 85 ? "Pass" : t > 0 ? "Fail" : "—");

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      marks: string[];
      results: string[];
      date: string;
      id?: string;
    }) => {
      const details: EvalDetails = {
        marks: payload.marks.map(Number),
        results: payload.results,
        total: payload.marks.reduce((s, m) => s + (parseInt(m) || 0), 0),
        finalResult: finalResult(payload.marks.reduce((s, m) => s + (parseInt(m) || 0), 0)),
        evaluationDate: payload.date,
      };
      if (payload.id) {
        const { error } = await supabase
          .from("employee_trainings")
          .update({ evaluation_marks: JSON.stringify(details), performance_date: payload.date })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_trainings")
          .update({ evaluation_marks: JSON.stringify(details), performance_date: payload.date })
          .eq("id", recordId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Evaluation saved");
      qc.invalidateQueries({ queryKey: ["evaluations-for-program", record?.training_program_id] });
      qc.invalidateQueries({ queryKey: ["employee-training-record", recordId] });
      setEvalOpen(false);
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <TableSkeleton />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="py-12 text-center text-muted-foreground">Training record not found.</div>
    );
  }

  const schedule = record.schedule ?? program?.schedule ?? "Every 6 Months";
  const pastEvals = evaluations.filter((e) => parseEval(e.evaluation_marks));
  const lastEval = pastEvals[0];
  const lastDate = lastEval?.performance_date;
  const nextDate = lastDate ? calcNextDate(lastDate, schedule) : null;
  const isOverdue = nextDate ? new Date(nextDate) < new Date() : false;
  const hasFailedEval = pastEvals.some((e) => {
    const d = parseEval(e.evaluation_marks);
    return d && d.finalResult === "Fail";
  });

  return (
    <div>
      <PageHeader
        title="Performance Evaluation"
        description={`${record.training_name} — ${record.trainee_name}`}
        actions={
          <Link to="/roles/employees/$id" params={{ id: record.employee_id }}>
            <Button variant="ghost" size="sm" className="text-[13px]">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Employee
            </Button>
          </Link>
        }
      />

      {/* Training Details */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Training Details</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainee Name</TableHead>
                  <TableHead>Trainee Role</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Training Name</TableHead>
                  <TableHead>Performance Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-[13px]">{record.trainee_name}</TableCell>
                  <TableCell className="text-[12.5px]">
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20"
                    >
                      {record.trainee_role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12.5px] font-mono text-muted-foreground">
                    {record.training_id}
                  </TableCell>
                  <TableCell className="text-[12.5px]">{record.trainer}</TableCell>
                  <TableCell className="text-[12.5px] font-medium">
                    {record.training_name}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {fmtDate(record.performance_date)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Past Performance Evaluation */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-primary">Past Performance Evaluation</h3>
        </div>
        <div className="p-4">
          {pastEvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past evaluations recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evaluation ID</TableHead>
                    <TableHead>Evaluation Result</TableHead>
                    <TableHead>Evaluation Date</TableHead>
                    <TableHead>Icons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastEvals.map((e) => {
                    const d = parseEval(e.evaluation_marks);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-[12.5px] font-mono">{e.training_id}</TableCell>
                        <TableCell className="text-[12.5px]">{d?.total ?? "—"}</TableCell>
                        <TableCell className="text-[12.5px] text-muted-foreground">
                          {fmtDate(e.performance_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openView(e)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      {/* Upcoming Performance Evaluation */}
      <Card className="overflow-hidden p-0">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-primary">Upcoming Performance Evaluation</h3>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evaluation ID</TableHead>
                  <TableHead>Evaluation Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Icons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-[12.5px] font-mono">{record.training_id}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {nextDate ? fmtDateShort(nextDate) : "—"}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    {isOverdue ? (
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[11px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> Late
                      </Badge>
                    ) : (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[11px]">
                        Scheduled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-middle">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={openCreate}
                      disabled={hasFailedEval}
                      title={
                        hasFailedEval
                          ? "Cannot create — previous evaluation failed"
                          : "Create evaluation"
                      }
                    >
                      <FilePlus2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* ── Create Dialog ── */}
      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Performance Evaluation</DialogTitle>
            <p className="text-sm text-muted-foreground">Training: {record.training_name}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="label-caps">Evaluation Date *</Label>
              <Input
                type="date"
                value={evalDate}
                onChange={(e) => setEvalDate(e.target.value)}
                className="mt-1 max-w-[200px]"
              />
            </div>
            <div className="overflow-x-auto border border-border/60 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evaluation Criteria</TableHead>
                    <TableHead className="w-[100px]">Marks</TableHead>
                    <TableHead className="w-[140px]">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[13px]">{c}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={marks[i] ?? ""}
                          onChange={(e) => {
                            const n = [...marks];
                            n[i] = e.target.value;
                            setMarks(n);
                          }}
                          className="h-8 text-[13px]"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={results[i] ?? ""}
                          onValueChange={(v) => {
                            const n = [...results];
                            n[i] = v;
                            setResults(n);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[13px]">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Satisfactory">Satisfactory</SelectItem>
                            <SelectItem value="Not Satisfactory">Not Satisfactory</SelectItem>
                            <SelectItem value="Not Performed">Not Performed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span>
                Total:{" "}
                <span className="font-semibold">
                  {totalMarks}/{maxMarks}
                </span>
              </span>
              <span>
                Final Result:{" "}
                <Badge
                  variant={totalMarks >= 85 ? "default" : "destructive"}
                  className="text-[11px]"
                >
                  {finalResult(totalMarks)}
                </Badge>
              </span>
            </div>
            <div>
              <Label className="label-caps">Attach Documents</Label>
              <Button variant="outline" size="sm" className="mt-1 text-[13px]">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalOpen(false)}>
              Back
            </Button>
            <Button
              onClick={() => saveMutation.mutate({ marks, results, date: evalDate })}
              disabled={!evalDate || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
              Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
          </DialogHeader>
          {viewEval && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="font-medium">{fmtDateShort(viewEval.evaluationDate)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Training Program:</span>{" "}
                  <span className="font-medium">{viewRecord?.training_name}</span>
                </div>
              </div>
              <div className="overflow-x-auto border border-border/60 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criteria</TableHead>
                      <TableHead className="w-[100px]">Marks</TableHead>
                      <TableHead className="w-[140px]">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteria.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-[13px]">{c}</TableCell>
                        <TableCell className="text-[13px] font-medium">
                          {viewEval.marks?.[i] ?? "—"}
                        </TableCell>
                        <TableCell className="text-[13px]">
                          {viewEval.results?.[i] ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center gap-4 text-[13px]">
                <span>
                  Total:{" "}
                  <span className="font-semibold">
                    {viewEval.total}/{maxMarks}
                  </span>
                </span>
                <span>
                  Final Result:{" "}
                  <Badge
                    variant={viewEval.finalResult === "Pass" ? "default" : "destructive"}
                    className="text-[11px]"
                  >
                    {viewEval.finalResult}
                  </Badge>
                </span>
              </div>
              <div>
                <span className="text-[13px] text-muted-foreground">Documents:</span>
                <p className="text-[13px] mt-1">—</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Evaluation</DialogTitle>
            <p className="text-sm text-muted-foreground">Training: {record.training_name}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="label-caps">Evaluation Date *</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="mt-1 max-w-[200px]"
              />
            </div>
            <div className="overflow-x-auto border border-border/60 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evaluation Criteria</TableHead>
                    <TableHead className="w-[100px]">Marks</TableHead>
                    <TableHead className="w-[140px]">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[13px]">{c}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editMarks[i] ?? ""}
                          onChange={(e) => {
                            const n = [...editMarks];
                            n[i] = e.target.value;
                            setEditMarks(n);
                          }}
                          className="h-8 text-[13px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={editResults[i] ?? ""}
                          onValueChange={(v) => {
                            const n = [...editResults];
                            n[i] = v;
                            setEditResults(n);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[13px]">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Satisfactory">Satisfactory</SelectItem>
                            <SelectItem value="Not Satisfactory">Not Satisfactory</SelectItem>
                            <SelectItem value="Not Performed">Not Performed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span>
                Total:{" "}
                <span className="font-semibold">
                  {editTotal}/{maxMarks}
                </span>
              </span>
              <span>
                Final Result:{" "}
                <Badge
                  variant={editTotal >= 85 ? "default" : "destructive"}
                  className="text-[11px]"
                >
                  {finalResult(editTotal)}
                </Badge>
              </span>
            </div>
            <div>
              <Label className="label-caps">Attach Documents</Label>
              <Button variant="outline" size="sm" className="mt-1 text-[13px]">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editRecord &&
                saveMutation.mutate({
                  marks: editMarks,
                  results: editResults,
                  date: editDate,
                  id: editRecord.id,
                })
              }
              disabled={!editDate || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Update
              Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
