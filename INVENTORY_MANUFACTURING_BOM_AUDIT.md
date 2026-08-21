# Safey-QMS — Inventory, Manufacturing & BOM Feature Audit

> Deep audit of ALL features related to Inventory, Manufacturing, and Bill of Materials.
> Excludes: Equipment, HR/Employees, Training, QMS/Inspection (except where they intersect with inventory/manufacturing).

---

## 1. DATABASE SCHEMA

### 1.1 `vendors` (src/integrations/supabase/types.ts:27-56, migration:20260707142138 L6-21)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `name` | TEXT | NOT NULL |
| `phone` | TEXT | NOT NULL |
| `address` | TEXT | NOT NULL |
| `materials_supplied` | TEXT[] | NOT NULL DEFAULT `{}` |
| `notes` | TEXT | nullable |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

### 1.2 `raw_materials` (src/integrations/supabase/types.ts:57-96, migration:20260707142138 L22-44)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `material_type` | TEXT | NOT NULL (was CHECK IN ('PC','POM','PP','TPE'), now free-form per migration 20260708170000) |
| `vendor_id` | UUID FK→vendors | NOT NULL, ON DELETE RESTRICT |
| `batch_number` | TEXT | NOT NULL, UNIQUE |
| `initial_quantity_kg` | NUMERIC(10,3) | NOT NULL CHECK > 0 |
| `remaining_quantity_kg` | NUMERIC(10,3) | NOT NULL CHECK ≥ 0 |
| `rate_per_kg` | NUMERIC(10,2) | NOT NULL CHECK ≥ 0 |
| `total_cost` | NUMERIC(14,2) | GENERATED ALWAYS AS (initial_quantity_kg * rate_per_kg) STORED |
| `purchase_date` | DATE | DEFAULT CURRENT_DATE |
| `notes` | TEXT | nullable |
| `is_blocked` | BOOLEAN | NOT NULL DEFAULT false |
| `coa_number` | TEXT | nullable (migration 20260726000002) |
| `po_number` | TEXT | nullable (migration 20260726000002) |
| `invoice_number` | TEXT | nullable (migration 20260726000002) |
| `coa_documents` | JSONB | nullable (migration 20260726000002) |
| `po_documents` | JSONB | nullable (migration 20260726000002) |
| `invoice_documents` | JSONB | nullable (migration 20260726000002) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_raw_materials_batch`, `idx_raw_materials_vendor`, `idx_raw_materials_type`, `idx_raw_materials_type_blocked`, `idx_raw_materials_purchase_date`, `idx_raw_materials_blocked`

### 1.3 `parts` (src/integrations/supabase/types.ts:97-119, migration:20260707142138 L45-60)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `part_name` | TEXT | NOT NULL, UNIQUE (case-insensitive via idx_parts_part_name_lower) |
| `part_code` | TEXT | nullable (migration 20260726000004) |
| `material_type` | TEXT | NOT NULL (was CHECK, now free-form) |
| `consumption_per_unit_kg` | NUMERIC(10,4) | NOT NULL CHECK > 0 |
| `current_stock` | NUMERIC(12,3) | NOT NULL DEFAULT 0 CHECK ≥ 0 |
| `low_stock_threshold` | NUMERIC(12,3) | NOT NULL DEFAULT 100 |
| `notes` | TEXT | nullable |
| `masterbatch_id` | UUID FK→raw_materials | nullable (migration 20260810000001) |
| `masterbatch_qty_kg` | NUMERIC(10,3) | DEFAULT 0 (migration 20260810000001) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

### 1.4 `part_batches` (src/integrations/supabase/types.ts:120-137, migration:20260707142138 L61-81)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `batch_number` | TEXT | NOT NULL, UNIQUE |
| `part_id` | UUID FK→parts | NOT NULL, ON DELETE RESTRICT |
| `quantity` | NUMERIC(12,3) | NOT NULL CHECK ≥ 0 (was CHECK > 0, fixed in 20260709180000) |
| `raw_material_batch_id` | UUID FK→raw_materials | NOT NULL, ON DELETE RESTRICT |
| `expected_usage_kg` | NUMERIC(10,3) | NOT NULL |
| `actual_usage_kg` | NUMERIC(10,3) | NOT NULL CHECK ≥ 0 |
| `wastage_kg` | NUMERIC(10,3) | GENERATED ALWAYS AS (actual_usage_kg - expected_usage_kg) STORED |
| `wastage_reason` | TEXT | NOT NULL CHECK IN ('machine_issue','operator_error','material_defect','setup_loss','other') |
| `wastage_notes` | TEXT | nullable |
| `is_blocked` | BOOLEAN | NOT NULL DEFAULT false |
| `inspection_result` | TEXT | nullable (migration 20260726000005) |
| `inspection_form_id` | UUID FK→inspection_form_templates | nullable (migration 20260726000005) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_part_batches_part`, `idx_part_batches_rm_batch`, `idx_part_batches_created_at`

