import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, FileText, FileX } from "lucide-react";
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

/** Shared document section for all record types */
function DocumentSection({ url, label }: { url: string | null | undefined; label: string }) {
  return (
    <div className="col-span-2 mt-2 pt-4 border-t border-border/60">
      <div className="label-caps mb-2">Supporting Documents</div>
      {url ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{label}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 px-2.5" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2.5" asChild>
              <a href={url} download rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-1" />
                Download
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/30">
          <FileX className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground italic">No supporting documents</p>
        </div>
      )}
    </div>
  );
}

function CalibrationDetail({ data }: { data: EquipmentCalibration }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DetailRow label="Calibration Date">{fmtDate(data.calibration_date)}</DetailRow>
      <DetailRow label="Managed By">{employeeLabel(data.calibration_managed_by)}</DetailRow>
      <DetailRow label="Lab Name">{data.lab_name}</DetailRow>
      <DetailRow label="Lab Address">{data.lab_address}</DetailRow>
      <DetailRow label="Next Calibration">{fmtDate(data.next_calibration_date)}</DetailRow>
      <DetailRow label="Status">
        {data.calibration_status === "active" ? (
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
      </DetailRow>
      <DocumentSection url={data.calibration_report_url} label="Calibration Report" />
    </div>
  );
}

function AdjustmentDetail({ data }: { data: EquipmentAdjustment }) {
  const lower = (data.measurements_after ?? "").toLowerCase();
  const isAccurate = lower === "accurate";
  const isInaccurate = lower === "inaccurate";

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DetailRow label="Adjustment Date">{fmtDate(data.adjustment_date)}</DetailRow>
      <DetailRow label="Managed By">{employeeLabel(data.adjustment_managed_by)}</DetailRow>
      <DetailRow label="Measurement Before">{data.measurements_before ?? "—"}</DetailRow>
      <DetailRow label="Measurement After">
        {isAccurate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {data.measurements_after!.charAt(0).toUpperCase() + data.measurements_after!.slice(1)}
          </span>
        ) : isInaccurate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-950 dark:text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {data.measurements_after!.charAt(0).toUpperCase() + data.measurements_after!.slice(1)}
          </span>
        ) : (
          <span>{data.measurements_after ?? "—"}</span>
        )}
      </DetailRow>
      <DetailRow label="Notes">{data.adjustment_notes}</DetailRow>
      <DetailRow label="Company Name">{data.company_name}</DetailRow>
      <DetailRow label="Company Address">
        <span className="whitespace-pre-wrap">{data.company_address}</span>
      </DetailRow>
      <DocumentSection url={data.evidence_url} label="Adjustment Evidence" />
    </div>
  );
}

function RepairDetail({ data }: { data: EquipmentRepair }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <DetailRow label="Repair Date">{fmtDate(data.repair_date)}</DetailRow>
      <DetailRow label="Repaired By">{employeeLabel(data.repaired_by)}</DetailRow>
      <DetailRow label="Repair Notes">
        <span className="whitespace-pre-wrap">{data.repair_notes}</span>
      </DetailRow>
      <DetailRow label="Test Run">
        {data.test_run === "success" ? (
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
      </DetailRow>
      <DetailRow label="Test Run Notes">
        <span className="whitespace-pre-wrap">{data.test_run_notes || "—"}</span>
      </DetailRow>
      <DetailRow label="Tested By">{employeeLabel(data.tested_by)}</DetailRow>
      <DocumentSection url={data.document_url} label="Repair Document" />
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
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {data.maintenance_types.length > 0
              ? data.maintenance_types.map((t) => {
                  const lower = t.toLowerCase();
                  if (lower === "cleaning") {
                    return (
                      <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        {t}
                      </span>
                    );
                  }
                  if (lower === "oiling") {
                    return (
                      <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {t}
                      </span>
                    );
                  }
                  return (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {t}
                    </span>
                  );
                })
              : "—"}
          </div>
        </DetailRow>
      </div>
      <DocumentSection url={data.document_url} label="Maintenance Document" />
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
