import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/inspection-form/$batchId")({
  component: InspectionFormPage,
  validateSearch: (search: Record<string, unknown>) => ({
    templateId: (search.templateId as string) || undefined,
    view: search.view === "1",
  }),
});

/* ── Types ───────────────────────────────────────────────────── */

interface BatchRow {
  id: string;
  batch_number: string;
  part_id: string;
  quantity: number;
  raw_material_batch_id: string;
  parts: { part_name: string; part_code: string | null } | null;
  raw_materials: {
    id: string;
    batch_number: string;
    material_type: string;
    vendor_id: string;
  } | null;
}

interface TemplateRow {
  id: string;
  part_id: string;
  part_name: string;
  record_id: string;
  tolerance: number;
  field_a: string | null;
  field_b: string | null;
  field_c: string | null;
}

interface EmployeeRow {
  id: string;
  employee_name: string;
  employee_role: string;
}

interface EquipmentRow {
  id: string;
  equipment_id: string;
  name: string;
  equipment_type: string;
  status: string;
}

interface QcRow {
  part_num: number;
  a_actual: number;
  a_measured: number;
  a_difference: number;
  b_actual: number;
  b_measured: number;
  b_difference: number;
  c_actual: number;
  c_measured: number;
  c_difference: number;
  tolerance: number;
  result: string;
}

interface MeasuringEquip {
  name: string;
  id: string;
  calDate: string;
  nextCalDate: string;
  verified: boolean;
}

/* ── Component ───────────────────────────────────────────────── */