### 1.5 `products` (src/integrations/supabase/types.ts:138-166, migration:20260707142138 L82-93)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `product_name` | TEXT | NOT NULL, UNIQUE |
| `product_code` | TEXT | UNIQUE, nullable |
| `description` | TEXT | nullable |
| `gtin` | TEXT | nullable (migration 20260803000001) |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

### 1.6 `product_bom` (src/integrations/supabase/types.ts:167-174, migration:20260707142138 L95-107)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `product_id` | UUID FK→products | NOT NULL, ON DELETE CASCADE |
| `part_id` | UUID FK→parts | NOT NULL, ON DELETE RESTRICT |
| `quantity_required` | INTEGER | NOT NULL CHECK > 0 |

**Unique constraint:** `UNIQUE(product_id, part_id)`
**Index:** `idx_bom_product`

### 1.7 `production_batches` (src/integrations/supabase/types.ts:175-193, migration:20260707142138 L108-129)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `batch_number` | TEXT | NOT NULL, UNIQUE |
| `product_id` | UUID FK→products | NOT NULL, ON DELETE RESTRICT |
| `quantity_produced` | INTEGER | NOT NULL CHECK > 0 |
| `expected_raw_material_kg` | NUMERIC(10,3) | NOT NULL |
| `actual_raw_material_kg` | NUMERIC(10,3) | NOT NULL CHECK ≥ 0 |
| `wastage_kg` | NUMERIC(10,3) | GENERATED ALWAYS AS (actual_raw_material_kg - expected_raw_material_kg) STORED |
| `wastage_reason` | TEXT | nullable, CHECK IN ('machine_issue','operator_error','material_defect','setup_loss','other') |
| `wastage_notes` | TEXT | nullable |
| `extra_raw_material_batch_id` | UUID FK→raw_materials | nullable, ON DELETE RESTRICT |
| `production_date` | DATE | DEFAULT CURRENT_DATE |
| `status` | TEXT | NOT NULL DEFAULT 'completed' CHECK IN ('in_progress','completed','recalled') |
| `notes` | TEXT | nullable |
| `assigned_employee` | TEXT | nullable (migration 20260725000002) |
| `process_equipment_id` | UUID FK→equipment | nullable (migration 20260725000002) |
| `measuring_equipment_id` | UUID FK→equipment | nullable (migration 20260725000002) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_production_product`, `idx_production_date`, `idx_production_batches_status`, `idx_production_batches_created_at`

### 1.8 `production_batch_parts` (src/integrations/supabase/types.ts:194-201, migration:20260707142138 L131-143)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `production_batch_id` | UUID FK→production_batches | NOT NULL, ON DELETE CASCADE |
| `part_batch_id` | UUID FK→part_batches | NOT NULL, ON DELETE RESTRICT |
| `quantity_used` | NUMERIC(12,3) | NOT NULL CHECK > 0 |

**Unique constraint:** `UNIQUE(production_batch_id, part_batch_id)`
**Indexes:** `idx_pbp_production`, `idx_pbp_part`

### 1.9 `wastage_logs` (src/integrations/supabase/types.ts:202-216, migration:20260707142138 L145-165)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `level` | TEXT | NOT NULL CHECK IN ('part','product') |
| `reference_id` | UUID | NOT NULL |
| `level_name` | TEXT | NOT NULL |
| `expected_kg` | NUMERIC(10,3) | NOT NULL |
| `actual_kg` | NUMERIC(10,3) | NOT NULL |
| `wastage_kg` | NUMERIC(10,3) | NOT NULL |
| `wastage_percentage` | NUMERIC(8,2) | GENERATED ALWAYS AS (wastage_kg/expected_kg*100) STORED |
| `reason` | TEXT | NOT NULL |
| `notes` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_wastage_level`, `idx_wastage_created`, `idx_wastage_logs_level_ref`, `idx_wastage_logs_created_at`

