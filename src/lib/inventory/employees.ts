export const EMPLOYEES = [
  { value: "deepak_sharma", label: "Deepak Sharma" },
  { value: "rahul_patil", label: "Rahul Patil" },
  { value: "anita_joshi", label: "Anita Joshi" },
  { value: "suresh_kumar", label: "Suresh Kumar" },
  { value: "pooja_deshpande", label: "Pooja Deshpande" },
] as const;

export type EmployeeValue = (typeof EMPLOYEES)[number]["value"];

export function employeeLabel(value: string | null | undefined) {
  return EMPLOYEES.find((e) => e.value === value)?.label ?? value ?? "—";
}

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
