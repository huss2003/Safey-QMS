import { createFileRoute, Link, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, Eye, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type {
  Employee,
  EmployeePerformanceEvaluation,
  EmployeeHealthRecord,
} from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { TableSkeleton } from "@/components/inventory/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUpload, FileList } from "@/components/inventory/file-upload";
import { fmtDate } from "@/lib/inventory/format";
import { roleLabel } from "@/lib/inventory/employees";
import { InterviewSheet } from "@/components/employees/interview-sheet";
import { EmployeeTrainings } from "@/components/employees/employee-trainings";
import { EmployeePerformanceTab, EmployeeHealthTab } from "@/components/employees/employee-tabs";

export const Route = createFileRoute("/_authenticated/roles/employees/$id")({
  ssr: false,
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const location = useLocation();
  const isEdit = location.pathname.includes("/edit");
  if (isEdit) return <Outlet />;
  const navigate = useNavigate();

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Employee;
    },
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <TableSkeleton />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Employee not found.</p>
        <Link to="/roles/employees">
          <Button variant="link" className="mt-2">
            Back to Employees
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={employee.employee_name}
        description={`Employee ID: ${employee.employee_id || employee.id.slice(0, 8)}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/roles/employees" })}
              className="text-[13px]"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
            <Link to="/roles/employees/$id/edit" params={{ id }}>
              <Button variant="outline" size="sm" className="text-[13px]">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Employee
              </Button>
            </Link>
          </>
        }
      />

      {/* Employee Info Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <div className="label-caps">Employee Name</div>
                <div className="text-sm font-medium">{employee.employee_name}</div>
              </div>
              <div>
                <div className="label-caps">Employee Role</div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {roleLabel(employee.employee_role)}
                </Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="label-caps">Date of Birth</div>
                <div className="text-sm">{fmtDate(employee.date_of_birth)}</div>
              </div>
              <div>
                <div className="label-caps">Recruited Date</div>
                <div className="text-sm">{fmtDate(employee.recruited_date)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="interview">
        <TabsList>
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="trainings">Trainings</TabsTrigger>
          <TabsTrigger value="performance">Performance Evaluation</TabsTrigger>
          <TabsTrigger value="health">Health Records</TabsTrigger>
        </TabsList>

        <TabsContent value="interview" className="mt-4">
          <InterviewSheet employee={employee} />
        </TabsContent>

        <TabsContent value="trainings" className="mt-4">
          <EmployeeTrainings employee={employee} />
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <EmployeePerformanceTab employeeId={employee.id} employeeName={employee.employee_name} />
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <EmployeeHealthTab employeeId={employee.id} employee={employee} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
