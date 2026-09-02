import { useQuery } from "@tanstack/react-query";
import { Download, Package, Puzzle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MaterialBadge } from "@/components/inventory/material-badge";
import { fmtDate, fmtKg, fmtNum } from "@/lib/inventory/format";
import { downloadPartPdf, downloadRawMaterialPdf } from "@/lib/trace-pdfs";

/* ── Trace node detail dialogs ─────────────────────────────── */

type RawDetailRow = {
  id: string;
  batch_number: string;
  material_type: string | null;
  vendor_id: string;
  initial_quantity_kg: number | null;
  remaining_quantity_kg: number | null;
  coa_number: string | null;
  po_number: string | null;
  invoice_number: string | null;
  coa_documents: string | null;
  po_documents: string | null;
  invoice_documents: string | null;
  vendors?: { id: string; name: string; phone: string | null } | null;
};

export async function downloadPartBatchPdf(batchId: string | null) {
  if (!batchId) return;
  const [pbRes, rmRes, inspRes] = await Promise.all([
    supabase.from("part_batches").select("*, parts(id, part_name)").eq("id", batchId).limit(1),
    supabase.rpc("get_part_batch_raw_info", { p_batch_id: batchId }),
    supabase
      .from("inspection_records")
      .select("form_id, overall_result, inspection_date, qc_rows")
      .eq("batch_id", batchId)
      .limit(1),
  ]);
  const pb = ((pbRes.data as unknown as PartBatchRow[]) ?? [])[0] ?? null;
  const rawInfo =
    (rmRes.data as unknown as { raw_material?: string | null; masterbatch?: string | null }) ??
    null;
  const insp =
    (
      ((inspRes.data as unknown) ?? []) as {
        form_id?: string | null;
        overall_result?: string | null;
        inspection_date?: string | null;
        qc_rows?: unknown;
      }[]
    )[0] ?? null;
  if (!pb) return;
  downloadPartPdf({
    batch_number: pb.batch_number,
    part_name: pb.parts?.part_name ?? null,
    quantity: pb.quantity,
    raw_material: rawInfo?.raw_material ?? null,
    masterbatch: rawInfo?.masterbatch ?? null,
    created_at: pb.created_at ?? null,
    inspection: insp
      ? {
          form_id: insp.form_id ?? null,
          overall_result: insp.overall_result ?? null,
          inspection_date: insp.inspection_date ?? null,
          qc_rows: insp.qc_rows,
        }
      : null,
  });
}

export async function downloadRawMaterialPdfNow(batchNumber: string | null) {
  if (!batchNumber) return;
  const { data } = await supabase
    .from("raw_materials")
    .select("*, vendors(id, name, phone)")
    .eq("batch_number", batchNumber)
    .limit(1);
  const row = ((data as unknown as RawDetailRow[]) ?? [])[0];
  if (row) downloadRawMaterialPdf(row);
}

/* ── Shared layout pieces ──────────────────────────────────── */