### 1.10 `alerts` (src/integrations/supabase/types.ts:217-228, migration:20260707142138 L167-181)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `alert_type` | TEXT | NOT NULL CHECK IN ('low_stock_raw','low_stock_part','high_wastage_part','high_wastage_product','shortage_planned','info') |
| `severity` | TEXT | NOT NULL CHECK IN ('info','warning','critical') |
| `title` | TEXT | NOT NULL |
| `message` | TEXT | NOT NULL |
| `reference_id` | UUID | nullable |
| `is_read` | BOOLEAN | NOT NULL DEFAULT false |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Index:** `idx_alerts_unread`

### 1.11 `production_plans` (src/integrations/supabase/types.ts:229-241, migration:20260707142138 L183-197)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `plan_number` | TEXT | NOT NULL, UNIQUE |
| `product_id` | UUID FK→products | NOT NULL |
| `planned_quantity` | INTEGER | NOT NULL CHECK > 0 |
| `planned_date` | DATE | NOT NULL |
| `required_parts` | JSONB | NOT NULL |
| `required_raw_materials` | JSONB | NOT NULL |
| `status` | TEXT | NOT NULL DEFAULT 'planned' CHECK IN ('planned','in_progress','completed','cancelled') |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_production_plans_product_date`, `idx_production_plans_created_at`

### 1.12 `other_items` (migration:20260708170000 L149-163)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `name` | TEXT | NOT NULL |
| `category` | TEXT | NOT NULL |
| `unit` | TEXT | NOT NULL DEFAULT 'pcs' |
| `current_stock` | NUMERIC | NOT NULL DEFAULT 0 CHECK ≥ 0 |
| `low_stock_threshold` | NUMERIC | NOT NULL DEFAULT 0 CHECK ≥ 0 |
| `notes` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_other_items_category`, `idx_other_items_name`

### 1.13 `app_settings` (migration:20260707142138 L199-211)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER PK | CHECK (id = 1) — singleton |
| `factory_name` | TEXT | NOT NULL DEFAULT 'My Factory' |
| `currency_symbol` | TEXT | NOT NULL DEFAULT '₹' |
| `wastage_alert_threshold` | NUMERIC(5,2) | NOT NULL DEFAULT 10 |
| `low_stock_raw_threshold` | NUMERIC(10,2) | NOT NULL DEFAULT 50 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

### 1.14 `product_inspection_forms` (migration:20260728000004)

| Column | Type | Constraints |
|--------|------|-------------|
| `product_id` | UUID FK→products | NOT NULL, ON DELETE CASCADE |
| `template_id` | UUID FK→inspection_form_templates | NOT NULL, ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**Primary key:** `PRIMARY KEY (product_id, template_id)`

---

## 2. RELATIONSHIPS (Entity Relationships)

```
vendors 1──N raw_materials        (vendor_id FK)
raw_materials 1──N part_batches   (raw_material_batch_id FK)
parts 1──N part_batches           (part_id FK)
parts 1──N product_bom            (part_id FK)
products 1──N product_bom         (product_id FK, CASCADE DELETE)
products 1──N production_batches  (product_id FK)
products 1──N production_plans    (product_id FK)
production_batches 1──N production_batch_parts (production_batch_id FK, CASCADE DELETE)
part_batches 1──N production_batch_parts (part_batch_id FK)
products M──N inspection_form_templates (via product_inspection_forms)
parts M──1 raw_materials (masterbatch_id FK, nullable)
```

---

## 3. TRIGGERS (Database-Level Business Logic)

