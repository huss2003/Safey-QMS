import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { fmtDate } from "@/lib/inventory/format";
import { employeeLabel } from "@/lib/inventory/employees";
import type {
  EquipmentCalibration,
  EquipmentAdjustment,
  EquipmentRepair,
  EquipmentMaintenance,
} from "@/integrations/supabase/database.types";

type RecordType =
  | { type: "calibration"; data: EquipmentCalibration }
  | { type: "adjustment"; data: EquipmentAdjustment }
  | { type: "repair"; data: EquipmentRepair }
  | { type: "maintenance"; data: EquipmentMaintenance };

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className="text-sm mt-0.5">{children ?? "—"}</div>
    </div>
  );
}

function CalibrationDetail({ data }: { data: EquipmentCalibration }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DetailRow label="Calibration Date">{fmtDate(data.calibration_date)}</DetailRow>
      <DetailRow label="Managed By">{employeeLabel(data.managed_by)}</DetailRow>
      <DetailRow label="Lab Name">{data.lab_name}</DetailRow>
      <DetailRow label="Lab Address">{data.lab_address}</DetailRow>
      <DetailRow label="Next Calibration">{fmtDate(data.next_calibration_date)}</DetailRow>
      <DetailRow label="Status">
        {data.status === "active" ? (
          <Badge variant="secondary" className="bg-success/15 text-success border-success/20">
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
      </DetailRow>
      {data.report_url && (
        <div className="col-span-2">
          <DetailRow label="Report">
            <Button variant="link" size="sm" className="h-auto p-0 text-sm" asChild>
              <a href={data.report_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1 inline" />
                Download Report
              </a>
            </Button>
          </DetailRow>
        </div>
      )}
    </div>
  );
}

function AdjustmentDetail({ data }: { data: EquipmentAdjustment }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DetailRow label="Adjustment Date">{fmtDate(data.adjustment_date)}</DetailRow>
      <DetailRow label="Managed By">{employeeLabel(data.managed_by)}</DetailRow>
      <DetailRow label="Measurement Before">{data.measurements_before ?? "—"}</DetailRow>
      <DetailRow label="Measurement After">{data.measurements_after ?? "—"}</DetailRow>
      <DetailRow label="Notes">{data.notes}</DetailRow>
      <DetailRow label="Company Name">{data.company_name}</DetailRow>
      <DetailRow label="Company Address">
        <span className="whitespace-pre-wrap">{data.company_address}</span>
      </DetailRow>
      {data.evidence_url && (
        <div className="col-span-2">
          <DetailRow label="Evidence">
            <Button variant="link" size="sm" className="h-auto p-0 text-sm" asChild>
              <a href={data.evidence_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1 inline" />
                Download Evidence
              </a>
            </Button>
          </DetailRow>
        </div>
      )}
    </div>
  );
}

function RepairDetail({ data }: { data: EquipmentRepair }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DetailRow label="Repair Date">{fmtDate(data.repair_date)}</DetailRow>
      <DetailRow label="Repaired By">{employeeLabel(data.repaired_by)}</DetailRow>
      <DetailRow label="Repair Notes">
        <span className="whitespace-pre-wrap">{data.notes}</span>
      </DetailRow>
      <DetailRow label="Test Run">
        {data.test_run === "success" ? (
          <Badge variant="secondary" className="bg-success/15 text-success border-success/20">
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
      </DetailRow>
      <DetailRow label="Test Run Notes">
        <span className="whitespace-pre-wrap">{data.test_run_notes || "—"}</span>
      </DetailRow>
      <DetailRow label="Tested By">{employeeLabel(data.tested_by)}</DetailRow>
    </div>
  );
}

function MaintenanceDetail({ data }: { data: EquipmentMaintenance }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DetailRow label="Maintenance Date">{fmtDate(data.maintenance_date)}</DetailRow>
      <DetailRow label="Done By">{employeeLabel(data.maintenance_done_by)}</DetailRow>
      <div className="col-span-2">
        <DetailRow label="Maintenance Types">
          <div className="flex flex-wrap gap-1 mt-0.5">
            {data.maintenance_types.length > 0
              ? data.maintenance_types.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[11px]">
                    {t}
                  </Badge>
                ))
              : "—"}
          </div>
        </DetailRow>
      </div>
    </div>
  );
}

const TITLES: Record<string, string> = {
  calibration: "Calibration Record",
  adjustment: "Adjustment Record",
  repair: "Repair Record",
  maintenance: "Maintenance Record",
};

export function EquipmentDetailModal({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record: RecordType | null;
}) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{TITLES[record.type]}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {record.type === "calibration" && <CalibrationDetail data={record.data} />}
          {record.type === "adjustment" && <AdjustmentDetail data={record.data} />}
          {record.type === "repair" && <RepairDetail data={record.data} />}
          {record.type === "maintenance" && <MaintenanceDetail data={record.data} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
