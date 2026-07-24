import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { TrainingProgram } from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload, FileList } from "@/components/inventory/file-upload";
import { TRAINING_PERSONNEL, TRAINING_SCHEDULES } from "@/lib/inventory/employees";

export const Route = createFileRoute("/_authenticated/roles/training/$id/edit")({
  ssr: false,
  component: TrainingEditPage,
});

function TrainingEditPage() {
  const { id } = useParams({ from: "/_authenticated/roles/training/$id/edit" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: p, isLoading } = useQuery({
    queryKey: ["training_program", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_programs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as TrainingProgram;
    },
  });

  const [name, setName] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [trainer, setTrainer] = useState<string | null>(null);
  const [trainees, setTrainees] = useState<string[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [documents, setDocuments] = useState<string[]>([]);

  // hydrate once data arrives
  const hydrated = name !== null || p === undefined ? true : name !== null;
  const v = (val: string | null | undefined, fallback: string) =>
    val === null ? fallback : val;
  const vt = (val: string[] | null | undefined, fallback: string[]) =>
    val === null ? fallback : val;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("training_programs")
        .update({
          training_name: v(name, p!.training_name),
          training_objectives: v(objectives, p!.training_objectives ?? "") || null,
          training_duration: v(duration, p!.training_duration ?? "") || null,
          trainer: v(trainer, p!.trainer ?? "") || null,
          trainees: vt(trainees, p!.trainees ?? []),
          status: v(status, p!.status),
          performance_evaluation:
            v(evaluation, p!.performance_evaluation ?? "") || null,
          schedule: v(schedule, p!.schedule),
          documents: documents.length ? documents : (p!.documents ?? []),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Training program updated");
      qc.invalidateQueries({ queryKey: ["training_programs"] });
      qc.invalidateQueries({ queryKey: ["training_program", id] });
      navigate({ to: "/roles/training/$id", params: { id } });
    },
    onError: (e: any) =>
      toast.error(e.message ?? "Failed to update training program"),
  });

  if (isLoading || !p) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const toggleTrainee = (val: string) =>
    setTrainees((prev) =>
      prev === null
        ? p!.trainees.includes(val)
          ? p!.trainees.filter((x) => x !== val)
          : [...p!.trainees, val]
        : prev.includes(val)
          ? prev.filter((x) => x !== val)
          : [...prev, val]
    );

  const canSave =
    (name !== null ? name : p.training_name) &&
    (trainer !== null ? trainer : p.trainer) &&
    (schedule !== null ? schedule : p.schedule) &&
    (trainees !== null ? trainees.length : p.trainees.length) > 0;

  return (
    <div>
      <PageHeader
        title="Edit Training Program"
        description={
          <span className="font-mono text-[12px]">{p.training_id}</span>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/roles/training/$id", params: { id } })}
            className="text-[13px]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Detail
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Training details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl p-6">
          <div>
            <Label className="label-caps">Training Name</Label>
            <div className="text-[13px] font-medium py-2 px-1 mt-1">
              {p.training_name}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground -mt-2">
            Training ID: <span className="font-mono">{p.training_id}</span> (read-only)
          </div>

          <div>
            <Label className="label-caps">Training Objectives</Label>
            <Textarea
              rows={4}
              defaultValue={p.training_objectives ?? ""}
              onChange={(e) => setObjectives(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">Training Duration</Label>
              <Input
                defaultValue={p.training_duration ?? ""}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="label-caps">Status</Label>
              <Select
                defaultValue={p.status}
                onValueChange={(val) => setStatus(val)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="label-caps">Trainer *</Label>
            <Select
              defaultValue={p.trainer ?? ""}
              onValueChange={(val) => setTrainer(val)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a trainer" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_PERSONNEL.map((person) => (
                  <SelectItem key={person.value} value={person.value}>
                    {person.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="label-caps">Trainees * (multiple)</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded border border-border p-3 max-h-48 overflow-y-auto">
              {TRAINING_PERSONNEL.map((person) => {
                const current = trainees === null ? p.trainees : trainees;
                return (
                  <label
                    key={person.value}
                    className="flex items-center gap-2 text-[13px] cursor-pointer"
                  >
                    <Checkbox
                      checked={current.includes(person.value)}
                      onCheckedChange={() => toggleTrainee(person.value)}
                    />
                    {person.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="label-caps">Schedule *</Label>
            <Select
              defaultValue={p.schedule}
              onValueChange={(val) => setSchedule(val)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a schedule" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_SCHEDULES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="label-caps">Performance Evaluation Key Factors</Label>
            <Textarea
              rows={4}
              defaultValue={p.performance_evaluation ?? ""}
              onChange={(e) => setEvaluation(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="label-caps">Documents</Label>
            {p.documents && p.documents.length > 0 && documents.length === 0 && (
              <div className="mb-2">
                <FileList urls={p.documents} />
              </div>
            )}
            <FileUpload
              pathPrefix="training"
              onFilesChange={setDocuments}
              existingUrls={documents}
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/roles/training/$id", params: { id } })}
            >
              Cancel
            </Button>
            <Button onClick={() => mutate()} disabled={!canSave || isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Training Program
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
