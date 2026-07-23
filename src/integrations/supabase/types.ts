// Auto-generated from Safey-QMS schema — do not edit manually

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MaterialType = "PC" | "POM" | "PP" | "TPE";
export type WastageReason =
  | "machine_issue"
  | "operator_error"
  | "material_defect"
  | "setup_loss"
  | "other";
export type BatchStatus = "planned" | "in_progress" | "completed" | "cancelled" | "recalled";
export type WastageLevel = "part" | "product";
export type AlertType =
  | "low_stock_raw"
  | "low_stock_part"
  | "high_wastage_part"
  | "high_wastage_product"
  | "shortage_planned"
  | "info";
export type AlertSeverity = "info" | "warning" | "critical";
export type PlanStatus = "planned" | "in_progress" | "completed" | "cancelled";

export interface Database {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string;
          name: string;
          phone: string;
          address: string;
          materials_supplied: string[];
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          address: string;
          materials_supplied?: string[];
          notes?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          phone?: string;
          address?: string;
          materials_supplied?: string[];
          notes?: string | null;
          is_active?: boolean;
        };
      };
      raw_materials: {
        Row: {
          id: string;
          material_type: MaterialType;
          vendor_id: string;
          batch_number: string;
          initial_quantity_kg: number;
          remaining_quantity_kg: number;
          rate_per_kg: number;
          total_cost: number;
          purchase_date: string;
          notes: string | null;
          is_blocked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          material_type: MaterialType;
          vendor_id: string;
          batch_number?: string;
          initial_quantity_kg: number;
          remaining_quantity_kg?: number;
          rate_per_kg: number;
          purchase_date?: string;
          notes?: string | null;
          is_blocked?: boolean;
        };
      };
      parts: {
        Row: {
          id: string;
          part_name: string;
          material_type: MaterialType;
          consumption_per_unit_kg: number;
          current_stock: number;
          low_stock_threshold: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          part_name: string;
          material_type: MaterialType;
          consumption_per_unit_kg: number;
          current_stock?: number;
          low_stock_threshold?: number;
          notes?: string | null;
        };
      };
      part_batches: {
        Row: {
          id: string;
          batch_number: string;
          part_id: string;
          quantity: number;
          raw_material_batch_id: string;
          expected_usage_kg: number;
          actual_usage_kg: number;
          wastage_kg: number;
          wastage_reason: WastageReason;
          wastage_notes: string | null;
          is_blocked: boolean;
          created_at: string;
          // Joined
          parts?: { part_name: string } | null;
        };
      };
      products: {
        Row: {
          id: string;
          product_name: string;
          product_code: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
      };
      product_bom: {
        Row: {
          id: string;
          product_id: string;
          part_id: string;
          quantity_required: number;
        };
      };
      production_batches: {
        Row: {
          id: string;
          batch_number: string;
          product_id: string;
          quantity_produced: number;
          expected_raw_material_kg: number;
          actual_raw_material_kg: number;
          wastage_kg: number;
          wastage_reason: WastageReason | null;
          wastage_notes: string | null;
          extra_raw_material_batch_id: string | null;
          production_date: string;
          status: BatchStatus;
          notes: string | null;
          created_at: string;
          products?: { product_name: string } | null;
        };
      };
      production_batch_parts: {
        Row: {
          id: string;
          production_batch_id: string;
          part_batch_id: string;
          quantity_used: number;
        };
      };
      wastage_logs: {
        Row: {
          id: string;
          level: WastageLevel;
          reference_id: string;
          level_name: string;
          expected_kg: number;
          actual_kg: number;
          wastage_kg: number;
          wastage_percentage: number;
          reason: string;
          notes: string | null;
          created_at: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          alert_type: AlertType;
          severity: AlertSeverity;
          title: string;
          message: string;
          reference_id: string | null;
          is_read: boolean;
          created_at: string;
        };
      };
      production_plans: {
        Row: {
          id: string;
          plan_number: string;
          product_id: string;
          planned_quantity: number;
          planned_date: string;
          required_parts: Json;
          required_raw_materials: Json;
          status: PlanStatus;
          created_at: string;
        };
      };
      app_settings: {
        Row: {
          id: number;
          factory_name: string;
          currency_symbol: string;
          wastage_alert_threshold: number;
          low_stock_raw_threshold: number;
          updated_at: string;
        };
      };
      other_items: {
        Row: {
          id: string;
          name: string;
          category: string;
          unit: string;
          current_stock: number;
          low_stock_threshold: number;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Functions: {
      get_dashboard_kpis: {
        Args: Record<string, never>;
        Returns: {
          total_raw_stock_kg: number;
          active_raw_batches: number;
          material_types: number;
          total_finished_goods: number;
          total_production_batches: number;
          todays_batches: number;
          todays_units: number;
          todays_wastage_kg: number;
          todays_actual_kg: number;
          vendors_count: number;
          active_products: number;
          parts_stock: number;
          low_stock_parts: number;
          low_stock_raw: number;
          unread_alerts: number;
        };
      };
      trace_batch: {
        Args: { p_kind: string; p_id: string };
        Returns: Json;
      };
      get_stock_overview: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
  };
}
