import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { X, Save, Loader2, ChevronDown, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/product-inspection/$productId")({
  component: ProductInspectionPage,
  validateSearch: (search: Record<string, unknown>) => ({
    templateId: (search.templateId as string) || undefined,
    batchId: (search.batchId as string) || undefined,
    inspectionId: (search.inspectionId as string) || undefined,
  }),
});

interface TemplateRow {
  id: string;
  part_name: string;
  record_id: string;
  form_schema: any;
}

interface ProductRow {
  id: string;
  product_name: string;
  product_code: string | null;
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

interface ProductionBatch {
  id: string;
  batch_number: string;
  product_id: string;
  quantity_produced: number;
  status: string;
}

interface ProductInspection {
  id: string;
  product_id: string;
  template_id: string | null;
  form_no: string;
  part_name: string | null;
  date: string | null;
  fcr_var: string | null;
  batch_number: string | null;
  operator_name: string | null;
  operator_id: string | null;
  equipment_name: string | null;
  equipment_id: string | null;
  is_device_validated: boolean | null;
  quantity_of_device_x: number | null;
  device_type: string | null;
  labelled_at_all_sides: boolean | null;
  number_of_conforming_devices: number | null;
  number_of_non_conforming_devices: number | null;
  pull_test: string | null;
  shear_test: string | null;
  weld_seam: string | null;
  drop_test: string | null;
  overall_use_of_job: string | null;
  use_of_job_1: string | null;
  use_of_job_2: string | null;
  eoo_rbi_verification: boolean | null;
  performed_by: string | null;
  signature_date: string | null;
  overall_result: string | null;
}

function ProductInspectionPage() {
  const { productId } = Route.useParams();
  const { templateId, batchId, inspectionId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isViewMode = !!inspectionId;

  // Fetch template
  const { data: template } = useQuery({
    queryKey: ["product_inspection_template", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from("inspection_form_templates")
        .select("id, part_name, record_id, form_schema")
        .eq("id", templateId)
        .single();
      if (error) throw error;
      return data as TemplateRow;
    },
    enabled: !!templateId,
  });

  // Fetch product
  const { data: product } = useQuery({
    queryKey: ["product_inspection_product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, product_code")
        .eq("id", productId)
        .single();
      if (error) throw error;
      return data as ProductRow;
    },
  });

  // Fetch production batch if batchId is provided
  const { data: productionBatch } = useQuery({
    queryKey: ["product_inspection_batch", batchId],
    queryFn: async () => {
      if (!batchId) return null;
      const { data, error } = await supabase
        .from("production_batches")
        .select("id, batch_number, product_id, quantity_produced, status")
        .eq("id", batchId)
        .single();
      if (error) throw error;
      return data as ProductionBatch;
    },
    enabled: !!batchId,
  });

  // Fetch existing inspection if inspectionId is provided
  const { data: existingInspection, isLoading: loadingExisting } = useQuery({
    queryKey: ["product_inspection_existing", inspectionId],
    queryFn: async () => {
      if (!inspectionId) return null;
      const { data, error } = await supabase
        .from("product_inspections" as any)
        .select("*")
        .eq("id", inspectionId)
        .single();
      if (error) throw error;
      return data as ProductInspection;
    },
    enabled: !!inspectionId,
  });

  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery({
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

  // Fetch equipment for dropdown
  const { data: equipmentList = [] } = useQuery({
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

  const today = new Date().toISOString().split("T")[0];

  // Auto-generate form number
  const generateFormNo = useMemo(() => {
    const prefix = template?.record_id || "FORM_PSP_QI";
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    return `${prefix}_${timestamp}`;
  }, [template]);

  // Form state
  const [partName, setPartName] = useState("");
  const [formNo, setFormNo] = useState("");
  const [date, setDate] = useState(today);
  const [fcrVar, setFcrVar] = useState("");
  const [batchNumber, setBatchNumber] = useState("");

  // Operator details
  const [operatorName, setOperatorName] = useState("");
  const [operatorId, setOperatorId] = useState("");

  // Equipment details
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [isDeviceValidated, setIsDeviceValidated] = useState<boolean | null>(null);

  // Part details
  const [quantityOfDeviceX, setQuantityOfDeviceX] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [labelledAtAllSides, setLabelledAtAllSides] = useState<boolean | null>(null);

  // Process details
  const [numberOfConformingDevices, setNumberOfConformingDevices] = useState("");
  const [numberOfNonConformingDevices, setNumberOfNonConformingDevices] = useState("");
  const [pullTest, setPullTest] = useState("");
  const [shearTest, setShearTest] = useState("");
  const [weldSeam, setWeldSeam] = useState("");
  const [dropTest, setDropTest] = useState("");
  const [overallUseOfJob, setOverallUseOfJob] = useState("");
  const [useOfJob1, setUseOfJob1] = useState("");
  const [useOfJob2, setUseOfJob2] = useState("");
  const [eooRbiVerification, setEooRbiVerification] = useState<boolean | null>(null);
  const [performedBy, setPerformedBy] = useState("");
  const [signatureDate, setSignatureDate] = useState(today);

  // Initialize form from template, production batch, or existing inspection
  useMemo(() => {
    if (existingInspection) {
      // Load from existing inspection (view mode)
      setFormNo(existingInspection.form_no);
      setPartName(existingInspection.part_name ?? "");
      setDate(existingInspection.date ?? today);
      setFcrVar(existingInspection.fcr_var ?? "");
      setBatchNumber(existingInspection.batch_number ?? "");
      setOperatorName(existingInspection.operator_name ?? "");
      setOperatorId(existingInspection.operator_id ?? "");
      setEquipmentName(existingInspection.equipment_name ?? "");
      setEquipmentId(existingInspection.equipment_id ?? "");
      setIsDeviceValidated(existingInspection.is_device_validated);
      setQuantityOfDeviceX(existingInspection.quantity_of_device_x?.toString() ?? "");
      setDeviceType(existingInspection.device_type ?? "");
      setLabelledAtAllSides(existingInspection.labelled_at_all_sides);
      setNumberOfConformingDevices(
        existingInspection.number_of_conforming_devices?.toString() ?? "",
      );
      setNumberOfNonConformingDevices(
        existingInspection.number_of_non_conforming_devices?.toString() ?? "",
      );
      setPullTest(existingInspection.pull_test ?? "");
      setShearTest(existingInspection.shear_test ?? "");
      setWeldSeam(existingInspection.weld_seam ?? "");
      setDropTest(existingInspection.drop_test ?? "");
      setOverallUseOfJob(existingInspection.overall_use_of_job ?? "");
      setUseOfJob1(existingInspection.use_of_job_1 ?? "");
      setUseOfJob2(existingInspection.use_of_job_2 ?? "");
      setEooRbiVerification(existingInspection.eoo_rbi_verification);
      setPerformedBy(existingInspection.performed_by ?? "");
      setSignatureDate(existingInspection.signature_date ?? today);
    } else if (template) {
      setFormNo(generateFormNo);
      setPartName(template.part_name);
    }
    if (productionBatch) {
      setBatchNumber(productionBatch.batch_number);
      setQuantityOfDeviceX(productionBatch.quantity_produced.toString());
      setDeviceType(product?.product_name || "");
    }
  }, [template, productionBatch, product, generateFormNo, existingInspection]);

  // Handle operator selection
  const handleOperatorSelect = (name: string) => {
    if (isViewMode) return;
    setOperatorName(name);
    const emp = employees.find((e) => e.employee_name === name);
    if (emp) {
      setOperatorId(emp.id);
    }
  };

  // Handle equipment selection
  const handleEquipmentSelect = (name: string) => {
    if (isViewMode) return;
    setEquipmentName(name);
    const eq = equipmentList.find((e) => e.name === name);
    if (eq) {
      setEquipmentId(eq.equipment_id);
    }
  };

  // Calculate overall result
  const overallResult = useMemo(() => {
    if (numberOfConformingDevices && numberOfNonConformingDevices) {
      const conforming = Number(numberOfConformingDevices) || 0;
      const nonConforming = Number(numberOfNonConformingDevices) || 0;
      if (nonConforming === 0 && conforming > 0) return "Pass";
      if (nonConforming > 0) return "Failed";
    }
    return null;
  }, [numberOfConformingDevices, numberOfNonConformingDevices]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const recordData = {
        product_id: productId,
        template_id: templateId ?? null,
        form_no: formNo,
        part_name: partName || null,
        date,
        fcr_var: fcrVar || null,
        batch_number: batchNumber || null,
        operator_name: operatorName || null,
        operator_id: operatorId || null,
        equipment_name: equipmentName || null,
        equipment_id: equipmentId || null,
        is_device_validated: isDeviceValidated,
        quantity_of_device_x: quantityOfDeviceX ? Number(quantityOfDeviceX) : null,
        device_type: deviceType || null,
        labelled_at_all_sides: labelledAtAllSides,
        number_of_conforming_devices: numberOfConformingDevices
          ? Number(numberOfConformingDevices)
          : null,
        number_of_non_conforming_devices: numberOfNonConformingDevices
          ? Number(numberOfNonConformingDevices)
          : null,
        pull_test: pullTest || null,
        shear_test: shearTest || null,
        weld_seam: weldSeam || null,
        drop_test: dropTest || null,
        overall_use_of_job: overallUseOfJob || null,
        use_of_job_1: useOfJob1 || null,
        use_of_job_2: useOfJob2 || null,
        eoo_rbi_verification: eooRbiVerification,
        performed_by: performedBy || null,
        signature_date: signatureDate,
        overall_result: overallResult,
      };

      const { error } = await supabase.from("product_inspections").insert(recordData as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inspection saved successfully");
      qc.invalidateQueries({ queryKey: ["product_inspections"] });
      navigate({ to: "/production" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save inspection"),
  });

  if (loadingExisting) {
    return (
      <div className="fixed inset-0 bg-[#F8FAFC] z-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A8A]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#F8FAFC] z-50 overflow-auto">
      {/* Header */}
      <div className="bg-[#1E3A8A] text-white p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold">{formNo || "FORM_PSP_QI_10"}</h1>
          <p className="text-sm text-blue-200">{template?.record_id ?? "FORM_PSP_QI_10"}</p>
        </div>
        {isViewMode && (
          <div className="flex items-center gap-2 mr-4">
            <Eye className="h-5 w-5 text-green-400" />
            <span className="text-sm text-green-400 font-medium">VIEW MODE</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => navigate({ to: "/production" })}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Section 1: Header */}
        <Section number={1} title="HEADER">
          <div className="grid grid-cols-2 gap-4">
            <Field label="PART" value={partName} onChange={setPartName} readOnly={isViewMode} />
            <Field label="FORM NO" value={formNo} onChange={setFormNo} readOnly />
            <Field label="DATE" type="date" value={date} onChange={setDate} readOnly={isViewMode} />
            <Field label="FCR VAR" value={fcrVar} onChange={setFcrVar} readOnly={isViewMode} />
            <Field label="BATCH NUMBER" value={batchNumber} onChange={setBatchNumber} readOnly />
          </div>
        </Section>

        {/* Section 2: Operator Details */}
        <Section number={2} title="OPERATOR DETAILS">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                NAME OF OPERATOR
              </Label>
              <div className="relative mt-1">
                <select
                  value={operatorName}
                  onChange={(e) => handleOperatorSelect(e.target.value)}
                  disabled={isViewMode}
                  className="w-full h-10 px-3 pr-8 rounded-md border border-[#CBD5E1] bg-white text-[#0F172A] text-sm focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20 appearance-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select operator...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.employee_name}>
                      {emp.employee_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
              </div>
            </div>
            <Field label="OPERATOR ID" value={operatorId} onChange={setOperatorId} readOnly />
          </div>
        </Section>

        {/* Section 3: Equipment Details */}
        <Section number={3} title="EQUIPMENT DETAILS">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                EQUIPMENT NAME
              </Label>
              <div className="relative mt-1">
                <select
                  value={equipmentName}
                  onChange={(e) => handleEquipmentSelect(e.target.value)}
                  disabled={isViewMode}
                  className="w-full h-10 px-3 pr-8 rounded-md border border-[#CBD5E1] bg-white text-[#0F172A] text-sm focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20 appearance-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select equipment...</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.name}>
                      {eq.name} ({eq.equipment_id})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
              </div>
            </div>
            <Field label="EQUIPMENT ID" value={equipmentId} onChange={setEquipmentId} readOnly />
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                IS DEVICE VALIDATED?
              </Label>
              <div className="flex gap-2 mt-2">
                <ChoiceButton
                  selected={isDeviceValidated === true}
                  onClick={() => !isViewMode && setIsDeviceValidated(true)}
                  label="YES"
                  variant="success"
                  disabled={isViewMode}
                />
                <ChoiceButton
                  selected={isDeviceValidated === false}
                  onClick={() => !isViewMode && setIsDeviceValidated(false)}
                  label="NO"
                  variant="danger"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Section 4: Part Details */}
        <Section number={4} title="PART DETAILS">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="QUANTITY OF DEVICE X (PCS)"
              type="number"
              value={quantityOfDeviceX}
              onChange={setQuantityOfDeviceX}
              readOnly
            />
            <Field label="DEVICE TYPE" value={deviceType} onChange={setDeviceType} readOnly />
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                CHECK IF THE DEVICE HAS BEEN PROPERLY LABELLED AT ALL SIDES
              </Label>
              <div className="flex gap-2 mt-2">
                <ChoiceButton
                  selected={labelledAtAllSides === true}
                  onClick={() => !isViewMode && setLabelledAtAllSides(true)}
                  label="YES"
                  variant="success"
                  disabled={isViewMode}
                />
                <ChoiceButton
                  selected={labelledAtAllSides === false}
                  onClick={() => !isViewMode && setLabelledAtAllSides(false)}
                  label="NO"
                  variant="danger"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Section 5: Process Details */}
        <Section number={5} title="PROCESS DETAILS">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="NUMBER OF CONFORMING DEVICES (PCS)"
              type="number"
              value={numberOfConformingDevices}
              onChange={setNumberOfConformingDevices}
              readOnly={isViewMode}
            />
            <Field
              label="NUMBER OF NON-CONFORMING DEVICES (PCS)"
              type="number"
              value={numberOfNonConformingDevices}
              onChange={setNumberOfNonConformingDevices}
              readOnly={isViewMode}
            />
            <Field
              label="PULL TEST (X 20-100 N TENSILE FORCE) (X)"
              value={pullTest}
              onChange={setPullTest}
              readOnly={isViewMode}
            />
            <Field
              label="SHEAR TEST (X 20-10 N SHEAR FORCE) (X)"
              value={shearTest}
              onChange={setShearTest}
              readOnly={isViewMode}
            />
            <Field
              label="WELD SEAM"
              value={weldSeam}
              onChange={setWeldSeam}
              readOnly={isViewMode}
            />
            <Field
              label="DROP TEST (HEIGHT 1.5 M) (X)"
              value={dropTest}
              onChange={setDropTest}
              readOnly={isViewMode}
            />
            <Field
              label="OVERALL USE OF JOB (YES)"
              value={overallUseOfJob}
              onChange={setOverallUseOfJob}
              readOnly={isViewMode}
            />
            <Field
              label="USE OF JOB (YES)"
              value={useOfJob1}
              onChange={setUseOfJob1}
              readOnly={isViewMode}
            />
            <Field
              label="USE OF JOB (YES)"
              value={useOfJob2}
              onChange={setUseOfJob2}
              readOnly={isViewMode}
            />
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                WERE THE EOQ-RBI VERIFICATION AND VALIDATION RECORDS CHECKED?
              </Label>
              <div className="flex gap-2 mt-2">
                <ChoiceButton
                  selected={eooRbiVerification === true}
                  onClick={() => !isViewMode && setEooRbiVerification(true)}
                  label="YES"
                  variant="success"
                  disabled={isViewMode}
                />
                <ChoiceButton
                  selected={eooRbiVerification === false}
                  onClick={() => !isViewMode && setEooRbiVerification(false)}
                  label="NO"
                  variant="danger"
                  disabled={isViewMode}
                />
              </div>
            </div>
            <div className="col-span-2">
              <Field
                label="SIGNATURE OF FACTORY DATA MEMBER"
                value={performedBy}
                onChange={setPerformedBy}
                readOnly={isViewMode}
              />
            </div>
          </div>
        </Section>

        {/* Overall Result Display */}
        {isViewMode && existingInspection?.overall_result && (
          <div
            className={`rounded-lg p-4 text-center ${existingInspection.overall_result === "Pass" ? "bg-green-100 border border-green-500" : "bg-red-100 border border-red-500"}`}
          >
            <p
              className={`text-lg font-bold ${existingInspection.overall_result === "Pass" ? "text-green-700" : "text-red-700"}`}
            >
              Overall Result: {existingInspection.overall_result}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-[#1E3A8A] rounded-lg p-4 grid grid-cols-3 gap-4">
          <Field
            label="PERFORMED BY"
            value={performedBy}
            onChange={setPerformedBy}
            readOnly={isViewMode}
            className="bg-white/10 border-white/20 text-white"
            labelClassName="text-white/80"
          />
          <Field
            label="SIGNATURES"
            value=""
            onChange={() => {}}
            placeholder="Sign here"
            readOnly={isViewMode}
            className="bg-white/10 border-white/20 text-white"
            labelClassName="text-white/80"
          />
          <Field
            label="DATE"
            type="date"
            value={signatureDate}
            onChange={setSignatureDate}
            readOnly={isViewMode}
            className="bg-white/10 border-white/20 text-white"
            labelClassName="text-white/80"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={() => navigate({ to: "/production" })}>
            Cancel
          </Button>
          {!isViewMode && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-[#1E3A8A] hover:bg-[#1D4ED8] text-white"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable Section component
function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#E0E7FF] border border-[#1E3A8A]/20 rounded-lg overflow-hidden">
      <div className="bg-[#1E3A8A] px-4 py-2 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-white text-[#1E3A8A] text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Reusable Field component
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
  className = "",
  labelClassName = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div>
      <Label
        className={`text-xs font-semibold text-[#64748B] uppercase tracking-wider ${labelClassName}`}
      >
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`mt-1 bg-white border-[#CBD5E1] text-[#0F172A] placeholder-[#94A3B8] focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20 ${readOnly ? "bg-gray-50 cursor-not-allowed" : ""} ${className}`}
      />
    </div>
  );
}

// Reusable ChoiceButton component
function ChoiceButton({
  selected,
  onClick,
  label,
  variant,
  disabled = false,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  variant: "success" | "danger";
  disabled?: boolean;
}) {
  const baseClasses = "px-6 py-2 rounded-md text-sm font-semibold border-2 transition-all";
  const selectedClasses =
    variant === "success"
      ? "bg-[#16A34A] border-[#16A34A] text-white"
      : "bg-[#DC2626] border-[#DC2626] text-white";
  const unselectedClasses = "bg-white border-[#CBD5E1] text-[#0F172A] hover:border-[#1E3A8A]";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${selected ? selectedClasses : unselectedClasses} ${disabledClasses}`}
    >
      {label}
    </button>
  );
}
