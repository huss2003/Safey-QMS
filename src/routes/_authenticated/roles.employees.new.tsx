import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPLOYEE_ROLES } from "@/lib/inventory/employees";

export const Route = createFileRoute("/_authenticated/roles/employees/new")({
  ssr: false,
  component: EmployeesNewPage,
});

function EmployeesNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [dob, setDob] = useState("");
  const [recruited, setRecruited] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").insert({
        employee_name: name,
        employee_role: role,
        date_of_birth: dob || null,
        recruited_date: recruited || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee created");
      qc.invalidateQueries({ queryKey: ["employees"] });
      navigate({ to: "/roles/employees" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create employee"),
  });

  return (
    <div>
      <PageHeader
        title="New Employee"
        description="Add a new employee to the registry"
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
        <CardContent className="space-y-4 max-w-xl p-6">
          <div>
            <Label className="label-caps">Employee Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Verma"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="label-caps">Employee Role *</Label>
            <Select value={role} onValueChange={setRole}>
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

          <div>
            <Label className="label-caps">Date of Birth</Label>
            <Input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="label-caps">Recruited Date</Label>
            <Input
              type="date"
              value={recruited}
              onChange={(e) => setRecruited(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/roles/employees" })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => mutate()}
              disabled={!name || !role || isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Employee
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