function InspectionFormPage() {
  const { batchId } = Route.useParams();
  const { templateId, view } = Route.useSearch() as any;
  const isViewMode = !!view;
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Data Loading ──
  const { data: batch, isLoading: loadingBatch } = useQuery({
    queryKey: ["inspection_batch", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_batches")
        .select("*, raw_materials(*), parts(part_name, part_code)")
        .eq("id", batchId)
        .single();
      if (error) throw error;
      return data as unknown as BatchRow;
    },
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["inspection_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspection_form_templates").select("*");
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_name, employee_role")
        .order("employee_name");
      if (error) throw error;
      return (data ?? []) as EmployeeRow[];
    },
  });

  const { data: equipmentList = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ["equipment_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, equipment_id, name, equipment_type, status")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as EquipmentRow[];
    },
  });

  const { data: calibrations = [] } = useQuery({
    queryKey: ["equipment_calibrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_calibrations")
        .select("equipment_id, calibration_date, next_calibration_date")
        .order("calibration_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        equipment_id: string;
        calibration_date: string;
        next_calibration_date: string | null;
      }[];
    },
  });

  // ── Load existing inspection record ──
  const { data: existingRecord, isLoading: loadingRecord } = useQuery({
    queryKey: ["inspection_record", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_records" as any)
        .select("*")
        .eq("batch_id", batchId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Pick matching template: use templateId from search if provided, else match by part
  const template = useMemo(() => {
    if (templateId) return templates.find((t) => t.id === templateId) ?? null;
    return templates.find((t) => t.part_id === batch?.part_id) ?? templates[0] ?? null;
  }, [templates, batch, templateId]);

  const today = new Date().toISOString().split("T")[0];

  // ── Form State ──
  const [formId, setFormId] = useState("");
  const [inspectionDate, setInspectionDate] = useState(today);

  // Process equipment
  const [processEquipName, setProcessEquipName] = useState("");
  const [processEquipId, setProcessEquipId] = useState("");
  const [processEngineerName, setProcessEngineerName] = useState("");
  const [processEngineerId, setProcessEngineerId] = useState("");
  const [servicingDate, setServicingDate] = useState(today);
  const [servicingDueDate, setServicingDueDate] = useState("");

  // Part details
  const [moldId, setMoldId] = useState("xx001");

  // Equipment parameters
  const [injectionPressure, setInjectionPressure] = useState("");
  const [meltTemp, setMeltTemp] = useState("");
  const [moldTemp, setMoldTemp] = useState("");
  const [clampingForce, setClampingForce] = useState("");
  const [holdingTime, setHoldingTime] = useState("");
  const [screwBarrelSize, setScrewBarrelSize] = useState("");
  const [screenshotAttached, setScreenshotAttached] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);

  // Raw material
  const [masterbatchName, setMasterbatchName] = useState("");
  const [masterbatchBatchId, setMasterbatchBatchId] = useState("");
  const [polymerQty, setPolymerQty] = useState("");
  const [masterbatchQty, setMasterbatchQty] = useState("");
  const [dryingTime, setDryingTime] = useState("");
  const [dryingTemp, setDryingTemp] = useState("");

  // Measuring equipment (2 default rows)
  const [measuringEquip, setMeasuringEquip] = useState<MeasuringEquip[]>([
    { name: "Vernier Calliper", id: "", calDate: "", nextCalDate: "", verified: false },
    { name: "Weighing Scale", id: "", calDate: "", nextCalDate: "", verified: false },
  ]);

  // QC rows
  const [qcRows, setQcRows] = useState<QcRow[]>([]);

  // Signature
  const [sigName, setSigName] = useState("");
  const [sigDate, setSigDate] = useState(today);

  // ── Initialise from existing record or template ──
  useMemo(() => {
    if (qcRows.length > 0) return;

    if (existingRecord) {
      // Load from saved record
      setFormId(existingRecord.form_id ?? "");
      setInspectionDate(existingRecord.inspection_date ?? today);
      setProcessEquipName(existingRecord.process_equipment_name ?? "");
      setProcessEquipId(existingRecord.process_equipment_id ?? "");
      setProcessEngineerName(existingRecord.process_engineer_name ?? "");
      setProcessEngineerId(existingRecord.process_engineer_id ?? "");
      setServicingDate(existingRecord.equipment_servicing_date ?? today);
      setServicingDueDate(existingRecord.equipment_servicing_due_date ?? "");
      setMoldId(existingRecord.mold_id ?? "");
      setInjectionPressure(existingRecord.injection_pressure ?? "");
      setMeltTemp(existingRecord.melt_temperature ?? "");
      setMoldTemp(existingRecord.mold_temperature ?? "");
      setClampingForce(existingRecord.clamping_force ?? "");
      setHoldingTime(existingRecord.holding_time ?? "");
      setScrewBarrelSize(existingRecord.screw_barrel_size ?? "");
      setScreenshotAttached(existingRecord.settings_screenshot_attached ?? false);
      setScreenshotData(existingRecord.settings_screenshot_data ?? null);
      setMasterbatchName(existingRecord.masterbatch_name ?? "");
      setMasterbatchBatchId(existingRecord.masterbatch_batch_id ?? "");
      setPolymerQty(existingRecord.polymer_quantity_kg?.toString() ?? "");
      setMasterbatchQty(existingRecord.masterbatch_quantity_kg?.toString() ?? "");
      setDryingTime(existingRecord.drying_time ?? "");
      setDryingTemp(existingRecord.drying_temperature ?? "");
      setSigName(existingRecord.signature_name ?? "");
      setSigDate(existingRecord.signature_date ?? today);
      // Load QC rows from saved record
      if (existingRecord.qc_rows && Array.isArray(existingRecord.qc_rows)) {
        setQcRows(existingRecord.qc_rows as QcRow[]);
      }
      return;
    }

    // Fresh form from template
    if (!template || !batch) return;
    const numParts = Math.min(batch.quantity ?? 39, 39);
    const tolerance = template.tolerance;
    const rows: QcRow[] = [];
    for (let i = 1; i <= numParts; i++) {
      rows.push({
        part_num: i,
        a_actual: parseFloat(String(template.field_a).replace(/[^0-9.\-]/g, "")) || 0,
        a_measured: 0,
        a_difference: 0,
        b_actual: parseFloat(String(template.field_b).replace(/[^0-9.\-]/g, "")) || 0,
        b_measured: 0,
        b_difference: 0,
        c_actual: parseFloat(String(template.field_c).replace(/[^0-9.\-]/g, "")) || 0,
        c_measured: 0,
        c_difference: 0,
        tolerance,
        result: "Pending",
      });
    }
    setQcRows(rows);
    setFormId(template.record_id);
  }, [existingRecord, template, batch]);

  // Auto-fill polymer quantity + raw material details from batch on first load
  useEffect(() => {
    if (batch && !existingRecord && !polymerQty) {
      if (batch.expected_usage_kg) {
        setPolymerQty(batch.expected_usage_kg.toString());
      }
    }
  }, [batch, existingRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── QC row updates with auto-calc ──
  const updateQcRow = useCallback((idx: number, field: keyof QcRow, value: string) => {
    if (isViewMode) return;
    setQcRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      const num = Number(value) || 0;

      if (field === "a_measured") {
        row.a_measured = num;
        row.a_difference = Math.abs(num - row.a_actual);
      } else if (field === "b_measured") {
        row.b_measured = num;
        row.b_difference = Math.abs(num - row.b_actual);
      } else if (field === "c_measured") {
        row.c_measured = num;
        row.c_difference = Math.abs(num - row.c_actual);
      }

      // Row result
      const tol = row.tolerance;
      row.result =
        row.a_difference <= tol && row.b_difference <= tol && row.c_difference <= tol
          ? "Pass"
          : "Fail";

      next[idx] = row;
      return next;
    });
  }, []);

  const overallResult = useMemo(() => {
    if (qcRows.length === 0) return "Pending";
    return qcRows.every((r) => r.result === "Pass") ? "Pass" : "Fail";
  }, [qcRows]);

  // ── Required fields validation ──
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!processEquipName) errors.push("Process Equipment Name");
    if (!processEngineerName) errors.push("Process Engineer Name");
    if (!injectionPressure) errors.push("Injection Pressure");
    if (!meltTemp) errors.push("Melt Temperature");
    if (!moldTemp) errors.push("Mold Temperature");
    if (!clampingForce) errors.push("Clamping Force");
    if (!holdingTime) errors.push("Holding Time");
    if (!screwBarrelSize) errors.push("Screw Barrel Size");
    if (!masterbatchName) errors.push("Masterbatch Name");
    if (!polymerQty) errors.push("Polymer Quantity");
    if (!masterbatchQty) errors.push("Masterbatch Quantity");
    if (!dryingTime) errors.push("Drying Time");
    if (!dryingTemp) errors.push("Drying Temperature");
    if (!sigName) errors.push("Signature Name");
    // At least one QC row must have measured values
    const hasAnyMeasurement = qcRows.some((r) => r.a_measured || r.b_measured || r.c_measured);
    if (!hasAnyMeasurement) errors.push("At least one QC row measured value");
    return errors;
  }, [
    processEquipName,
    processEngineerName,
    injectionPressure,
    meltTemp,
    moldTemp,
    clampingForce,
    holdingTime,
    screwBarrelSize,
    masterbatchName,
    polymerQty,
    masterbatchQty,
    dryingTime,
    dryingTemp,
    sigName,
    qcRows,
  ]);

  const canSave = validationErrors.length === 0;

  // ── Equipment / employee selectors ──
  const onEquipSelect = (name: string) => {
    setProcessEquipName(name);
    const eq = equipmentList.find((e) => e.name === name);
    setProcessEquipId(eq?.equipment_id ?? "");
  };

  const onEngineerSelect = (name: string) => {
    setProcessEngineerName(name);
    const emp = employees.find((e) => e.employee_name === name);
    setProcessEngineerId(emp?.id ?? "");
  };

  const updateMeasuring = (idx: number, field: keyof MeasuringEquip, value: string | boolean) => {
    setMeasuringEquip((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // ── Save ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!batch || !template) throw new Error("Missing batch or template data");

      const recordData = {
        batch_id: batchId,
        template_id: template.id,
        form_id: formId,
        part_name: batch.parts?.part_name ?? "",
        batch_number: batch.batch_number,
        inspection_date: inspectionDate,
        process_equipment_name: processEquipName || null,
        process_equipment_id: processEquipId || null,
        process_engineer_name: processEngineerName || null,
        process_engineer_id: processEngineerId || null,
        equipment_servicing_date: servicingDate || null,
        equipment_servicing_due_date: servicingDueDate || null,
        part_id: batch.parts?.part_code ?? batch.part_id,
        mold_id: moldId,
        quantity_parts: batch.quantity,
        injection_pressure: injectionPressure || null,
        melt_temperature: meltTemp || null,
        mold_temperature: moldTemp || null,
        clamping_force: clampingForce || null,
        holding_time: holdingTime || null,
        screw_barrel_size: screwBarrelSize || null,
        settings_screenshot_attached: screenshotAttached,
        settings_screenshot_data: screenshotData,
        polymer_name: batch.raw_materials?.material_type ?? null,
        masterbatch_name: masterbatchName || null,
        polymer_batch_id: batch.raw_materials?.batch_number ?? null,
        masterbatch_batch_id: masterbatchBatchId || null,
        polymer_quantity_kg: polymerQty ? Number(polymerQty) : null,
        masterbatch_quantity_kg: masterbatchQty ? Number(masterbatchQty) : null,
        drying_time: dryingTime || null,
        drying_temperature: dryingTemp || null,
        measuring_equipment_name: measuringEquip.map((e) => e.name).join(", ") || null,
        measuring_equipment_id:
          measuringEquip
            .map((e) => e.id)
            .filter(Boolean)
            .join(", ") || null,
        measuring_calibration_date: measuringEquip[0]?.calDate || null,
        measuring_next_calibration_date: measuringEquip[0]?.nextCalDate || null,
        equipment_verified: measuringEquip.every((e) => e.verified),
        qc_rows: qcRows as unknown as Record<string, unknown>[],
        overall_result: overallResult,
        tolerance: template.tolerance,
        signature_name: sigName || null,
        signature_date: sigDate || null,
      };

      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from("inspection_records" as any)
          .update(recordData)
          .eq("id", existingRecord.id);
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase.from("inspection_records" as any).insert(recordData);
        if (error) throw error;
      }

      // Update batch inspection result + block if failed
      const batchUpdate: Record<string, unknown> = { inspection_result: overallResult };
      if (overallResult === "Fail") {
        batchUpdate.is_blocked = true;
      }
      const { error: updateErr } = await supabase
        .from("part_batches")
        .update(batchUpdate as never)
        .eq("id", batchId);
      if (updateErr) console.warn("Failed to update batch result:", updateErr.message);
    },
    onSuccess: () => {
      toast.success(`Inspection record saved — ${overallResult}`, {
        duration: 4000,
      });
      qc.invalidateQueries({ queryKey: ["inspection_records"] });
      qc.invalidateQueries({ queryKey: ["parts"] });
      navigate({ to: "/parts" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save inspection record"),
  });

  // ── Loading state ──
  if (loadingBatch || loadingTemplates || loadingEmployees || loadingEquipment || loadingRecord) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inspection form…
        </div>
      </div>
    );
  }

  if (!batch || !template) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Batch or template not found.</p>
        <Button variant="link" onClick={() => navigate({ to: "/parts" })}>
          Back to Parts
        </Button>
      </div>
    );
  }

  const partName = batch.parts?.part_name ?? "";
  const partCode = batch.parts?.part_code ?? "";
  const polymerName = batch.raw_materials?.material_type ?? "";

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div>
      <PageHeader
        title="Inspection Form"
        description={`${partName} — Batch ${batch.batch_number}`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/parts" })}
            className="text-[13px]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
        }
      />

      <div className="space-y-6">
        {/* ── Header ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Header</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Form ID
                </Label>
                <Input
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Part Name
                </Label>
                <Input value={partName} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Batch Number
                </Label>
                <Input value={batch.batch_number} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </Label>
                <Input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Process Equipment Details ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Process Equipment Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Process Equipment Name
                </Label>
                <select
                  value={processEquipName}
                  onChange={(e) => onEquipSelect(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select equipment…</option>
                  {equipmentList
                    .filter((e) => e.equipment_type === "process")
                    .map((e) => (
                      <option key={e.id} value={e.name}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Process Engineer Name
                </Label>
                <select
                  value={processEngineerName}
                  onChange={(e) => onEngineerSelect(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select engineer…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.employee_name}>
                      {emp.employee_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Process Equipment ID
                </Label>
                <Input value={processEquipId} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Process Engineer ID
                </Label>
                <Input value={processEngineerId} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Equipment Servicing Date
                </Label>
                <Input
                  type="date"
                  value={servicingDate}
                  onChange={(e) => setServicingDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Equipment Servicing Due Date
                </Label>
                <Input
                  type="date"
                  value={servicingDueDate}
                  onChange={(e) => setServicingDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Part Details ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Part Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Part Name
                </Label>
                <Input value={partName} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Part ID
                </Label>
                <Input value={partCode} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Mold ID
                </Label>
                <Input
                  value={moldId}
                  onChange={(e) => setMoldId(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Quantity (Pcs)
                </Label>
                <Input value={batch.quantity} readOnly className="mt-1 bg-muted/50" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Equipment Parameter Settings ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Equipment Parameter Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Injection Pressure (bar)
                </Label>
                <Input
                  value={injectionPressure}
                  onChange={(e) => setInjectionPressure(e.target.value)}
                  placeholder="e.g. 1200"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Melt Temperature (°C)
                </Label>
                <Input
                  value={meltTemp}
                  onChange={(e) => setMeltTemp(e.target.value)}
                  placeholder="e.g. 260"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Mold Temperature (°C)
                </Label>
                <Input
                  value={moldTemp}
                  onChange={(e) => setMoldTemp(e.target.value)}
                  placeholder="e.g. 80"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Clamping Force (kN)
                </Label>
                <Input
                  value={clampingForce}
                  onChange={(e) => setClampingForce(e.target.value)}
                  placeholder="e.g. 250"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Holding Time (Sec)
                </Label>
                <Input
                  value={holdingTime}
                  onChange={(e) => setHoldingTime(e.target.value)}
                  placeholder="e.g. 15"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Screw Barrel Size (mm)
                </Label>
                <Input
                  value={screwBarrelSize}
                  onChange={(e) => setScrewBarrelSize(e.target.value)}
                  placeholder="e.g. 45"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Screenshot Attached?
              </Label>
              <button
                type="button"
                onClick={() => setScreenshotAttached(!screenshotAttached)}
                className={`inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  screenshotAttached ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    screenshotAttached ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm">{screenshotAttached ? "YES" : "NO"}</span>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setScreenshotData(reader.result as string);
                        setScreenshotAttached(true);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Button variant="outline" size="sm" type="button" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5 mr-1" />{" "}
                    {screenshotAttached ? "Change" : "Upload"}
                  </span>
                </Button>
              </label>
              {screenshotData && (
                <img
                  src={screenshotData}
                  alt="Screenshot"
                  className="h-10 w-10 object-cover rounded border"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Raw Material Details ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Raw Material Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Polymer Name
                </Label>
                <Input value={polymerName} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Masterbatch Name
                </Label>
                <Input
                  value={masterbatchName}
                  onChange={(e) => setMasterbatchName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Polymer Batch ID
                </Label>
                <Input
                  value={batch.raw_materials?.batch_number ?? ""}
                  readOnly
                  className="mt-1 bg-muted/50"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Masterbatch Batch ID
                </Label>
                <Input
                  value={masterbatchBatchId}
                  onChange={(e) => setMasterbatchBatchId(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Polymer Quantity (Kg)
                </Label>
                <Input
                  value={polymerQty}
                  onChange={(e) => setPolymerQty(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Masterbatch Quantity (Kg)
                </Label>
                <Input
                  value={masterbatchQty}
                  onChange={(e) => setMasterbatchQty(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Drying Time (Min)
                </Label>
                <Input
                  value={dryingTime}
                  onChange={(e) => setDryingTime(e.target.value)}
                  placeholder="e.g. 120"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Drying Temperature (°C)
                </Label>
                <Input
                  value={dryingTemp}
                  onChange={(e) => setDryingTemp(e.target.value)}
                  placeholder="e.g. 80"
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Measuring Equipment Details ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Measuring Equipment Details</h3>
            <div className="space-y-4">
              {measuringEquip.map((me, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end p-3 rounded-lg bg-muted/30 border border-border/40"
                >
                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Equipment Name
                    </Label>
                    <select
                      value={me.name}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        const eq = equipmentList.find((eq) => eq.name === selectedName);
                        const cal = calibrations.find((c) => c.equipment_id === eq?.id);
                        updateMeasuring(idx, "name", selectedName);
                        updateMeasuring(idx, "id", eq?.equipment_id ?? "");
                        if (cal) {
                          updateMeasuring(idx, "calDate", cal.calibration_date ?? "");
                          updateMeasuring(idx, "nextCalDate", cal.next_calibration_date ?? "");
                        }
                      }}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Select equipment…</option>
                      {equipmentList
                        .filter((eq) => eq.equipment_type === "measuring")
                        .map((eq) => (
                          <option key={eq.id} value={eq.name}>
                            {eq.name} ({eq.equipment_id})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Equipment ID
                    </Label>
                    <Input value={me.id} readOnly className="mt-1 bg-muted/50" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Calibration Date
                    </Label>
                    <Input
                      type="date"
                      value={me.calDate}
                      onChange={(e) => updateMeasuring(idx, "calDate", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Next Calibration
                    </Label>
                    <Input
                      type="date"
                      value={me.nextCalDate}
                      onChange={(e) => updateMeasuring(idx, "nextCalDate", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Verified?
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => updateMeasuring(idx, "verified", !me.verified)}
                        className={`inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          me.verified ? "bg-primary" : "bg-input"
                        }`}
                      >
                        <span
                          className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                            me.verified ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span className="text-sm">{me.verified ? "YES" : "NO"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Quality Control Table ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Quality Control — Dimensional Inspection
            </CardTitle>
            <p className="text-[12px] text-muted-foreground">
              Tolerance: ±{template.tolerance} | Field A: {template.field_a ?? "—"} | Field B:{" "}
              {template.field_b ?? "—"} | Field C: {template.field_c ?? "—"}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 border-b">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center w-[40px]">
                      #
                    </TableHead>
                    <TableHead
                      colSpan={3}
                      className="text-[10px] font-semibold uppercase tracking-wider text-center border-l"
                    >
                      A — {template.field_a ?? "A"}
                    </TableHead>
                    <TableHead
                      colSpan={3}
                      className="text-[10px] font-semibold uppercase tracking-wider text-center border-l"
                    >
                      B — {template.field_b ?? "B"}
                    </TableHead>
                    <TableHead
                      colSpan={3}
                      className="text-[10px] font-semibold uppercase tracking-wider text-center border-l"
                    >
                      C — {template.field_c ?? "C"}
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center border-l w-[70px]">
                      Tol
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center border-l w-[60px]">
                      Result
                    </TableHead>
                  </TableRow>
                  <TableRow className="bg-slate-50/50 border-b">
                    <TableHead className="py-1" />
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center border-l py-1">
                      Measured
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center py-1">
                      Actual
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center py-1">
                      Diff
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center border-l py-1">
                      Measured
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center py-1">
                      Actual
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center py-1">
                      Diff
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center border-l py-1">
                      Measured
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center py-1">
                      Actual
                    </TableHead>
                    <TableHead className="text-[9px] font-semibold uppercase tracking-wider text-center py-1">
                      Diff
                    </TableHead>
                    <TableHead className="py-1" />
                    <TableHead className="py-1" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qcRows.map((row, idx) => (
                    <TableRow key={idx} className="border-b border-border/40">
                      <TableCell className="text-center text-[12px] font-medium text-muted-foreground">
                        {row.part_num}
                      </TableCell>
                      {/* A */}
                      <TableCell className="border-l px-1 py-1">
                        <Input
                          type="number"
                          step="any"
                          value={row.a_measured || ""}
                          onChange={(e) => updateQcRow(idx, "a_measured", e.target.value)}
                          readOnly={isViewMode}
                          className="h-7 text-[12px] text-center w-full"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-center text-[12px] font-mono px-1">
                        {row.a_actual}
                      </TableCell>
                      <TableCell
                        className={`text-center text-[12px] font-mono px-1 ${row.a_difference > row.tolerance ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
                      >
                        {row.a_measured ? row.a_difference.toFixed(2) : "—"}
                      </TableCell>
                      {/* B */}
                      <TableCell className="border-l px-1 py-1">
                        <Input
                          type="number"
                          step="any"
                          value={row.b_measured || ""}
                          onChange={(e) => updateQcRow(idx, "b_measured", e.target.value)}
                          readOnly={isViewMode}
                          className="h-7 text-[12px] text-center w-full"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-center text-[12px] font-mono px-1">
                        {row.b_actual}
                      </TableCell>
                      <TableCell
                        className={`text-center text-[12px] font-mono px-1 ${row.b_difference > row.tolerance ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
                      >
                        {row.b_measured ? row.b_difference.toFixed(2) : "—"}
                      </TableCell>
                      {/* C */}
                      <TableCell className="border-l px-1 py-1">
                        <Input
                          type="number"
                          step="any"
                          value={row.c_measured || ""}
                          onChange={(e) => updateQcRow(idx, "c_measured", e.target.value)}
                          readOnly={isViewMode}
                          className="h-7 text-[12px] text-center w-full"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-center text-[12px] font-mono px-1">
                        {row.c_actual}
                      </TableCell>
                      <TableCell
                        className={`text-center text-[12px] font-mono px-1 ${row.c_difference > row.tolerance ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
                      >
                        {row.c_measured ? row.c_difference.toFixed(2) : "—"}
                      </TableCell>
                      {/* Tolerance & Result */}
                      <TableCell className="text-center text-[12px] font-mono border-l px-1">
                        ±{row.tolerance}
                      </TableCell>
                      <TableCell className="text-center border-l px-1">
                        {row.a_measured || row.b_measured || row.c_measured ? (
                          row.result === "Pass" ? (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-50 text-emerald-700 text-[10px]"
                            >
                              Pass
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-red-50 text-red-700 text-[10px]"
                            >
                              Fail
                            </Badge>
                          )
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Overall Result */}
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/20">
              <span className="text-[13px] font-semibold">Overall Result:</span>
              {overallResult === "Pass" ? (
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-800 text-sm px-3 py-1"
                >
                  Pass
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-100 text-red-800 text-sm px-3 py-1">
                  Fail
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Signature ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Signature</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Name
                </Label>
                <Input
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  placeholder="Inspector name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </Label>
                <Input
                  type="date"
                  value={sigDate}
                  onChange={(e) => setSigDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Signature
                </Label>
                <div className="mt-1 h-9 border border-dashed rounded-md flex items-center justify-center text-muted-foreground text-xs">
                  Sign here
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Save ── */}
        {!isViewMode && (
          <div className="space-y-3 pb-8">
            {!canSave && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[12px] font-medium text-amber-800 mb-1">
                  Missing required fields:
                </p>
                <div className="flex flex-wrap gap-1">
                  {validationErrors.map((field) => (
                    <span
                      key={field}
                      className="inline-block text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={() => {
                  if (!canSave) {
                    toast.error(`Please fill all required fields: ${validationErrors.join(", ")}`);
                    return;
                  }
                  saveMutation.mutate();
                }}
                disabled={saveMutation.isPending || !canSave}
                className="min-w-[160px]"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Inspection Record
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
