import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, Plus, Eye } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type {
  Equipment,
  EquipmentCalibration,
  EquipmentAdjustment,
  EquipmentRepair,
  EquipmentMaintenance,
} from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { TableSkeleton } from "@/components/inventory/skeletons";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/inventory/format";
import { EQUIPMENT_TYPES, CALIBRATION_FREQUENCIES, employeeLabel } from "@/lib/inventory/employees";
import { CreateCalibrationDialog } from "@/components/equipment/create-calibration-dialog";
import { CreateAdjustmentDialog } from "@/components/equipment/create-adjustment-dialog";
import { CreateRepairDialog } from "@/components/equipment/create-repair-dialog";
import { CreateMaintenanceDialog } from "@/components/equipment/create-maintenance-dialog";
import { EquipmentDetailModal } from "@/components/equipment/equipment-detail-modal";

/* ── Helpers ─────────────────────────────────────────────────── */

/** Capitalize first letter of a string, or return "—" for blank */
function capFirst(v: string | null | undefined) {
  if (!v || v.trim() === "") return "—";
  const s = v.trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Render a measurement value (accurate/inaccurate) as a colored badge */
function MeasurementBadge({ value }: { value: string | null | undefined }) {
  if (!value || value.trim() === "") return <span className="text-muted-foreground">—</span>;
  const s = value.trim();
  const lower = s.toLowerCase();
  const display = s.charAt(0).toUpperCase() + s.slice(1);
  if (lower === "accurate") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        {display}
      </span>
    );
  }
  if (lower === "inaccurate") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400" />
        {display}
      </span>
    );
  }
  return <span className="text-foreground font-medium">{display}</span>;
}

/** Render a maintenance type badge — "Cleaning" and "Oiling" get bold colored styling */
function MaintenanceTypeBadge({ type }: { type: string }) {
  const lower = type.toLowerCase();
  if (lower === "cleaning") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
        {type}
      </span>
    );
  }
  if (lower === "oiling") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
        {type}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {type}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/equipment-detail/$id")({
  ssr: false,
  component: EquipmentDetailPage,
});

function equipmentTypeLabel(v: string) {
  return EQUIPMENT_TYPES.find((t) => t.value === v)?.label ?? v ?? "—";
}

function calibrationFreqLabel(v: string) {
  return CALIBRATION_FREQUENCIES.find((f) => f.value === v)?.label ?? v ?? "—";
}

type ModalRecord =
  | { type: "calibration"; data: EquipmentCalibration }
  | { type: "adjustment"; data: EquipmentAdjustment }
  | { type: "repair"; data: EquipmentRepair }
  | { type: "maintenance"; data: EquipmentMaintenance };

function EquipmentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [calDialogOpen, setCalDialogOpen] = useState(false);
  const [adjDialogOpen, setAdjDialogOpen] = useState(false);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [maintDialogOpen, setMaintDialogOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState<ModalRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openModal(record: ModalRecord) {
    setModalRecord(record);
    setModalOpen(true);
  }

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Equipment;
    },
  });

  const { data: calibrations } = useQuery({
    queryKey: ["equipment", id, "calibrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_calibrations")
        .select("*")
        .eq("equipment_id", id)
        .order("calibration_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EquipmentCalibration[];
    },
  });

  const { data: adjustments } = useQuery({
    queryKey: ["equipment", id, "adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_adjustments")
        .select("*")
        .eq("equipment_id", id)
        .order("adjustment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EquipmentAdjustment[];
    },
  });

  const { data: repairs } = useQuery({
    queryKey: ["equipment", id, "repairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_repairs")
        .select("*")
        .eq("equipment_id", id)
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EquipmentRepair[];
    },
  });

  const { data: maintenance } = useQuery({
    queryKey: ["equipment", id, "maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_maintenance")
        .select("*")
        .eq("equipment_id", id)
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EquipmentMaintenance[];
    },
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <TableSkeleton />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Equipment not found.</p>
        <Link to="/equipment">
          <Button variant="link" className="mt-2">
            Back to Equipment
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={equipment.name}
        description={`Equipment ID: ${equipment.equipment_id}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/equipment" })}
              className="text-[13px]"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
            <Link to="/equipment-edit/$id" params={{ id }}>
              <Button variant="outline" size="sm" className="text-[13px]">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Equipment
              </Button>
            </Link>
          </>
        }
      />

      {/* Equipment Info Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <div className="label-caps">Equipment ID</div>
                <div className="text-sm num font-medium">{equipment.equipment_id}</div>
              </div>
              <div>
                <div className="label-caps">Name</div>
                <div className="text-sm">{equipment.name}</div>
              </div>
              <div>
                <div className="label-caps">Equipment Type</div>
                <div className="text-sm">{equipmentTypeLabel(equipment.equipment_type)}</div>
              </div>
              <div>
                <div className="label-caps">Status</div>
                <div className="text-sm">
                  {equipment.status === "active" ? (
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
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="label-caps">Purchased Date</div>
                <div className="text-sm">{fmtDate(equipment.purchased_date)}</div>
              </div>
              <div>
                <div className="label-caps">Purchased From</div>
                <div className="text-sm">{equipment.purchased_from}</div>
              </div>
              <div>
                <div className="label-caps">Calibration Frequency</div>
                <div className="text-sm">
                  {calibrationFreqLabel(equipment.calibration_frequency)}
                </div>
              </div>
              {equipment.notes && (
                <div>
                  <div className="label-caps">Notes</div>
                  <div className="text-sm">{equipment.notes}</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Tabs */}
      <Tabs defaultValue="calibration">
        <TabsList>
          <TabsTrigger value="calibration">Calibration Records</TabsTrigger>
          <TabsTrigger value="adjustment">Adjustment Records</TabsTrigger>
          <TabsTrigger value="repair">Repair Records</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance Records</TabsTrigger>
        </TabsList>

        {/* Calibration */}
        <TabsContent value="calibration">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">Calibration Records</h3>
            <Button size="sm" className="h-8 text-[13px]" onClick={() => setCalDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
          {(calibrations ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No calibration records yet.</p>
          ) : (
            <Card className="overflow-hidden border border-border/60 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-border">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Managed By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Lab Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Next Calibration</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Status</TableHead>
                    <TableHead className="w-[70px] text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calibrations?.map((c, i) => (
                    <TableRow key={c.id} className="row-rule group border-b border-border/40 last:border-0">
                      <TableCell className="py-3.5 text-[13px] font-medium text-slate-900">
                        {fmtDate(c.calibration_date)}
                      </TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">
                        {employeeLabel(c.calibration_managed_by)}
                      </TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">{c.lab_name}</TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">
                        {fmtDate(c.next_calibration_date)}
                      </TableCell>
                      <TableCell className="py-3.5">
                        {c.calibration_status === "active" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-950 dark:text-red-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950 transition-colors"
                          onClick={() => openModal({ type: "calibration", data: c })}
                        >
                          <Eye className="h-[18px] w-[18px]" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <CreateCalibrationDialog
            open={calDialogOpen}
            onOpenChange={setCalDialogOpen}
            equipmentId={id}
            calibrationFrequency={equipment.calibration_frequency}
          />
        </TabsContent>

        {/* Adjustment */}
        <TabsContent value="adjustment">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">Adjustment Records</h3>
            <Button size="sm" className="h-8 text-[13px]" onClick={() => setAdjDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
          {(adjustments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No adjustment records yet.</p>
          ) : (
            <Card className="overflow-hidden border border-border/60 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-border">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Managed By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Notes</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Before</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">After</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Company</TableHead>
                    <TableHead className="w-[70px] text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments?.map((a) => (
                    <TableRow key={a.id} className="row-rule group border-b border-border/40 last:border-0">
                      <TableCell className="py-3.5 text-[13px] font-medium text-slate-900">
                        {fmtDate(a.adjustment_date)}
                      </TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">
                        {employeeLabel(a.adjustment_managed_by)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-400 text-[13px] py-3.5">
                        {a.adjustment_notes}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <MeasurementBadge value={a.measurements_before} />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <MeasurementBadge value={a.measurements_after} />
                      </TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">{a.company_name}</TableCell>
                      <TableCell className="py-3.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950 transition-colors"
                          onClick={() => openModal({ type: "adjustment", data: a })}
                        >
                          <Eye className="h-[18px] w-[18px]" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <CreateAdjustmentDialog
            open={adjDialogOpen}
            onOpenChange={setAdjDialogOpen}
            equipmentId={id}
          />
        </TabsContent>

        {/* Repair */}
        <TabsContent value="repair">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">Repair Records</h3>
            <Button size="sm" className="h-8 text-[13px]" onClick={() => setRepairDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
          {(repairs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No repair records yet.</p>
          ) : (
            <Card className="overflow-hidden border border-border/60 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-border">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Repaired By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Notes</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Test Run</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Tested By</TableHead>
                    <TableHead className="w-[70px] text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repairs?.map((r) => (
                    <TableRow key={r.id} className="row-rule group border-b border-border/40 last:border-0">
                      <TableCell className="py-3.5 text-[13px] font-medium text-slate-900">{fmtDate(r.repair_date)}</TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">
                        {employeeLabel(r.repaired_by)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-400 text-[13px] py-3.5">
                        {r.repair_notes}
                      </TableCell>
                      <TableCell className="py-3.5">
                        {r.test_run === "success" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-950 dark:text-red-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">
                        {employeeLabel(r.tested_by)}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950 transition-colors"
                          onClick={() => openModal({ type: "repair", data: r })}
                        >
                          <Eye className="h-[18px] w-[18px]" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <CreateRepairDialog
            open={repairDialogOpen}
            onOpenChange={setRepairDialogOpen}
            equipmentId={id}
          />
        </TabsContent>

        {/* Maintenance */}
        <TabsContent value="maintenance">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">Maintenance Records</h3>
            <Button size="sm" className="h-8 text-[13px]" onClick={() => setMaintDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
          {(maintenance ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No maintenance records yet.</p>
          ) : (
            <Card className="overflow-hidden border border-border/60 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-border">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Done By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Maintenance Types</TableHead>
                    <TableHead className="w-[70px] text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenance?.map((m) => (
                    <TableRow key={m.id} className="row-rule group border-b border-border/40 last:border-0">
                      <TableCell className="py-3.5 text-[13px] font-medium text-slate-900">
                        {fmtDate(m.maintenance_date)}
                      </TableCell>
                      <TableCell className="py-3.5 text-[13px] text-slate-600">
                        {employeeLabel(m.maintenance_done_by)}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {m.maintenance_types.map((t) => (
                            <MaintenanceTypeBadge key={t} type={t} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950 transition-colors"
                          onClick={() => openModal({ type: "maintenance", data: m })}
                        >
                          <Eye className="h-[18px] w-[18px]" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <CreateMaintenanceDialog
            open={maintDialogOpen}
            onOpenChange={setMaintDialogOpen}
            equipmentId={id}
          />
        </TabsContent>
      </Tabs>

      {/* Detail View Modal */}
      <EquipmentDetailModal open={modalOpen} onOpenChange={setModalOpen} record={modalRecord} />
    </div>
  );
}
