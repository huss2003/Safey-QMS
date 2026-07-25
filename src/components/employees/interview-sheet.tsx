import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/integrations/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EMPLOYEES } from "@/lib/inventory/employees";
import { getInterviewRole } from "@/lib/inventory/interview-questions";

/* ── Types ─────────────────────────────────────────────────── */

export interface SkillResult {
  skill: string;
  passFail: "pass" | "fail" | "";
  notes: string;
  score: number;
}

export interface InterviewRecord {
  id: string;
  employee_id: string;
  interviewer: string;
  interview_date: string;
  years_of_experience: string;
  education: string;
  skills: SkillResult[];
  total_score: number;
  is_completed: boolean;
  documents: string[];
  created_at: string;
}

export interface InterviewDocument {
  id: string;
  interview_id: string;
  name: string;
  url: string;
  created_at: string;
}

/* ── Props ─────────────────────────────────────────────────── */

interface InterviewSheetProps {
  employee: Employee;
}

/* ── Constants ─────────────────────────────────────────────── */

const INTERVIEWER_OPTIONS = EMPLOYEES.map((e) => ({
  value: e.value,
  label: e.label,
}));

/* ── Component ─────────────────────────────────────────────── */

export function InterviewSheet({ employee }: InterviewSheetProps) {
  const qc = useQueryClient();
  const interviewRole = getInterviewRole(employee.employee_role);
  const questions = interviewRole?.questions ?? [];

  const { data: interview, isLoading: loadingInterview } = useQuery({
    queryKey: ["employee-interview", employee.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employee_interviews")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as InterviewRecord | null;
    },
  });

  const { data: documents } = useQuery({
    queryKey: ["employee-interview-documents", interview?.id],
    enabled: !!interview?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employee_interview_documents")
        .select("*")
        .eq("interview_id", interview!.id);
      if (error) throw error;
      return (data ?? []) as InterviewDocument[];
    },
  });

  /* ── Form state ───────────────────────────────── */
  const [interviewer, setInterviewer] = useState(interview?.interviewer ?? "");
  const [interviewDate, setInterviewDate] = useState(interview?.interview_date ?? "");
  const [yearsExp, setYearsExp] = useState(interview?.years_of_experience ?? "");
  const [education, setEducation] = useState(interview?.education ?? "");
  const [skillResults, setSkillResults] = useState<SkillResult[]>(
    () => interview?.skills ?? questions.map((q) => ({ skill: q.skill, passFail: "", notes: "", score: 0 })),
  );
  const [uploading, setUploading] = useState(false);

  /* Sync skill list when questions load but no saved interview yet */
  if (!interview && questions.length > 0 && skillResults.length === 0) {
    setSkillResults(questions.map((q) => ({ skill: q.skill, passFail: "", notes: "", score: 0 })));
  }

  const isReadOnly = interview?.is_completed === true;

  const totalScore = useMemo(
    () => skillResults.reduce((sum, s) => sum + (s.score || 0), 0),
    [skillResults],
  );

  function updateSkill(index: number, field: keyof SkillResult, value: string | number) {
    setSkillResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  /* ── Save mutation ────────────────────────────── */
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        employee_id: employee.id,
        interviewer,
        interview_date: interviewDate,
        years_of_experience: yearsExp,
        education,
        skills: skillResults,
        total_score: totalScore,
        is_completed: true,
      };

      if (interview?.id) {
        const { error } = await (supabase as any)
          .from("employee_interviews")
          .update(payload)
          .eq("id", interview.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("employee_interviews").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Interview saved");
      qc.invalidateQueries({ queryKey: ["employee-interview", employee.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save interview"),
  });

  /* ── Document upload ──────────────────────────── */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !interview?.id) return;
    setUploading(true);
    try {
      const path = `interviews/${interview.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-files")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("employee-files").getPublicUrl(path);

      await (supabase as any).from("employee_interview_documents").insert({
        interview_id: interview.id,
        name: file.name,
        url: urlData.publicUrl,
      });

      qc.invalidateQueries({ queryKey: ["employee-interview-documents", interview.id] });
      toast.success("Document uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loadingInterview) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading interview…
      </div>
    );
  }

  if (!questions.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No interview questions defined for role "{employee.employee_role}".
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee / Interview Info */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Sheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">Employee Name</Label>
              <Input value={employee.employee_name} disabled className="mt-1" />
            </div>
            <div>
              <Label className="label-caps">Interviewer</Label>
              {isReadOnly ? (
                <Input value={INTERVIEWER_OPTIONS.find((o) => o.value === interviewer)?.label ?? interviewer} disabled className="mt-1" />
              ) : (
                <Select value={interviewer} onValueChange={setInterviewer}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select interviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEWER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="label-caps">Interview Date</Label>
              {isReadOnly ? (
                <Input value={interviewDate} disabled className="mt-1" />
              ) : (
                <Input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="mt-1" />
              )}
            </div>
            <div>
              <Label className="label-caps">Years of Experience</Label>
              {isReadOnly ? (
                <Input value={yearsExp} disabled className="mt-1" />
              ) : (
                <Input value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} className="mt-1" />
              )}
            </div>
            <div className="sm:col-span-2">
              <Label className="label-caps">Education</Label>
              {isReadOnly ? (
                <Input value={education} disabled className="mt-1" />
              ) : (
                <Textarea value={education} onChange={(e) => setEducation(e.target.value)} className="mt-1" rows={2} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skill Assessment Table */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 px-6 py-4 border-b">
          <h3 className="text-sm font-semibold text-foreground">Skill Assessment</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Evaluation of candidate competencies</p>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50/50 dark:bg-slate-800/50 w-[40px]">#</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50/50 dark:bg-slate-800/50 w-[200px]">Skill</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50/50 dark:bg-slate-800/50 w-[120px]">Result</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50/50 dark:bg-slate-800/50">Notes</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50/50 dark:bg-slate-800/50 w-[90px] text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skillResults.map((sr, i) => {
                const isPass = sr.passFail === "pass";
                const isFail = sr.passFail === "fail";
                return (
                  <TableRow key={sr.skill} className={`border-b border-border/30 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${isPass ? "bg-emerald-50/30 dark:bg-emerald-950/10" : isFail ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}>
                    <TableCell className="py-3 text-center">
                      <span className="text-xs text-muted-foreground font-medium">{i + 1}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-[13px] font-medium text-foreground">{sr.skill}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      {isReadOnly ? (
                        isPass ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Pass
                          </span>
                        ) : isFail ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            Fail
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not evaluated</span>
                        )
                      ) : (
                        <RadioGroup
                          value={sr.passFail}
                          onValueChange={(v) => updateSkill(i, "passFail", v)}
                          className="flex gap-4"
                        >
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem value="pass" id={`pf-${i}-pass`} className="border-emerald-500 text-emerald-600" />
                            <Label htmlFor={`pf-${i}-pass`} className="text-xs cursor-pointer text-emerald-700 dark:text-emerald-400">Pass</Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem value="fail" id={`pf-${i}-fail`} className="border-red-500 text-red-600" />
                            <Label htmlFor={`pf-${i}-fail`} className="text-xs cursor-pointer text-red-700 dark:text-red-400">Fail</Label>
                          </div>
                        </RadioGroup>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {isReadOnly ? (
                        <span className="text-[13px] text-muted-foreground">{sr.notes || <span className="italic text-xs">No notes</span>}</span>
                      ) : (
                        <Input
                          value={sr.notes}
                          onChange={(e) => updateSkill(i, "notes", e.target.value)}
                          placeholder="Add notes…"
                          className="h-8 text-[13px] bg-transparent border-dashed focus:border-solid"
                        />
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      {isReadOnly ? (
                        <span className={`inline-flex items-center justify-center min-w-[48px] px-2.5 py-1 rounded-md text-[13px] font-bold ${sr.score >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : sr.score >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : sr.score > 0 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                          {sr.score}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={sr.score || ""}
                          onChange={(e) => updateSkill(i, "score", parseInt(e.target.value) || 0)}
                          className="h-8 w-20 text-[13px] text-right font-medium"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Total Score */}
      <div className="flex justify-end">
        <div className={`px-6 py-4 rounded-xl border-2 ${totalScore >= 700 ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" : totalScore >= 400 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"}`}>
          <div className="label-caps text-[10px] mb-1">Total Score</div>
          <div className={`text-2xl font-bold ${totalScore >= 700 ? "text-emerald-700 dark:text-emerald-300" : totalScore >= 400 ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
            {totalScore}
            <span className="text-sm font-normal text-muted-foreground ml-1">/ {skillResults.length * 100}</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${totalScore >= 700 ? "bg-emerald-500" : totalScore >= 400 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.min((totalScore / (skillResults.length * 100)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      {!isReadOnly && (
        <div className="flex justify-end">
          <Button onClick={() => save()} disabled={saving || !interviewer || !interviewDate}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save & Complete Interview
          </Button>
        </div>
      )}

      {/* Documents */}
      {interview?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Supporting Documents</span>
              {!isReadOnly && (
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="text-[13px]" disabled={uploading} asChild>
                    <span>
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 mr-1" />
                      )}
                      Upload
                    </span>
                  </Button>
                  <input type="file" className="hidden" onChange={handleUpload} />
                </label>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!documents || documents.length === 0) ? (
              <p className="text-sm text-muted-foreground">No documents attached.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {doc.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
