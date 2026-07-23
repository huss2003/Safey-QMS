import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Wrench, Search, Eye, Pencil, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Equipment } from "@/integrations/supabase/database.types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PageHeader } from "@/components/inventory/page-header";
import { EmptyState } from "@/components/inventory/empty-state";
import { TableSkeleton } from "@/components/inventory/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate } from "@/lib/inventory/format";
import { EQUIPMENT_TYPES, CALIBRATION_FREQUENCIES } from "@/lib/inventory/employees";

export const Route = createFileRoute("/_authenticated/equipment")({
  ssr: false,
  component: EquipmentPage,
});

function calibrationFreqLabel(v: string) {
  return CALIBRATION_FREQUENCIES.find((f) => f.value === v)?.label ?? v ?? "—";
}

function equipmentTypeLabel(v: string) {
  return EQUIPMENT_TYPES.find((t) => t.value === v)?.label ?? v ?? "—";
}

function EquipmentPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Equipment[];
    },
  });

  const filtered = (equipment ?? []).filter((e) => {
    const term = debouncedQ.toLowerCase();
    const matchQ =
      !term ||
      [e.equipment_id, e.name, e.purchased_from].some((f) =>
        String(f).toLowerCase().includes(term),
      );
    const matchType = filterType === "all" || e.equipment_type === filterType;
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    return matchQ && matchType && matchStatus;
  });

  const activeCount = filtered.filter((e) => e.status === "active").length;
  const measuringCount = filtered.filter((e) => e.equipment_type === "measuring").length;

  return (
    <div>
      <PageHeader
        title="Equipment"
        description="Manage process and measuring equipment, calibrations, adjustments, repairs and maintenance."
        meta={
          <>
            <span className="text-[12px] text-muted-foreground">
              Total <span className="text-foreground num font-medium ml-1">{filtered.length}</span>
            </span>
            <span className="text-[12px] text-muted-foreground">
              Active <span className="text-foreground num font-medium ml-1">{activeCount}</span>
            </span>
            <span className="text-[12px] text-muted-foreground">
              Measuring{" "}
              <span className="text-foreground num font-medium ml-1">{measuringCount}</span>
            </span>
          </>
        }
        actions={
          <Link to="/equipment-new">
            <Button className="h-8 text-[13px]">
              <Plus className="h-3.5 w-3.5" /> New Equipment
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by ID, name, supplier…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="sm:w-44 h-8 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EQUIPMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-36 h-8 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="p-4">
          <TableSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No equipment yet"
          description="Add your first equipment item to start tracking calibrations, adjustments, repairs and maintenance."
          action={
            <Link to="/equipment-new">
              <Button>
                <Plus className="h-4 w-4" /> New Equipment
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead>Calibration Freq</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} className="row-rule">
                  <TableCell className="font-medium text-[13px] num py-2.5">
                    {e.equipment_id}
                  </TableCell>
                  <TableCell className="text-[13px] py-2.5">{e.name}</TableCell>
                  <TableCell className="text-[13px] py-2.5">
                    {equipmentTypeLabel(e.equipment_type)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {e.status === "active" ? (
                      <Badge
                        variant="secondary"
                        className="bg-success/15 text-success border-success/20"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-destructive/15 text-destructive border-destructive/20"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground py-2.5">
                    {fmtDate(e.purchased_date)}
                  </TableCell>
                  <TableCell className="text-[13px] py-2.5">
                    {calibrationFreqLabel(e.calibration_frequency)}
                  </TableCell>
                  <TableCell className="text-right py-2.5">
                    <Link to="/equipment-detail/$id" params={{ id: e.id }}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Link to="/equipment-edit/$id" params={{ id: e.id }}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
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
