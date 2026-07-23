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
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Managed By</TableHead>
                    <TableHead>Lab Name</TableHead>
                    <TableHead>Next Calibration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calibrations?.map((c) => (
                    <TableRow key={c.id} className="row-rule">
                      <TableCell className="text-[13px] py-2.5">
                        {fmtDate(c.calibration_date)}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5">
                        {employeeLabel(c.managed_by)}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5">{c.lab_name}</TableCell>
                      <TableCell className="text-[13px] py-2.5">
                        {fmtDate(c.next_calibration_date)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {c.status === "active" ? (
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
                      <TableCell className="py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openModal({ type: "calibration", data: c })}
                        >
                          <Eye className="h-4 w-4" />
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
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Managed By</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments?.map((a) => (
                    <TableRow key={a.id} className="row-rule">
                      <TableCell className="text-[13px] py-2.5">
                        {fmtDate(a.adjustment_date)}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5">
                        {employeeLabel(a.managed_by)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground text-[13px] py-2.5">
                        {a.notes}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5 font-mono">
                        {a.measurements_before ?? "—"}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5 font-mono">
                        {a.measurements_after ?? "—"}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5">{a.company_name}</TableCell>
                      <TableCell className="py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openModal({ type: "adjustment", data: a })}
                        >
                          <Eye className="h-4 w-4" />
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
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Repaired By</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Test Run</TableHead>
                    <TableHead>Tested By</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repairs?.map((r) => (
                    <TableRow key={r.id} className="row-rule">
                      <TableCell className="text-[13px] py-2.5">{fmtDate(r.repair_date)}</TableCell>
                      <TableCell className="text-[13px] py-2.5">
                        {employeeLabel(r.repaired_by)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground text-[13px] py-2.5">
                        {r.notes}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {r.test_run === "success" ? (
                          <Badge
                            variant="secondary"
                            className="bg-success/15 text-success border-success/20"
                          >
                            Success
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-destructive/15 text-destructive border-destructive/20"
                          >
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5">
                        {employeeLabel(r.tested_by)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openModal({ type: "repair", data: r })}
                        >
                          <Eye className="h-4 w-4" />
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
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Done By</TableHead>
                    <TableHead>Maintenance Types</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenance?.map((m) => (
                    <TableRow key={m.id} className="row-rule">
                      <TableCell className="text-[13px] py-2.5">
                        {fmtDate(m.maintenance_date)}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5">
                        {employeeLabel(m.maintenance_done_by)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {m.maintenance_types.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[11px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openModal({ type: "maintenance", data: m })}
                        >
                          <Eye className="h-4 w-4" />
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