### 3.1 `raw_material_gen_batch_number` (BEFORE INSERT on raw_materials)
- **File:** migration:20260707142138 L247-262, updated in migration:20260708170000 L105-131
- Auto-generates `batch_number` as `{MATERIAL_TYPE}-NNN` (e.g. `PC-001`)
- Sets `remaining_quantity_kg = initial_quantity_kg` if null
- Uses `pg_advisory_xact_lock` for concurrency-safe sequence

### 3.2 `part_batch_gen_batch_number` (BEFORE INSERT on part_batches)
- **File:** migration:20260707142138 L265-278, updated in migration:20260726000005 L1-28, updated in migration:20260810000000
- Auto-generates `batch_number` from `part_code` (e.g. `BACK-B001`) or derives from `part_name`
- Falls back to `part_id` hex chars, then `PART`

### 3.3 `production_batch_gen_batch_number` (BEFORE INSERT on production_batches)
- **File:** migration:20260707142138 L281-292
- Auto-generates `batch_number` as `B{NNN}` (e.g. `B001`)

### 3.4 `production_plan_gen_number` (BEFORE INSERT on production_plans)
- **File:** migration:20260707142138 L295-307
- Auto-generates `plan_number` as `PLAN-YYYYMMDD-NNN`

### 3.5 `part_batch_after_insert` (AFTER INSERT on part_batches) ⭐ KEY
- **File:** migration:20260707142138 L313-361
- **Deducts** `remaining_quantity_kg` from the source raw_materials batch
- **Adds** quantity to `parts.current_stock`
- **Creates** `wastage_logs` entry at level='part'
- **Alert:** If wastage % > `wastage_alert_threshold` from app_settings → `high_wastage_part` alert
- **Alert:** If remaining RM < 50 kg → `low_stock_raw` alert

### 3.6 `production_batch_part_after_insert` (AFTER INSERT on production_batch_parts) ⭐ KEY
- **File:** migration:20260707142138 L367-388
- **Deducts** `quantity_used` from `parts.current_stock`
- **Raises exception** if `current_stock` goes negative (insufficient stock guard)

### 3.7 `production_batch_after_insert` (AFTER INSERT on production_batches) ⭐ KEY
- **File:** migration:20260707142138 L394-447
- **Deducts** `actual_raw_material_kg` from `extra_raw_material_batch_id` if provided
- **Creates** `wastage_logs` entry at level='product'
- **Alert:** If wastage % > threshold → `high_wastage_product` alert
- **Alert:** If RM remaining < 50 → `low_stock_raw` alert

### 3.8 `raw_material_block_cascade` (AFTER UPDATE OF is_blocked on raw_materials) ⭐ KEY
- **File:** migration:20260707142138 L453-482
- When `is_blocked` goes true:
  - **Blocks** all associated `part_batches` (sets `is_blocked = true`)
  - **Recalls** all associated `production_batches` (sets `status = 'recalled'`)
  - **Creates** `info/critical` alert detailing affected counts

### 3.9 `set_updated_at` (BEFORE UPDATE on vendors, raw_materials, parts, other_items, app_settings)
- **File:** migration:20260707142138 L217-224
- Auto-sets `updated_at = now()`

### 3.10 `other_items_low_stock_alert` (AFTER INSERT/UPDATE on other_items)
- **File:** migration:20260708170000 L190-207
- If `current_stock < low_stock_threshold` → inserts `low_stock_raw` alert

---

## 4. RPC FUNCTIONS

### 4.1 `commit_production(UUID, INTEGER, DATE, NUMERIC, NUMERIC, TEXT, JSONB, TEXT, UUID, UUID)`
- **File:** migration:20260725000002 L22-117 (latest version; original: 20260707170000 L10-127; fix: 20260709180000 L49-137)
- **Parameters:** product_id, quantity_produced, production_date, expected_raw_kg, actual_raw_kg, notes, picks (JSONB array), assigned_employee, process_equipment_id, measuring_equipment_id
- **Returns:** JSONB `{ id, batch_number }`
- **Logic:**
  1. Pre-flight check: validates every pick has sufficient remaining (quantity - SUM(used by production_batch_parts))
  2. Raises exception if any batch is blocked or insufficient
  3. Inserts `production_batches` row
  4. Inserts `production_batch_parts` junction rows (trigger handles parts.current_stock deduction)
  5. Does NOT decrement part_batches.quantity (fixed in migration 20260709180000)