function DetailShell({
  icon: Icon,
  iconClass,
  title,
  sub,
  actions,
  children,
  footer,
}: {
  icon: any;
  iconClass: string;
  title: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg leading-tight">{title}</DialogTitle>
            {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
            {actions && <div className="mt-2">{actions}</div>}
          </div>
        </div>
      </DialogHeader>
      <div className="px-6 pb-2">{children}</div>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </DialogContent>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 min-h-[52px]">
      <div className="label-caps text-[10px] text-muted-foreground">{label}</div>
      <div className="text-[13px] font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}

function ResultBadge({ result }: { result: string | null | undefined }) {
  if (!result) return <span className="text-muted-foreground">—</span>;
  const passed = String(result).toLowerCase().includes("pass");
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {passed ? "✓" : "✕"} {result}
    </span>
  );
}

/* ── Raw material dialog ───────────────────────────────────── */

export function RawMaterialDetailDialog({
  batchNumber,
  onOpenChange,
  navigate,
}: {
  batchNumber: string | null;
  onOpenChange: (o: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { data: row } = useQuery({
    queryKey: ["trace-raw", batchNumber],
    enabled: !!batchNumber,
    queryFn: async () => {
      const { data } = await supabase
        .from("raw_materials")
        .select("*, vendors(id, name, phone)")
        .eq("batch_number", batchNumber!)
        .limit(1);
      return ((data as unknown as RawDetailRow[]) ?? [])[0] ?? null;
    },
  });

  if (!batchNumber) return null;
  return (
    <Dialog open={!!batchNumber} onOpenChange={onOpenChange}>
      <DetailShell
        icon={Package}
        iconClass="bg-sky-100 text-sky-700"
        title={row?.batch_number ?? batchNumber}
        sub={
          row?.material_type ? (
            <span className="inline-flex items-center gap-1.5">
              Raw material
              <MaterialBadge material={row.material_type} />
            </span>
          ) : (
            "Raw material"
          )
        }
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/30 text-primary"
            onClick={() => row && downloadRawMaterialPdf(row)}
            disabled={!row}
          >
            <Download className="h-3.5 w-3.5" /> Download details
          </Button>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/raw-materials", search: { view: row?.batch_number } });
              }}
            >
              Open full view
            </Button>
          </>
        }
      >
        {row ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Field
              label="Remaining"
              value={row.remaining_quantity_kg != null ? fmtKg(row.remaining_quantity_kg) : "—"}
            />
            <Field
              label="Initial"
              value={row.initial_quantity_kg != null ? fmtKg(row.initial_quantity_kg) : "—"}
            />
            <Field label="Vendor" value={row.vendors?.name ?? "—"} />
            <Field label="Phone" value={row.vendors?.phone ?? "—"} />
            <Field label="COA Number" value={row.coa_number ?? "—"} />
            <Field label="PO Number" value={row.po_number ?? "—"} />
            <Field label="Invoice Number" value={row.invoice_number ?? "—"} />
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}
      </DetailShell>
    </Dialog>
  );
}

/* ── Part batch dialog ─────────────────────────────────────── */

type PartBatchRow = {
  id: string;
  batch_number: string;
  part_id: string;
  quantity: number;
  created_at: string;
  parts?: { id: string; part_name: string | null } | null;
  raw_material_batch_id: string;
  raw_materials?: { id: string; batch_number: string } | null;
};

export function PartBatchViewDialog({
  batchId,
  onOpenChange,
}: {
  batchId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: row } = useQuery({
    queryKey: ["trace-part", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const [pbRes, rmRes, inspRes] = await Promise.all([
        supabase.from("part_batches").select("*, parts(id, part_name)").eq("id", batchId!).limit(1),
        supabase.rpc("get_part_batch_raw_info", { p_batch_id: batchId }),
        supabase
          .from("inspection_records")
          .select("form_id, overall_result, inspection_date, qc_rows")
          .eq("batch_id", batchId!)
          .limit(1),
      ]);
      const pb = ((pbRes.data as unknown as PartBatchRow[]) ?? [])[0] ?? null;
      const rawInfo =
        (rmRes.data as unknown as { raw_material?: string | null; masterbatch?: string | null }) ??
        null;
      const insp =
        (inspRes.data as unknown as
          | {
              form_id?: string | null;
              overall_result?: string | null;
              inspection_date?: string | null;
              qc_rows?: unknown;
            }
          | null[]) ?? [];
      return { pb, rawInfo, insp: insp[0] ?? null };
    },
  });

  const download = () => {
    if (!row?.pb) return;
    downloadPartPdf({
      batch_number: row.pb.batch_number,
      part_name: row.pb.parts?.part_name ?? null,
      quantity: row.pb.quantity,
      raw_material: row.rawInfo?.raw_material ?? null,
      masterbatch: row.rawInfo?.masterbatch ?? null,
      created_at: row.pb.created_at ?? null,
      inspection: row.insp
        ? {
            form_id: row.insp.form_id ?? null,
            overall_result: row.insp.overall_result ?? null,
            inspection_date: row.insp.inspection_date ?? null,
            qc_rows: row.insp.qc_rows,
          }
        : null,
    });
  };

  if (!batchId) return null;
  return (
    <Dialog open={!!batchId} onOpenChange={onOpenChange}>
      <DetailShell
        icon={Puzzle}
        iconClass="bg-indigo-100 text-indigo-700"
        title={row?.pb?.batch_number ?? ""}
        sub={
          <span className="flex items-center gap-2">
            <span>{row?.pb?.parts?.part_name ?? "Part batch"}</span>
            <span className="text-muted-foreground">· {fmtDate(row?.pb?.created_at)}</span>
          </span>
        }
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/30 text-primary"
            onClick={download}
            disabled={!row?.pb}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        }
        footer={
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        }
      >
        {row ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Part" value={row.pb?.parts?.part_name ?? "—"} />
              <Field label="Qty" value={row.pb?.quantity != null ? fmtNum(row.pb.quantity) : "—"} />
              <Field label="Raw material" value={row.rawInfo?.raw_material ?? "—"} />
              <Field label="Masterbatch" value={row.rawInfo?.masterbatch ?? "—"} />
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="label-caps text-[10px] text-muted-foreground">Inspection result</div>
              <div className="mt-1 flex items-center gap-2">
                <ResultBadge result={row.insp?.overall_result} />
                {row.insp?.form_id && (
                  <span className="text-[11px] text-muted-foreground">
                    {row.insp.form_id} · {fmtDate(row.insp.inspection_date)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}
      </DetailShell>
    </Dialog>
  );
}

/* ── Vendor dialog ─────────────────────────────────────────── */

type VendorRow = { id: string; name: string; phone: string | null; address: string | null };

export function VendorViewDialog({
  vendorName,
  onOpenChange,
}: {
  vendorName: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: vendor } = useQuery({
    queryKey: ["trace-vendor", vendorName],
    enabled: !!vendorName,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, name, phone, address")
        .eq("name", vendorName!)
        .limit(1);
      return ((data as unknown as VendorRow[]) ?? [])[0] ?? null;
    },
  });

  if (!vendorName) return null;
  return (
    <Dialog open={!!vendorName} onOpenChange={onOpenChange}>
      <DetailShell
        icon={Users as any}
        iconClass="bg-violet-100 text-violet-700"
        title={vendor?.name ?? vendorName}
        sub="Vendor"
        footer={
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        }
      >
        {vendor ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Phone" value={vendor.phone ?? "—"} />
            <div className="col-span-2">
              <Field label="Address" value={vendor.address ?? "—"} />
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}
      </DetailShell>
    </Dialog>
  );
}
