// Convenience type aliases for Supabase Database types
import type { Database } from "./types";

export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type VendorInsert = Database["public"]["Tables"]["vendors"]["Insert"];
export type RawMaterial = Database["public"]["Tables"]["raw_materials"]["Row"];
export type RawMaterialInsert = Database["public"]["Tables"]["raw_materials"]["Insert"];
export type Part = Database["public"]["Tables"]["parts"]["Row"];
export type PartInsert = Database["public"]["Tables"]["parts"]["Insert"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductBom = Database["public"]["Tables"]["product_bom"]["Row"];
export type ProductionBatch = Database["public"]["Tables"]["production_batches"]["Row"] & {
  assigned_employee?: string | null;
  process_equipment_id?: string | null;
  measuring_equipment_id?: string | null;
};
export type ProductionBatchPart = Database["public"]["Tables"]["production_batch_parts"]["Row"];
export type PartBatch = Database["public"]["Tables"]["part_batches"]["Row"];
export type WastageLog = Database["public"]["Tables"]["wastage_logs"]["Row"];
export type Alert = Database["public"]["Tables"]["alerts"]["Row"];
export type ProductionPlan = Database["public"]["Tables"]["production_plans"]["Row"];
export type OtherItem = Database["public"]["Tables"]["other_items"]["Row"];
export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];
export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type EquipmentInsert = Database["public"]["Tables"]["equipment"]["Insert"];
export type EquipmentCalibration = Database["public"]["Tables"]["equipment_calibrations"]["Row"];
export type EquipmentCalibrationInsert =
  Database["public"]["Tables"]["equipment_calibrations"]["Insert"];
export type EquipmentAdjustment = Database["public"]["Tables"]["equipment_adjustments"]["Row"];
export type EquipmentAdjustmentInsert =
  Database["public"]["Tables"]["equipment_adjustments"]["Insert"];
export type EquipmentRepair = Database["public"]["Tables"]["equipment_repairs"]["Row"];
export type EquipmentRepairInsert = Database["public"]["Tables"]["equipment_repairs"]["Insert"];
export type EquipmentMaintenance = Database["public"]["Tables"]["equipment_maintenance"]["Row"];
export type EquipmentMaintenanceInsert =
  Database["public"]["Tables"]["equipment_maintenance"]["Insert"];
export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];

export type TrainingProgram = Database["public"]["Tables"]["training_programs"]["Row"];
export type TrainingProgramInsert = Database["public"]["Tables"]["training_programs"]["Insert"];

export type {
  MaterialType,
  WastageReason,
  BatchStatus,
  WastageLevel,
  AlertType,
  AlertSeverity,
  PlanStatus,
} from "./types";