### 4.2 `get_part_availability(UUID[])`
- **File:** migration:20260707170000 L133-173
- **Parameters:** array of part UUIDs
- **Returns:** JSONB array of `{ part_id, part_name, available, batches: [{ part_batch_id, batch_number, quantity, remaining, created_at }] }`
- **Logic:** Computes remaining as `quantity - SUM(pbp.quantity_used)` per batch, excluding blocked batches

### 4.3 `get_dashboard_kpis()`
- **File:** migration:20260707150405 L16-42
- Returns aggregated inventory/production KPIs: total raw stock, active batches, parts stock, low stock counts, daily production, unread alerts, etc.

### 4.4 `get_traceability_forward(UUID)`
- **File:** migration:20260707150405 L47-91
- Given a raw_material_id → returns vendor info, part batches, and all downstream production batches

### 4.5 `get_traceability_backward(UUID)`
- **File:** migration:20260707150405 L96-130
- Given a production_batch_id → returns product info, part batches consumed, raw materials, and vendor info

### 4.6 `next_number_for_prefix(TEXT, TEXT, TEXT)`
- **File:** migration:20260707142138 L230-244
- Shared utility: uses `pg_advisory_xact_lock` + MAX(regexp_replace) to generate sequential batch numbers per prefix

---

## 5. EDGE FUNCTIONS

### 5.1 `generate-form-schema` (supabase/functions/generate-form-schema/index.ts)
- **Not directly inventory**, but referenced from BOM page for AI-generated inspection forms
- Uses MiMo LLM to parse .docx text into structured form schemas
- Called from `products-bom.$id.tsx` to fetch inspection templates

---

## 6. UI PAGES / FEATURES

### 6.1 **Vendors** (`/vendors`)
- **File:** `src/routes/_authenticated/vendors.tsx` (603 lines)
- **Features:**
  - List vendors with search (debounced) and material-type filter
  - Add/Edit vendor dialog (react-hook-form + zod validation)
  - Toggle active/inactive (Switch)
  - Delete vendor (alert dialog, blocked by FK if raw materials exist)
  - View vendor detail modal
  - Shows material badges, part counts derived from raw_materials→part_batches
  - Search by name, phone, or material

### 6.2 **Raw Materials** (`/raw-materials`)
- **File:** `src/routes/_authenticated/raw-materials.tsx` (842 lines)
- **Features:**
  - Table listing all raw material batches
  - Filter by material_type, vendor, and blocked status toggle
  - **Add Raw Material** dialog with:
    - Material type (free-text with autocomplete from existing)
    - Vendor selection (dropdown)
    - Initial quantity (kg), rate/kg, purchase date
    - Notes, COA number, PO number, Invoice number
    - Document upload for COA, PO, Invoice (stored as base64 JSONB)
  - Block/Unblock batch (triggers cascade via DB trigger)
  - View detail dialog showing:
    - Initial/remaining quantity with progress bar
    - Usage history (part batches produced from this RM)
    - Wastage logs
  - Inventory value calculation (remaining × rate/kg)
  - Batch number auto-generated by trigger: `{MATERIAL_TYPE}-NNN`

### 6.3 **Parts** (`/parts`)
- **File:** `src/routes/_authenticated/parts.tsx` (770 lines)
- **Features:**
  - Table listing all parts with expandable rows
  - Add/Edit part dialog:
    - Part name, part code, material type
    - Consumption per unit (kg), low stock threshold
    - Raw material batch linking
    - Masterbatch linking (optional)
  - **Produce** button → opens PartProduceDialog (4-step wizard)
  - Expandable rows show `PartBatchesRow`:
    - Lists all part_batches for the part
    - Shows quantity, raw material source, wastage, status
    - Inspection picker (creates inspection records from templates)
  - Stock vs threshold progress bar with color coding
  - Total units in stock summary

