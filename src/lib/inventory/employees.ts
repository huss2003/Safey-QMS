// Mock employee data — roles will be provided later
export const EMPLOYEE_ROLES = [
  { value: "operator", label: "Operator" },
  { value: "supervisor", label: "Supervisor" },
  { value: "qc_inspector", label: "QC Inspector" },
  { value: "production_manager", label: "Production Manager" },
  { value: "factory_site_manager", label: "Factory Site Manager" },
  { value: "product_quality_lead", label: "Product Quality Lead" },
  { value: "head_of_sales", label: "Head of Sales" },
  { value: "supplier_and_purchase_management", label: "Supplier and Purchase Management" },
  { value: "injection_moulding_engineer", label: "Injection Moulding Engineer" },
  { value: "production_executive", label: "Production Executive" },
] as const;

export type EmployeeRoleValue = (typeof EMPLOYEE_ROLES)[number]["value"];

export const EMPLOYEES = [
  { value: "deepak_sharma", label: "Deepak Sharma", role: "operator" },
  { value: "rahul_patil", label: "Rahul Patil", role: "operator" },
  { value: "suresh_kumar", label: "Suresh Kumar", role: "supervisor" },
  { value: "anita_joshi", label: "Anita Joshi", role: "qc_inspector" },
  { value: "pooja_deshpande", label: "Pooja Deshpande", role: "qc_inspector" },
  { value: "vikram_singh", label: "Vikram Singh", role: "production_manager" },
] as const;

export type EmployeeValue = (typeof EMPLOYEES)[number]["value"];

export function employeesByRole(role: string) {
  return EMPLOYEES.filter((e) => e.role === role);
}

export function employeeLabel(value: string | null | undefined) {
  return EMPLOYEES.find((e) => e.value === value)?.label ?? value ?? "—";
}

export function roleLabel(value: string | null | undefined) {
  return EMPLOYEE_ROLES.find((r) => r.value === value)?.label ?? value ?? "—";
}

export const TRAINING_PERSONNEL = [
  { value: "CTO", label: "CTO" },
  { value: "Product Quality Lead", label: "Product Quality Lead" },
  { value: "Factory Site Manager", label: "Factory Site Manager" },
  { value: "Head of Sales", label: "Head of Sales" },
  { value: "Production Executive", label: "Production Executive" },
  { value: "Supplier and Purchase Management", label: "Supplier and Purchase Management" },
  { value: "Injection Moulding Engineer", label: "Injection Moulding Engineer" },
] as const;

export type TrainingPersonnelValue = (typeof TRAINING_PERSONNEL)[number]["value"];

export const TRAINING_SCHEDULES = [
  { value: "Every 6 Months", label: "Every 6 Months" },
  { value: "Once a year", label: "Once a year" },
] as const;

export const EQUIPMENT_TYPES = [
  { value: "process", label: "Process" },
  { value: "measuring", label: "Measuring" },
] as const;

export const CALIBRATION_FREQUENCIES = [
  { value: "6_monthly", label: "6 Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

export const MAINTENANCE_TYPES = [
  { value: "oiling", label: "Oiling" },
  { value: "cleaning", label: "Cleaning" },
] as const;

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export const TEST_RUN_OPTIONS = [
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
] as const;

export const MEASUREMENT_AFTER_OPTIONS = [
  { value: "accurate", label: "Accurate" },
  { value: "inaccurate", label: "Inaccurate" },
] as const;
