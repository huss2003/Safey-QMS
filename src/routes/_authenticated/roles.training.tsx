import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, GraduationCap, Eye, Pencil, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { TrainingProgram } from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { EmptyState } from "@/components/inventory/empty-state";
import { TableSkeleton } from "@/components/inventory/skeletons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/roles/training")({
  ssr: false,
  component: TrainingListPage,
});

function TrainingListPage() {
  const isChildRoute = window.location.pathname !== "/roles/training";
  if (isChildRoute) return <Outlet />;
  const { data: programs, isLoading } = useQuery({
    queryKey: ["training_programs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_programs")
        .select("*")
        .order("training_id");
      if (error) throw error;
      return (data ?? []) as TrainingProgram[];
    },
  });

  return (
    <div>
      <PageHeader
        title="Training Programs"
        description="Standard HRM training programs for the QMS (ISO 13485 / MDSAP)."
        meta={
          <span className="text-[12px] text-muted-foreground">
            Total{" "}
            <span className="text-foreground num font-medium ml-1">{programs?.length ?? 0}</span>
          </span>
        }
        actions={
          <Link to="/roles/training/new">
            <Button className="h-8 text-[13px]">
              <Plus className="h-3.5 w-3.5" /> New Training Program
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="p-4">
          <TableSkeleton />
        </div>
      ) : !programs || programs.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No training programs yet"
          description="Create a training program to track objectives, trainees and evaluation criteria."
          action={
            <Link to="/roles/training/new">
              <Button>
                <Plus className="h-4 w-4" /> New Training Program
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Training Name</TableHead>
                <TableHead>Training ID</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Trainee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((p) => (
                <TableRow key={p.id} className="row-rule">
                  <TableCell className="font-medium text-[13px] py-2.5 max-w-[260px] truncate">
                    {p.training_name}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground py-2.5">
                    {p.training_id}
                  </TableCell>
                  <TableCell className="text-[12.5px] py-2.5">{p.trainer}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground py-2.5 max-w-[200px] truncate">
                    {Array.isArray(p.trainees) && p.trainees.length ? p.trainees.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="py-2.5">
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
                  </TableCell>
                  <TableCell className="text-right py-2.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link to="/roles/training/$id" params={{ id: p.id }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link to="/roles/training/$id/edit" params={{ id: p.id }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