### 6.4 **Part Produce Dialog** (`src/components/inventory/part-produce-dialog.tsx`, 324 lines)
- **File:** `src/components/inventory/part-produce-dialog.tsx`
- **4-step wizard:**
  1. **Quantity:** Enter quantity to produce; shows expected RM usage (quantity × consumption_per_unit_kg)
  2. **Source RM Batch:** Select from FIFO-ordered unblocked RM batches with remaining > 0; warns if batch insufficient
  3. **Usage & Wastage:** Enter actual usage (kg), select wastage reason, add notes; computes wastage %
  4. **Review & Confirm:** Summary of all values before submission
- **Business logic:** Inserts into `part_batches` → trigger handles RM deduction, parts stock increment, wastage logging, and alerts

### 6.5 **Products** (`/products`)
- **File:** `src/routes/_authenticated/products.tsx` (240 lines)
- **Features:**
  - Card grid listing all products
  - Add/Edit product dialog (product_name, product_code, description, GTIN)
  - Toggle active/inactive (Switch)
  - Edit BOM button → navigates to `/products-bom/$id`
  - Shows part count and total pieces per unit (sum of quantity_required from BOM)

### 6.6 **BOM Editor** (`/products-bom/$id`)
- **File:** `src/routes/_authenticated/products-bom.$id.tsx` (384 lines)
- **Features:**
  - Split-pane: available parts (left) and BOM (right)
  - Add parts to BOM from available list (filters out already-added)
  - Set `quantity_required` per part (numeric input)
  - Remove parts from BOM
  - **Save BOM:** Deletes all existing BOM rows for product, inserts new set (full replacement)
  - **Inspection Form Selection:**
    - Lists AI-generated inspection form templates
    - Toggle to associate templates with product
    - Saves to `product_inspection_forms` junction table
  - Validation: BOM must have at least one part

### 6.7 **Stock Overview** (`/stock`)
- **File:** `src/routes/_authenticated/stock.tsx` (377 lines)
- **Features:**
  - Unified view across all inventory types: Raw materials, Parts, Products, Other items
  - Filter tabs: All / Raw / Part / Product / Other
  - Search by name or code
  - Status badges: Active, Low, Blocked, OK, Inactive
  - Links to stock history for each item type
  - Summary: total raw kg, part units, low-stock count
  - Color-coded status indicators

### 6.8 **Stock History** (`/stock-history/$type/$id`)
- **File:** `src/routes/_authenticated/stock-history.$type.$id.tsx` (494 lines)
- **Three sub-pages:**
  1. **Raw History:** Shows initial/remaining/utilization/wastage/age stats, part batches produced, vendor info
  2. **Part History:** Shows current stock/threshold/level/total produced/wastage, production batches list
  3. **Product History:** Shows total produced/batches/wastage/recalled, BOM table, production runs list
- Stats computed client-side from queried data

### 6.9 **Production** (`/production`)
- **File:** `src/routes/_authenticated/production.tsx` (341 lines)
- **Features:**
  - Paginated list of production batches (20 per page, cursor-based)
  - Columns: Batch, Product, Quantity, Expected KG, Actual KG, Wastage %, Date, Status, Inspection Result, Action
  - Wastage % highlighted red if > 10%
  - Batch number links to traceability page
  - Inspection form button → opens InspectionFormSelectDialog
  - Inspection result aggregation: ANY fail → Failed, ALL pass → Passed

### 6.10 **New Production Wizard** (`/production-new`)
- **File:** `src/routes/_authenticated/production-new.tsx` (913 lines)
- **7-step wizard:**
  1. **Select product & quantity** — choose active product, enter quantity; calls `get_part_availability` RPC
  2. **Allocate production team** — select role → select employee (from hardcoded mock data)
  3. **Set equipment** — select process and measuring equipment (from equipment table)
  4. **Availability check** — shows required vs available per part; alerts if shortage; can produce parts inline
  5. **Pick part batches** — FIFO auto-allocation or manual allocation of part batches per part
  6. **Date & notes** — production date and notes
  7. **Confirm** — full summary before submission
