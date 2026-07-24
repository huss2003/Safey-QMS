import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload, FileList } from "@/components/inventory/file-upload";
import { EMPLOYEE_ROLES } from "@/lib/inventory/employees";

export const Route = createFileRoute("/_authenticated/roles/employees/$id/edit")({
  ssr: false,
  component: EmployeeEditPage,
});

function EmployeeEditPage() {
  const { id } = useParams({ from: "/_authenticated/roles/employees/$id/edit" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: emp, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Employee;
    },
  });

  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [dob, setDob] = useState<string | null>(null);
  const [recruited, setRecruited] = useState<string | null>(null);
  const [documents, setDocuments] = useState<string[]>([]);

  const v = (val: string | null | undefined, fallback: string) =>
    val === null ? fallback : val;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employees")
        .update({
          employee_name: v(name, emp!.employee_name),
          employee_role: v(role, emp!.employee_role),
          date_of_birth: v(dob, emp!.date_of_birth ?? "") || null,
          recruited_date: v(recruited, emp!.recruited_date ?? "") || null,
          documents: documents.length ? documents : (emp!.documents ?? []),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee updated");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employee", id] });
      navigate({ to: "/roles/employees" });
    },
    onError: (e: any) =>
      toast.error(e.message ?? "Failed to update employee"),
  });

  if (isLoading || !emp) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const canSave =
    (name !== null ? name : emp.employee_name) &&
    (role !== null ? role : emp.employee_role);

  return (
    <div>
      <PageHeader
        title="Edit Employee"
        description={
          <span className="font-mono text-[12px]">{emp.employee_name}</span>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/roles/employees" })}
            className="text-[13px]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Employees
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Employee details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl p-6">
          <div>
            <Label className="label-caps">Employee Name *</Label>
            <Input
              defaultValue={emp.employee_name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="label-caps">Employee Role *</Label>
            <Select
              defaultValue={emp.employee_role}
              onValueChange={(val) => setRole(val)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="label-caps">Date of Birth</Label>
              <Input
                type="date"
                defaultValue={emp.date_of_birth ?? ""}
                onChange={(e) => setDob(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="label-caps">Recruited Date</Label>
              <Input
                type="date"
                defaultValue={emp.recruited_date ?? ""}
                onChange={(e) => setRecruited(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="label-caps">Documents</Label>
            {emp.documents && emp.documents.length > 0 && documents.length === 0 && (
              <div className="mb-2">
                <FileList urls={emp.documents} />
              </div>
            )}
            <FileUpload
              pathPrefix={`employees/${id}`}
              onFilesChange={setDocuments}
              existingUrls={documents}
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/roles/employees" })}
            >
              Cancel
            </Button>
            <Button onClick={() => mutate()} disabled={!canSave || isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Employee
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
