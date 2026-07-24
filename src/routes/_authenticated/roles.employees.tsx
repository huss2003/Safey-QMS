import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Eye, Pencil, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/integrations/supabase/database.types";
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
import { fmtDate } from "@/lib/inventory/format";
import { EMPLOYEE_ROLES } from "@/lib/inventory/employees";

export const Route = createFileRoute("/_authenticated/roles/employees")({
  ssr: false,
  component: EmployeesPage,
});

function roleLabel(v: string) {
  return EMPLOYEE_ROLES.find((r) => r.value === v)?.label ?? v ?? "—";
}

function EmployeesPage() {
  const isChildRoute = window.location.pathname !== "/roles/employees";
  if (isChildRoute) return <Outlet />;
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("employee_name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee roles and profiles for the production floor."
        meta={
          <span className="text-[12px] text-muted-foreground">
            Total{" "}
            <span className="text-foreground num font-medium ml-1">
              {employees?.length ?? 0}
            </span>
          </span>
        }
        actions={
          <Link to="/roles/employees/new">
            <Button className="h-8 text-[13px]">
              <Plus className="h-3.5 w-3.5" /> New Employee
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="p-4">
          <TableSkeleton />
        </div>
      ) : !employees || employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Add your first employee to start assigning roles and tracking production activities."
          action={
            <Link to="/roles/employees/new">
              <Button>
                <Plus className="h-4 w-4" /> New Employee
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Employee Role</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Recruited Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id} className="row-rule">
                  <TableCell className="font-medium text-[13px] py-2.5">
                    {e.employee_name}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20"
                    >
                      {roleLabel(e.employee_role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground py-2.5">
                    {fmtDate(e.date_of_birth)}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground py-2.5">
                    {fmtDate(e.recruited_date)}
                  </TableCell>
                  <TableCell className="text-right py-2.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link to="/roles/employees/$id" params={{ id: e.id }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link to="/roles/employees/$id/edit" params={{ id: e.id }}>
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