- **Submission:** Calls `commit_production` RPC with all picks, equipment, and employee assignments
- **Can be launched from Production Planning** with pre-filled product/qty/plan
- Calculates `expectedRawTotal` = Σ(required × consumption_per_unit_kg) across all parts

### 6.11 **Production Planning** (`/production-planning`)
- **File:** `src/routes/_authenticated/production-planning.tsx` (451 lines)
- **Features:**
  - Generate plan: select product, quantity, planned date
  - Calculates part requirements (qty × quantity_required from BOM)
  - Calculates raw material requirements (shortage × consumption_per_unit_kg)
  - Shows readiness status: "Ready to produce" or "Not ready — shopping list"
  - Links to /parts and /raw-materials for procurement
  - Save plan to `production_plans` table
  - Recent plans list with "Execute" button → launches `/production-new` with pre-filled data

### 6.12 **Batch Recall** (`/batch-recall`)
- **File:** `src/routes/_authenticated/batch-recall.tsx` (388 lines)
- **Features:**
  - Select raw material batch to recall
  - Enter recall date and reason
  - **Trace Affected Products:** queries part_batches → production_batch_parts → production_batches to find all downstream impact
  - Shows trace results: affected part batches, production batches, total units
  - **Mark All Affected as Recalled** (requires typing "RECALL" to confirm)
  - **Export CSV** of affected items
  - Recall history: lists all blocked RM batches
  - Triggers the `raw_material_block_cascade` DB trigger

### 6.13 **Other Items** (`/other-items`)
- **File:** `src/routes/_authenticated/other-items.tsx` (352 lines)
- **Features:**
  - CRUD for standalone inventory items (boxes, tapes, consumables)
  - Add/Edit dialog with: name, category (with autocomplete), unit, stock, threshold, notes
  - Delete with confirmation
  - Low stock highlighting
  - Category and low-stock summary

### 6.14 **Alerts** (`/alerts`)
- **File:** `src/routes/_authenticated/alerts.tsx` (165 lines)
- **Features:**
  - List all alerts with severity icons
  - Tabs: All, Unread, Low Stock, High Wastage, Shortage
  - Mark individual / Mark all as read
  - Click-through navigation to relevant pages (raw_materials, parts, production)

### 6.15 **Notification Center** (header component)
- **File:** `src/components/inventory/notification-center.tsx` (156 lines)
- **Features:**
  - Bell icon with unread count badge
  - Popover showing latest 10 alerts
  - Mark individual / Mark all read
  - Auto-refresh every 30 seconds

---

## 7. SHARED LIB / COMPONENTS

| File | Purpose |
|------|---------|
| `src/lib/inventory/format.ts` (93 lines) | `fmtCurrency`, `fmtKg`, `fmtNum`, `fmtDate`, `fmtDateTime`, `timeAgo`, `WASTAGE_REASONS`, `MATERIAL_TYPES`, `materialColorClass` |
| `src/lib/inventory/audit.ts` (3 lines) | Console-only audit log (placeholder) |
| `src/lib/inventory/csv.ts` (28 lines) | `downloadCsv()` utility |
| `src/lib/inventory/employees.ts` (85 lines) | Hardcoded employee/role data for production wizard |
| `src/components/inventory/material-badge.tsx` (16 lines) | Colored badge per material type |
| `src/components/inventory/page-header.tsx` | Page header with title/subtitle/actions |
| `src/components/inventory/empty-state.tsx` | Empty state placeholder |
| `src/components/inventory/skeletons.tsx` | Loading skeleton components |

---

## 8. BUSINESS LOGIC SUMMARY

### 8.1 Inventory Flow
```
Vendor → Raw Material (purchase) → Part Batch (produce) → Production Batch (manufacture) → Product
         ↑ (blocked = recall)         ↑ (blocked = recall)
```

