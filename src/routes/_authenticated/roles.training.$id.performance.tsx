import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { TrainingProgram } from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/roles/training/$id/performance")({
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

function TrainingPerformancePage() {
  const { id } = useParams({
    from: "/_authenticated/roles/training/$id/performance",
  });

  const { data: program, isLoading: programLoading } = useQuery({
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

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["employee-trainings-for-program", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_trainings")
        .select("*")
        .eq("training_program_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingRecord[];
    },
  });

  const isLoading = programLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="p-4">
        <TableSkeleton />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="py-12 text-center text-muted-foreground">Training program not found.</div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${program.training_name} — Performance`}
        description={`Training ID: ${program.training_id}`}
        actions={
          <Link to="/roles/training">
            <Button variant="ghost" size="sm" className="text-[13px]">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Training
            </Button>
          </Link>
        }
      />

      {/* ── Training Details (Horizontal Table) ── */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Training Details</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Training Name</TableHead>
                  <TableHead>Training ID</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Trainees</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-[13px]">{program.training_name}</TableCell>
                  <TableCell className="text-[12.5px] font-mono">{program.training_id}</TableCell>
                  <TableCell className="text-[12.5px]">{program.trainer}</TableCell>
                  <TableCell className="text-[12.5px]">
                    {Array.isArray(program.trainees) && program.trainees.length
                      ? program.trainees.join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-[12.5px]">
                    {program.training_duration || "—"}
                  </TableCell>
                  <TableCell className="text-[12.5px]">{program.schedule}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        program.status === "Active"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }
                    >
                      {program.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {program.training_objectives && (
            <div className="mt-3">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                Objectives
              </div>
              <p className="text-[13px] leading-relaxed">{program.training_objectives}</p>
            </div>
          )}

          {program.performance_evaluation && (
            <div className="mt-3">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                Performance Evaluation Key Factors
              </div>
              <p className="text-[13px] leading-relaxed">{program.performance_evaluation}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Performance Evaluation Table ── */}
      <Card className="overflow-hidden p-0">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Performance Evaluation</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {records.length} record{records.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No performance records for this training program yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainee Name</TableHead>
                  <TableHead>Trainee Role</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Performance Date</TableHead>
                  <TableHead>Evaluation Marks</TableHead>
                  <TableHead>Documents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[13px] font-medium">{r.trainee_name}</TableCell>
                    <TableCell className="text-[12.5px]">{r.trainee_role}</TableCell>
                    <TableCell className="text-[12.5px]">{r.trainer}</TableCell>
                    <TableCell className="text-[12.5px]">{fmtDate(r.performance_date)}</TableCell>
                    <TableCell className="text-[12.5px]">{r.evaluation_marks || "—"}</TableCell>
                    <TableCell className="text-[12.5px]">
                      {r.documents?.length ? (
                        <span className="text-primary">
                          {r.documents.length} file
                          {r.documents.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
