import { createFileRoute, Link, useParams, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, Loader2, Pencil, Target, Users, Clock, CalendarCheck, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { TrainingProgram } from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/roles/training/$id")({
  ssr: false,
  component: TrainingDetailPage,
});

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-[13px] font-medium">{value}</div>
      </div>
    </div>
  );
}

function TrainingDetailPage() {
  const { id } = useParams({ from: "/_authenticated/roles/training/$id" });
  const location = useLocation();
  const isEdit = location.pathname.endsWith("/edit");
  if (isEdit) return <Outlet />;

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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!p) {
    return (
      <div className="py-12 text-muted-foreground">Training program not found.</div>
    );
  }

  const trainees = Array.isArray(p.trainees) && p.trainees.length ? p.trainees : [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader
        title={p.training_name}
        description={
          <span className="text-muted-foreground">{p.training_id}</span>
        }
        meta={
          <Badge
            variant="secondary"
            className={
              p.status === "Active"
                ? "bg-success/10 text-success border-success/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            }
          >
            {p.status}
          </Badge>
        }
        actions={
          <>
            <Link to="/roles/training">
              <Button variant="ghost" size="sm" className="text-[13px]">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </Link>
            <Link to="/roles/training/$id/edit" params={{ id: p.id }}>
              <Button size="sm" className="text-[13px]">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            </Link>
          </>
        }
      />

      {/* Stats bar */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={Clock} label="Duration" value={p.training_duration ? `${p.training_duration} day(s)` : "—"} />
            <Stat icon={GraduationCap} label="Trainer" value={p.trainer || "—"} />
            <Stat icon={Users} label="Trainees" value={`${trainees.length} person(s)`} />
            <Stat icon={CalendarCheck} label="Schedule" value={p.schedule || "—"} />
          </div>
        </CardContent>
      </Card>

      {/* Training Objectives */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">Training Objectives</h3>
          </div>
          <Separator className="mb-4" />
          {p.training_objectives ? (
            <div className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line">
              {p.training_objectives}
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground italic">No objectives specified</div>
          )}
        </CardContent>
      </Card>

      {/* Performance Evaluation */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">Performance Evaluation Key Factors</h3>
          </div>
          <Separator className="mb-4" />
          {p.performance_evaluation ? (
            <div className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line">
              {p.performance_evaluation}
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground italic">No evaluation criteria specified</div>
          )}
        </CardContent>
      </Card>

      {/* Trainees */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">Trainees</h3>
          </div>
          <Separator className="mb-4" />
          {trainees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {trainees.map((t: string) => (
                <Badge key={t} variant="secondary" className="px-3 py-1 text-[12px] font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground italic">No trainees assigned</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