### 8.2 Key Workflows
1. **Raw Material Procurement:** Add vendor → Add raw material batch → auto batch number, COA/PO/Invoice docs
2. **Part Production:** Select part → Produce (4-step) → pick RM batch (FIFO) → enter qty/usage/wastage → triggers: deduct RM, add part stock, log wastage, check alerts
3. **Product BOM Management:** Create product → Edit BOM → add parts with quantities → save (full replacement)
4. **Production Planning:** Select product/qty → calculate BOM requirements → check availability → save plan
5. **Product Manufacturing:** 7-step wizard → select product → team → equipment → availability check → batch allocation → date/notes → confirm → `commit_production` RPC
6. **Batch Recall:** Select RM batch → trace affected → mark recalled → cascade blocks all downstream
7. **Stock Monitoring:** Unified stock view → low stock alerts → wastage threshold alerts

### 8.3 Calculations
- **Expected RM per part batch:** `quantity × consumption_per_unit_kg`
- **Wastage (part):** `actual_usage_kg - expected_usage_kg` (computed column)
- **Wastage %:** `(wastage_kg / expected_kg) × 100`
- **Wastage (product):** `actual_raw_material_kg - expected_raw_material_kg` (computed column)
- **Inventory value:** `remaining_quantity_kg × rate_per_kg`
- **Part available stock:** `SUM(part_batches.quantity) - SUM(production_batch_parts.quantity_used)` (computed by `get_part_availability` RPC)
- **BOM total parts per unit:** `Σ quantity_required` across all BOM rows

### 8.4 Concurrency Safety
- `commit_production` uses pre-flight remaining check to prevent over-consumption
- `pg_advisory_xact_lock` used for batch number generation sequences
- Parts stock deduction happens via DB trigger (atomic), not application code

---

## 9. FILE INDEX

| File Path | Lines | Module |
|-----------|-------|--------|
| `src/routes/_authenticated/vendors.tsx` | 603 | Inventory |
| `src/routes/_authenticated/raw-materials.tsx` | 842 | Inventory |
| `src/routes/_authenticated/parts.tsx` | 770 | Inventory |
| `src/routes/_authenticated/other-items.tsx` | 352 | Inventory |
| `src/routes/_authenticated/stock.tsx` | 377 | Inventory |
| `src/routes/_authenticated/stock-history.$type.$id.tsx` | 494 | Inventory |
| `src/routes/_authenticated/products.tsx` | 240 | BOM |
| `src/routes/_authenticated/products-bom.$id.tsx` | 384 | BOM |
| `src/routes/_authenticated/production.tsx` | 341 | Manufacturing |
| `src/routes/_authenticated/production-new.tsx` | 913 | Manufacturing |
| `src/routes/_authenticated/production-planning.tsx` | 451 | Manufacturing |
| `src/routes/_authenticated/batch-recall.tsx` | 388 | Inventory/Recall |
| `src/routes/_authenticated/alerts.tsx` | 165 | Inventory |
| `src/components/inventory/part-produce-dialog.tsx` | 324 | Inventory |
| `src/components/inventory/material-badge.tsx` | 16 | Shared |
| `src/components/inventory/notification-center.tsx` | 156 | Shared |
| `src/lib/inventory/format.ts` | 93 | Shared |
| `src/lib/inventory/audit.ts` | 3 | Shared |
| `src/lib/inventory/csv.ts` | 28 | Shared |
| `src/lib/inventory/employees.ts` | 85 | Shared |
| `src/integrations/supabase/types.ts` | 700+ | Schema |
| `src/integrations/supabase/database.types.ts` | 56 | Schema |
| `supabase/migrations/20260707142138_*.sql` | 482 | Schema+Triggers |
| `supabase/migrations/20260707150405_*.sql` | 130 | RPCs+Indexes |
| `supabase/migrations/20260707170000_*.sql` | 174 | RPCs |
| `supabase/migrations/20260708170000_*.sql` | 206 | Fixes |
| `supabase/migrations/20260709180000_*.sql` | 137 | RPC fix |
| `supabase/migrations/20260725000002_*.sql` | 122 | Production team |
| `supabase/migrations/20260726000002_*.sql` | 8 | RM docs |
| `supabase/migrations/20260726000005_*.sql` | 32 | Part batch trigger |
| `supabase/migrations/20260728000004_*.sql` | 15 | Product inspection forms |
| `supabase/migrations/20260803000001_*.sql` | 2 | GTIN |
| `supabase/migrations/20260810000001_*.sql` | 4 | Masterbatch |
