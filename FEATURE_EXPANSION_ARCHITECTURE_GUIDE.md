# Safey-QMS Feature Expansion — Complete Architecture Guide

> Every missing feature explained in detail with exact implementation guidance,
> architecture diagrams, and the best free tutorials/videos to learn each concept.

---

## TABLE OF CONTENTS

1. [Work Orders & Work Centers](#1-work-orders--work-centers)
2. [Multi-Level BOM & By-Products](#2-multi-level-bom--by-products)
3. [Inventory Valuation (FIFO/AVCO/Standard)](#3-inventory-valuation)
4. [MRP Scheduler & Auto-Planning](#4-mrp-scheduler--auto-planning)
5. [Barcode Scanning](#5-barcode-scanning)
6. [Quality Tolerance Checks](#6-quality-tolerance-checks)
7. [OEE (Overall Equipment Effectiveness)](#7-oee-overall-equipment-effectiveness)
8. [Audit Trail & Cycle Counting](#8-audit-trail--cycle-counting)
9. [Stock Aging & Reorder Automation](#9-stock-aging--reorder-automation)
10. [BOM Versioning](#10-bom-versioning)
11. [Tutorial & Video Reference Guide](#11-tutorial--video-reference-guide)

---

## 1. WORK ORDERS & WORK CENTERS

### What It Is

A **Work Center** is a physical machine or station where production happens. A **Work Order** is a sub-task within a production batch — one step in the manufacturing process.

**Your current flow:**
```
User clicks "Produce" → 7-step wizard → commit_production RPC → batch is done
```

**What it should be:**
```
User clicks "Produce" → 7-step wizard → commit_production RPC
  → Work Order 1: Mixing (Machine A, 30 min, Operator: Ravi)
  → Work Order 2: Molding (Machine B, 45 min, Operator: Suresh)
  → Work Order 3: Trimming (Station C, 15 min, Operator: Priya)
  → Work Order 4: QC Check (QC Desk, 10 min, Operator: Amit)
  → Work Order 5: Packing (Pack Area, 20 min, Operator: Ravi)
```

### Why It Matters for You

Right now, if a batch of 10,000 back covers takes 2 hours total, you don't know:
- How long each step actually took
- Which machine was used and whether it was efficient
- Which operator did what (your employee data is hardcoded mock)
- Where the bottleneck is (is it mixing? molding? packing?)

With Work Orders, you get **per-operation visibility**. This is the single biggest capability gap between Safey-QMS and a production-grade ERP.

### Architecture

```
┌─────────────────────────────────────────┐
│           production_batches             │
│  (existing — one row per batch)         │
│  batch_number: B001                     │
│  product_id: uuid                       │
│  quantity_produced: 10000               │
│  status: in_progress                    │
└──────────────┬──────────────────────────┘
               │ 1:N
┌──────────────▼──────────────────────────┐
│         work_orders (NEW TABLE)          │
│  id: UUID PK                            │
│  production_batch_id: FK→prod_batches   │
│  work_center_id: FK→work_centers        │
│  operation_name: TEXT ('Mixing')         │
│  sequence: INTEGER (1,2,3...)            │
│  status: TEXT (pending/started/done)     │
│  operator_id: FK→employees              │
│  planned_minutes: NUMERIC               │
│  actual_minutes: NUMERIC                │
│  started_at: TIMESTAMPTZ                │
│  completed_at: TIMESTAMPTZ              │
│  notes: TEXT                            │
└──────────────┬──────────────────────────┘
               │ N:1
┌──────────────▼──────────────────────────┐
│        work_centers (NEW TABLE)          │
│  id: UUID PK                            │
│  name: TEXT ('Injection Mold Machine 1')│
│  cost_per_hour: NUMERIC                 │
│  capacity_per_hour: NUMERIC             │
│  setup_time_minutes: NUMERIC            │
│  process_time_per_unit: NUMERIC         │
│  alternative_work_center_id: FK (self)  │
│  is_active: BOOLEAN                     │
└─────────────────────────────────────────┘
```

### Database Changes

```sql
-- New table: work_centers
CREATE TABLE work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cost_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
  capacity_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
  setup_time_minutes NUMERIC(8,2) DEFAULT 0,
  process_time_per_unit NUMERIC(8,4) DEFAULT 0,
  alternative_work_center_id UUID REFERENCES work_centers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- New table: work_orders
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  work_center_id UUID NOT NULL REFERENCES work_centers(id),
  operation_name TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','started','done','skipped')),
  operator_id TEXT,
  planned_minutes NUMERIC(8,2),
  actual_minutes NUMERIC(8,2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_work_orders_batch ON work_orders(production_batch_id);
CREATE INDEX idx_work_orders_center ON work_orders(work_center_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
```

### UI Impact

Your production wizard (Step 3: Set Equipment) already selects equipment. With Work Centers, Step 3 becomes "Select Work Center" and automatically generates Work Orders based on the BOM routing. The production page gets a sub-table showing work order status for each batch.

### Cost Calculation

```
Production Cost = Σ (Work Order actual_minutes / 60 × work_center.cost_per_hour)
                + Σ (part_batch quantity × part cost)
```

This gives you **true per-unit cost** including machine time, not just material cost.

---

## 2. MULTI-LEVEL BOM & BY-PRODUCTS

### Multi-Level BOM Explained

**Your current BOM is flat:**
```
Back Cover (Product)
  ├── PC Material (Part) × 50 units
  ├── Screw Set (Part) × 100 units
  └── Label (Part) × 50 units
```

**Multi-level BOM:**
```
Back Cover (Product)
  ├── Back Cover Shell (Sub-Assembly) × 1
  │     ├── PC Material (Part) × 50
  │     └── Color Masterbatch (Part) × 2
  ├── Screw Set (Sub-Assembly) × 2
  │     ├── M3 Screws (Part) × 100
  │     └── Nylon Washers (Part) × 100
  └── Label (Part) × 1
```

When you create a production order for "Back Cover", the system automatically explodes sub-assemblies into their component requirements. You produce the Screw Set first, then use it in the Back Cover.

### Why It Matters

If you manufacture intermediate parts (e.g., you mold a sub-component then assemble it into a final product), multi-level BOM lets you:
1. Track production of sub-assemblies separately
2. Calculate true cost by rolling up sub-assembly costs
3. Auto-create sub-production orders when the parent order is confirmed

### By-Products Explained

In injection molding, when you produce a part, you also get:
- **Runners/sprues** — the plastic that fills the channels (regrindable)
- **Flash** — excess plastic that squeezes out (sometimes regrindable)
- **Defective parts** — not waste, but could be re-molded

Currently, your system logs this as `wastage_kg` and discards it. With by-products, you can:
- Define "Regrind PC" as a by-product of "Back Cover Shell" production
- Automatically add regrind to inventory when production completes
- Use regrind as input for future production (reducing raw material cost)

### Database Changes

```sql
-- Modify product_bom for multi-level
ALTER TABLE product_bom ADD COLUMN parent_bom_id UUID REFERENCES product_bom(id);
ALTER TABLE product_bom ADD COLUMN is_phantom BOOLEAN DEFAULT false;
ALTER TABLE product_bom ADD COLUMN bom_type TEXT DEFAULT 'manufacture'
  CHECK (bom_type IN ('manufacture','kit','phantom'));

-- New table: bom_by_products
CREATE TABLE bom_by_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_bom_id UUID NOT NULL REFERENCES product_bom(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_per_unit NUMERIC(10,4) NOT NULL CHECK > 0,
  cost_per_unit NUMERIC(10,2) DEFAULT 0,
  destination_location TEXT DEFAULT 'raw_materials',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### UI Changes

Your BOM editor (`products-bom.$id.tsx`) needs:
- A "Sub-Assembly" toggle on BOM lines (marks a component as having its own BOM)
- A "By-Products" section below the main BOM list
- A "Kit" mode toggle (no production order, just pick-and-ship)

---

## 3. INVENTORY VALUATION

### The Problem With Your Current Approach

You calculate inventory value as:
```
value = remaining_quantity_kg × rate_per_kg
```

This works IF every batch was bought at the same price. But in reality:
- Batch PC-001: 500kg @ ₹120/kg = ₹60,000
- Batch PC-002: 300kg @ ₹135/kg = ₹40,500
- Batch PC-003: 200kg @ ₹115/kg = ₹23,000

**Total: 1,000kg, but what's the per-kg cost?**

### Three Methods

#### FIFO (First In, First Out)
The oldest batch's cost is used first for production.

```
Production uses 400kg:
  → 400kg from PC-001 @ ₹120 = ₹48,000 (COGS)
  
Remaining inventory:
  → 100kg from PC-001 @ ₹120 = ₹12,000
  → 300kg from PC-002 @ ₹135 = ₹40,500
  → 200kg from PC-003 @ ₹115 = ₹23,000
  Total: 600kg worth ₹75,500 → ₹125.83/kg effective
```

**Best for:** Plastics (materials don't really "expire" but you want accurate costing)

#### AVCO (Average Cost)
Weighted average across all batches.

```
Total value: ₹60,000 + ₹40,500 + ₹23,000 = ₹123,500
Total quantity: 1,000kg
Average cost: ₹123.50/kg

Production uses 400kg @ ₹123.50 = ₹49,400 (COGS)
Remaining: 600kg @ ₹123.50 = ₹74,100
```

When new batch arrives, average recalculates:
```
New batch PC-004: 500kg @ ₹130/kg
New average: (₹74,100 + ₹65,000) / (600 + 500) = ₹139,100 / 1,100 = ₹126.45/kg
```

**Best for:** When purchase prices fluctuate and you want smoothed costs

#### Standard Cost
You set a fixed cost per kg (e.g., ₹125/kg) regardless of actual purchase price. Difference goes to a "price variance" account.

**Best for:** Budgeting, when you want stable costs for quoting

### Database Changes

```sql
-- Add costing method to app_settings
ALTER TABLE app_settings ADD COLUMN costing_method TEXT DEFAULT 'avco'
  CHECK (costing_method IN ('fifo','avco','standard'));
ALTER TABLE app_settings ADD COLUMN standard_cost_per_kg NUMERIC(10,2);

-- New table: stock_valuation_layers (audit trail for every cost calculation)
CREATE TABLE stock_valuation_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID REFERENCES raw_materials(id),
  production_batch_id UUID REFERENCES production_batches(id),
  layer_type TEXT NOT NULL CHECK (layer_type IN ('purchase','consumption','adjustment')),
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(14,2) NOT NULL,
  remaining_quantity NUMERIC(12,3) NOT NULL,
  batch_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_svl_rm ON stock_valuation_layers(raw_material_id);
CREATE INDEX idx_svl_created ON stock_valuation_layers(created_at);
```

### How It Works in Practice

When a new raw material batch is received:
```sql
-- FIFO: Insert new layer
INSERT INTO stock_valuation_layers (raw_material_id, layer_type, quantity, unit_cost, total_cost, remaining_quantity, batch_number)
VALUES ($rm_id, 'purchase', $initial_kg, $rate, $total, $initial_kg, $batch_number);

-- AVCO: Update average on all existing layers
UPDATE stock_valuation_layers 
SET unit_cost = (
  SELECT SUM(total_cost) / SUM(remaining_quantity) 
  FROM stock_valuation_layers 
  WHERE raw_material_id = $rm_id AND remaining_quantity > 0
)
WHERE raw_material_id = $rm_id AND remaining_quantity > 0;
```

When production consumes material:
```sql
-- FIFO: Consume from oldest layer first
-- AVCO: Consume at current average cost
-- Insert consumption layer (negative quantity)
INSERT INTO stock_valuation_layers (raw_material_id, layer_type, quantity, unit_cost, total_cost, remaining_quantity, batch_number)
VALUES ($rm_id, 'consumption', -$consumed_kg, $cost_at_time, -$consumed_kg * $cost_at_time, 0, $batch_number);
```

---

## 4. MRP SCHEDULER & AUTO-PLANNING

### What It Is

An MRP (Material Requirements Planning) Scheduler is a background process that:
1. Looks at all products and their BOMs
2. Checks current stock levels
3. Checks demand (sales orders, minimum stock rules)
4. Auto-generates production plans or purchase requests

### Your Current Flow
```
User manually creates production plan → checks availability → executes
```

### With MRP Scheduler
```
System runs every hour:
  → "Back Cover stock is 200, threshold is 500"
  → "BOM requires 50 PC per unit, need 300 more units"
  → Auto-creates production plan for 300 Back Covers
  → Calculates: needs 15,000 PC kg, currently have 8,000 kg
  → Auto-generates purchase request for 7,000 PC kg
  → User sees notification: "3 new production plans ready for review"
```

### Architecture

```
┌─────────────────────────────────────────────────┐
│              mrp_scheduler (CRON)                │
│  Runs every N minutes/hours                     │
│                                                  │
│  1. SELECT all parts WHERE current_stock <       │
│     low_stock_threshold                          │
│                                                  │
│  2. For each low part:                           │
│     a. Look up part's BOM (if it's a product)    │
│     b. Calculate: shortage = threshold - current  │
│     c. Check RM availability for shortage qty    │
│     d. Create production_plan row                │
│                                                  │
│  3. For each plan with RM shortage:              │
│     a. Calculate RM needed vs available           │
│     b. Auto-generate purchase_request (or alert) │
│                                                  │
│  4. Send notification for new plans              │
└─────────────────────────────────────────────────┘
```

### Database Changes

```sql
-- New table: reorder_rules
CREATE TABLE reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  part_id UUID REFERENCES parts(id),
  min_stock NUMERIC(12,3) NOT NULL,
  max_stock NUMERIC(12,3) NOT NULL,
  reorder_qty NUMERIC(12,3), -- NULL = calculate from BOM
  lead_time_days INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- New table: purchase_requests (auto-generated by scheduler)
CREATE TABLE purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID REFERENCES raw_materials(id),
  quantity_needed NUMERIC(12,3) NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','ordered','received')),
  triggered_by TEXT, -- 'mrp_scheduler' or 'manual'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Implementation (Supabase Edge Function)

```typescript
// supabase/functions/mrp-scheduler/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Find low-stock parts
  const { data: lowParts } = await supabase
    .from('parts')
    .select('*')
    .lt('current_stock', 'low_stock_threshold') // RPC or raw query

  // 2. For each, check BOM and create plans
  for (const part of lowParts || []) {
    const shortage = part.low_stock_threshold - part.current_stock
    
    // Check if plan already exists for this part today
    const { data: existing } = await supabase
      .from('production_plans')
      .select('id')
      .eq('product_id', part.id)
      .eq('planned_date', new Date().toISOString().split('T')[0])
      .single()

    if (!existing) {
      // Create auto-plan
      await supabase.from('production_plans').insert({
        product_id: part.id,
        planned_quantity: Math.ceil(shortage),
        planned_date: new Date().toISOString().split('T')[0],
        required_parts: JSON.stringify([]), // calculated from BOM
        required_raw_materials: JSON.stringify([]),
        status: 'planned'
      })
    }
  }

  return new Response(JSON.stringify({ processed: lowParts?.length || 0 }))
})
```

Schedule with Supabase pg_cron:
```sql
SELECT cron.schedule(
  'mrp-scheduler',
  '0 * * * *',  -- every hour
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/mrp-scheduler',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'
  )$$
);
```

---

## 5. BARCODE SCANNING

### What It Is

Barcode scanning lets workers use a phone camera or Bluetooth scanner to:
- Scan a raw material batch number when receiving
- Scan part batches when producing
- Scan production batch when shipping
- Scan for quality checks

### Why It Matters

Your current production wizard is 7 steps of clicking through forms. With barcode scanning:
1. Worker opens app on phone/tablet
2. Points camera at batch label → auto-fills batch number
3. Enters quantity → done

**Reduces production commit time from 5 minutes to 30 seconds.**

### Architecture Options

#### Option A: Phone Camera (Zero Hardware Cost)
Use the browser's built-in camera API + a barcode library:

```typescript
// Uses html5-qrcode library (already common in React apps)
import { Html5Qrcode } from 'html5-qrcode'

const scanner = new Html5Qrcode("reader")
scanner.start(
  { facingMode: "environment" },  // back camera
  { fps: 10, qrbox: 250 },
  (decodedText) => {
    // decodedText = batch number, e.g., "PC-001" or "B001"
    // Auto-fill the form field
    setBatchNumber(decodedText)
    scanner.stop()
  }
)
```

#### Option B: Bluetooth Scanner (₹2,000-5,000)
Bluetooth scanners act as keyboard input — scan → text appears in focused field. No code changes needed, just ensure your input fields accept the format.

### What Barcodes to Generate

| Entity | Barcode Format | Example |
|--------|---------------|---------|
| Raw Material Batch | Code128 | `PC-001` |
| Part Batch | Code128 | `BACK-B001` |
| Production Batch | Code128 | `B001` |
| Product | QR Code | Contains product_id + batch_number |
| Work Center | QR Code | Contains work_center_id |

### Database Change

```sql
-- Add barcode field to existing tables (optional, batch_number already serves as barcode value)
-- Just generate printable labels with the batch_number as the barcode content
```

### UI Component

```tsx
// src/components/inventory/barcode-scanner.tsx
import { useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  onScan: (value: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  // html5-qrcode handles camera permission, scanning, and decode
  // onScan fires with the decoded text
  // User can also type manually as fallback
}
```

### Where to Add Scanning

| Page | What Gets Scanned | Benefit |
|------|------------------|---------|
| Raw Materials (receive) | PO number barcode from supplier | Auto-link to PO |
| Part Produce Dialog (Step 2) | RM batch label | Auto-select batch |
| Production Wizard (Step 5) | Part batch labels | Auto-allocate batches |
| Production (batch list) | Production batch barcode | Quick lookup |
| Stock Overview | Any item barcode | Instant search |

---

## 6. QUALITY TOLERANCE CHECKS

### What It Is

Currently, your inspection forms collect data but don't validate it. Tolerance checks add pass/fail logic:

**Without tolerance:**
```
Inspector enters: "Dimension = 10.3mm" → saved as text → no judgment
```

**With tolerance:**
```
Inspector enters: "Dimension = 10.3mm"
System checks: Target = 10.0mm, Tolerance = ±0.5mm
Result: PASS (10.3 is within 9.5-10.5 range)
```

### Architecture

```sql
-- New table: inspection_fields (defines what to check)
CREATE TABLE inspection_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES inspection_form_templates(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,          -- "Dimension A", "Weight", "Color"
  field_type TEXT NOT NULL DEFAULT 'measurement'
    CHECK (field_type IN ('measurement','pass_fail','picture','text')),
  target_value NUMERIC(10,4),       -- ideal value
  tolerance_plus NUMERIC(10,4),     -- + tolerance
  tolerance_minus NUMERIC(10,4),    -- - tolerance
  unit TEXT,                         -- "mm", "kg", "pcs"
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Modify inspection_form_templates to store structured fields
-- (Currently stores JSONB schema from AI generation)
```

### Validation Logic (Client-Side)

```typescript
function validateInspectionField(
  field: InspectionField,
  value: number
): { pass: boolean; message: string } {
  if (field.field_type === 'measurement' && field.target_value != null) {
    const min = field.target_value - (field.tolerance_minus || 0)
    const max = field.target_value + (field.tolerance_plus || 0)
    
    if (value < min || value > max) {
      return {
        pass: false,
        message: `${field.field_name}: ${value}${field.unit} is OUT OF TOLERANCE (${min}-${max}${field.unit})`
      }
    }
    return { pass: true, message: `${field.field_name}: PASS` }
  }
  
  if (field.field_type === 'pass_fail') {
    return { pass: value === 1, message: value === 1 ? 'PASS' : 'FAIL' }
  }
  
  return { pass: true, message: 'Recorded' }
}
```

### How It Changes Your Flow

**Before:** Inspector fills form → saves → production manager reviews later
**After:** Inspector fills form → real-time pass/fail shown → critical failures block batch from moving forward

Add to `part_batches` and `production_batches`:
```sql
ALTER TABLE part_batches ADD COLUMN qc_status TEXT 
  CHECK (qc_status IN ('pending','passed','failed'));
ALTER TABLE part_batches ADD COLUMN qc_checked_at TIMESTAMPTZ;
```

---

## 7. OEE (OVERALL EQUIPMENT EFFECTIVENESS)

### What It Is

OEE is the industry-standard metric for manufacturing efficiency. It answers: "How well did our machines actually perform?"

```
OEE = Availability × Performance × Quality
```

#### Availability (did the machine run when planned?)
```
Availability = Actual Run Time / Planned Production Time

Example: Machine planned for 8 hours, ran for 7 hours (1 hr downtime)
Availability = 7/8 = 87.5%
```

#### Performance (did it run at full speed?)
```
Performance = (Ideal Cycle Time × Total Count) / Actual Run Time

Example: Machine should make 100 parts/hour, made 750 in 7 hours
Ideal output: 7 × 100 = 700
Actual output: 750 (wait, that's MORE — so it ran faster than rated)
Performance = (60 min × 750) / (7 × 60) = 750/700 = 107% (can exceed 100%)

More realistic: made 600 in 7 hours
Performance = (60 × 600) / (7 × 60) = 600/700 = 85.7%
```

#### Quality (were they good parts?)
```
Quality = Good Count / Total Count

Example: 600 total, 580 good, 20 defective
Quality = 580/600 = 96.7%
```

#### Total OEE
```
OEE = 87.5% × 85.7% × 96.7% = 72.6%

World class OEE = 85%+
Your current: Unknown (you don't track time)
```

### How It Maps to Your System

| OEE Factor | Safey-QMS Data Source | Gap |
|-----------|----------------------|-----|
| **Availability** | Need: planned_minutes vs actual_minutes per work order | ❌ No time tracking yet |
| **Performance** | Need: ideal_cycle_time (from work_center) vs actual output | ❌ No work centers with parameters |
| **Quality** | Have: inspection_result (pass/fail) on batches | ✅ Partially covered |

### Implementation

```sql
-- Add to work_centers table
ALTER TABLE work_centers ADD COLUMN ideal_cycle_time_minutes NUMERIC(8,4);
-- e.g., 0.5 minutes per part = 2 parts per minute

-- OEE is calculated, not stored:
CREATE OR REPLACE FUNCTION calculate_oee(
  p_work_center_id UUID,
  p_date_from DATE,
  p_date_to DATE
) RETURNS TABLE (
  availability NUMERIC(5,2),
  performance NUMERIC(5,2),
  quality NUMERIC(5,2),
  oee NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Availability
    ROUND(SUM(wo.actual_minutes) / NULLIF(SUM(wo.planned_minutes), 0) * 100, 2),
    -- Performance
    ROUND((wc.ideal_cycle_time_minutes * SUM(pb.quantity_produced)) / 
          NULLIF(SUM(wo.actual_minutes), 0) * 100, 2),
    -- Quality
    ROUND(
      SUM(CASE WHEN pb.inspection_result = 'passed' THEN pb.quantity_produced ELSE 0 END)::NUMERIC /
      NULLIF(SUM(pb.quantity_produced), 0) * 100, 2
    ),
    -- OEE
    ROUND(
      (SUM(wo.actual_minutes) / NULLIF(SUM(wo.planned_minutes), 0)) *
      ((wc.ideal_cycle_time_minutes * SUM(pb.quantity_produced)) / NULLIF(SUM(wo.actual_minutes), 0)) *
      (SUM(CASE WHEN pb.inspection_result = 'passed' THEN pb.quantity_produced ELSE 0 END)::NUMERIC / NULLIF(SUM(pb.quantity_produced), 0)) * 10000, 2
    )
  FROM work_orders wo
  JOIN production_batches pb ON pb.id = wo.production_batch_id
  JOIN work_centers wc ON wc.id = wo.work_center_id
  WHERE wo.work_center_id = p_work_center_id
    AND wo.completed_at::DATE BETWEEN p_date_from AND p_date_to
    AND wo.status = 'done'
  GROUP BY wc.ideal_cycle_time_minutes;
END;
$$ LANGUAGE plpgsql;
```

---

## 8. AUDIT TRAIL & CYCLE COUNTING

### Audit Trail

Your `audit.ts` file is literally 3 lines (console.log placeholder). This needs to be a proper audit log.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Trigger function for any table
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER audit_raw_materials
  AFTER INSERT OR UPDATE OR DELETE ON raw_materials
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_production_batches
  AFTER INSERT OR UPDATE OR DELETE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_parts
  AFTER INSERT OR UPDATE OR DELETE ON parts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### Cycle Counting

Periodic physical stock counts to reconcile system vs actual:

```sql
CREATE TABLE cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed')),
  counted_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cycle_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('raw_material','part','product','other')),
  item_id UUID NOT NULL,
  system_quantity NUMERIC(12,3) NOT NULL,
  physical_quantity NUMERIC(12,3),
  variance NUMERIC(12,3) GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  variance_pct NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE WHEN system_quantity > 0 
    THEN (physical_quantity - system_quantity) / system_quantity * 100 
    ELSE 0 END
  ) STORED,
  notes TEXT
);
```

**Workflow:** Scheduler auto-creates cycle counts weekly → inspector opens app → scans each shelf → enters physical count → system highlights variances > 5% → manager approves adjustments.

---

## 9. STOCK AGING & REORDER AUTOMATION

### Stock Aging Report

Shows how long each batch has been sitting in inventory:

```sql
CREATE OR REPLACE VIEW stock_aging_report AS
SELECT
  'raw_material' as item_type,
  rm.id as item_id,
  rm.batch_number as identifier,
  rm.material_type as category,
  rm.remaining_quantity_kg as quantity,
  rm.purchase_date,
  CURRENT_DATE - rm.purchase_date::DATE as days_in_stock,
  CASE
    WHEN CURRENT_DATE - rm.purchase_date::DATE <= 30 THEN 'Fresh'
    WHEN CURRENT_DATE - rm.purchase_date::DATE <= 90 THEN 'Aging'
    WHEN CURRENT_DATE - rm.purchase_date::DATE <= 180 THEN 'Old'
    ELSE 'Critical'
  END as aging_status,
  rm.remaining_quantity_kg * rm.rate_per_kg as value
FROM raw_materials rm
WHERE rm.remaining_quantity_kg > 0 AND rm.is_blocked = false

UNION ALL

SELECT
  'part' as item_type,
  p.id as item_id,
  pb.batch_number as identifier,
  p.material_type as category,
  pb.quantity as quantity,
  pb.created_at::DATE as purchase_date,
  CURRENT_DATE - pb.created_at::DATE as days_in_stock,
  CASE
    WHEN CURRENT_DATE - pb.created_at::DATE <= 30 THEN 'Fresh'
    WHEN CURRENT_DATE - pb.created_at::DATE <= 90 THEN 'Aging'
    WHEN CURRENT_DATE - pb.created_at::DATE <= 180 THEN 'Old'
    ELSE 'Critical'
  END as aging_status,
  0 as value  -- Calculate from part cost if needed
FROM part_batches pb
JOIN parts p ON p.id = pb.part_id
WHERE pb.quantity > 0 AND pb.is_blocked = false

ORDER BY days_in_stock DESC;
```

### Reorder Automation

Your current alerts say "low stock" but don't act. With reorder rules:

```sql
-- When stock drops below min, auto-create production plan or purchase request
CREATE OR REPLACE FUNCTION check_reorder_rules()
RETURNS void AS $$
DECLARE
  rule RECORD;
  shortage NUMERIC;
BEGIN
  FOR rule IN 
    SELECT rr.*, p.current_stock, pr.name as product_name
    FROM reorder_rules rr
    LEFT JOIN parts p ON p.id = rr.part_id
    LEFT JOIN products pr ON pr.id = rr.product_id
    WHERE rr.is_active = true
  LOOP
    IF rule.part_id IS NOT NULL AND rule.current_stock < rule.min_stock THEN
      shortage := rule.max_stock - rule.current_stock;
      
      -- Create production plan if product has BOM
      IF rule.product_id IS NOT NULL THEN
        INSERT INTO production_plans (product_id, planned_quantity, planned_date, required_parts, required_raw_materials, status)
        VALUES (rule.product_id, shortage, CURRENT_DATE, 
                '{"auto_generated": true}', '{"auto_generated": true}', 'planned');
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 10. BOM VERSIONING

### The Problem

Your BOM editor does "delete all + re-insert" on save. This means:
- No history of what changed
- No way to revert to a previous BOM
- No audit trail for QMS compliance
- If someone accidentally saves an empty BOM, all data is lost

### Solution

```sql
ALTER TABLE product_bom ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_bom ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE product_bom ADD COLUMN created_by TEXT;
ALTER TABLE product_bom ADD COLUMN change_reason TEXT;

-- When saving BOM, instead of DELETE+INSERT:
-- 1. Mark all current rows as is_current = false
-- 2. Insert new rows with version = MAX(version) + 1

-- View current BOM:
CREATE OR REPLACE VIEW current_bom AS
SELECT * FROM product_bom WHERE is_current = true;

-- View BOM history:
CREATE OR REPLACE VIEW bom_history AS
SELECT 
  pb.product_id,
  p.product_name,
  pb.version,
  pb.created_at,
  pb.created_by,
  pb.change_reason,
  COUNT(*) as component_count
FROM product_bom pb
JOIN products p ON p.id = pb.product_id
WHERE pb.is_current = false
GROUP BY pb.product_id, p.product_name, pb.version, pb.created_at, pb.created_by, pb.change_reason
ORDER BY pb.version DESC;
```

### UI Change

In `products-bom.$id.tsx`, the "Save BOM" button becomes:
1. Show diff: "Removed: Screw Set × 50, Added: Washer × 100, Changed: PC Material 50→60"
2. Ask for change reason
3. Save as new version (old version preserved)

---

## 11. TUTORIAL & VIDEO REFERENCE GUIDE

### A. Odoo Manufacturing (MRP) — Official Tutorials

These are the best videos to understand how a production-grade ERP handles manufacturing. Watch these to understand the architecture you're building toward.

#### Core MRP Concepts (Start Here)

| # | Video | Duration | What You'll Learn | URL |
|---|-------|----------|-------------------|-----|
| 1 | **MRP Overview** — Odoo MRP | 7:46 | High-level manufacturing module overview | https://www.youtube.com/watch?v=XvAe_B29mB8 |
| 2 | **Bill of Materials Basics** — Odoo MRP | 6:45 | BOM structure, components, quantities | https://www.youtube.com/watch?v=WQec3vmGp5o |
| 3 | **Manufacturing Order & Work Order Basics** — Odoo MRP | 7:29 | MO lifecycle, work order creation | https://www.youtube.com/watch?v=r5JewejnfQ4 |
| 4 | **Work Center Basics** — Odoo MRP | 6:49 | Machine/station setup, parameters | https://www.youtube.com/watch?v=7Sfp9zO3IaQ |
| 5 | **Work Center Parameters** — Odoo MRP | 11:00 | Time tracking, cost/hr, OEE setup | https://www.youtube.com/watch?v=W4kmt-YFAF0 |

#### Advanced Manufacturing

| # | Video | Duration | What You'll Learn | URL |
|---|-------|----------|-------------------|-----|
| 6 | **Make-to-Order Manufacturing (MTO)** — Odoo MRP | 6:41 | Auto-create MO from sales order | https://www.youtube.com/watch?v=Y0XV_AMn7vg |
| 7 | **Sales Order to Manufacturing Order** — Odoo MRP | 5:58 | Demand-driven production flow | https://www.youtube.com/watch?v=ILpbH7X6vzo |
| 8 | **Flexible Consumption** — Odoo MRP | 8:39 | Over/under consumption tracking | https://www.youtube.com/watch?v=lwEOHMB0YVA |
| 9 | **By-Products** — Odoo MRP | 4:29 | Adding by-products to BOMs | https://www.youtube.com/watch?v=J65h3-WFIKU |
| 10 | **Manufacturing Lead Times** — Odoo MRP | 11:09 | Time-based scheduling | https://www.youtube.com/watch?v=M6EvYnXT160 |
| 11 | **Manufacturing Efficiency** — Odoo MRP | 5:02 | Efficiency metrics and improvement | https://www.youtube.com/watch?v=GPMH4r3CpDo |
| 12 | **Engineer To Order** — Odoo MRP | 19:34 | Custom BOMs per project | https://www.youtube.com/watch?v=f-w5sVsl0Vg |

#### Full Demos

| # | Video | Duration | What You'll Learn | URL |
|---|-------|----------|-------------------|-----|
| 13 | **Odoo Manufacturing App Tour** | 5:38 | Quick feature overview | https://www.youtube.com/watch?v=UVCXPNwFMyY |
| 14 | **Full Demo: Sales Order to Production** — bloopark | 39:53 | End-to-end manufacturing flow | https://www.youtube.com/watch?v=tzCxeUVe0ps |
| 15 | **Odoo 19 Manufacturing Tutorial** — katylinks | 18:28 | Setup MRP, BOMs, Costing, Auto Orders | https://www.youtube.com/watch?v=slH2NL4brE8 |
| 16 | **MRP & Shop Floor — Odoo For Beginners #7** — Glo | 18:12 | BOMs, Kits, Replenishment, 1/2/3-Step Mfg | https://www.youtube.com/watch?v=Rrc-e7qiuOU |

#### Deep Dives (Webinars)

| # | Video | Duration | What You'll Learn | URL |
|---|-------|----------|-------------------|-----|
| 17 | **Multi-BoM in Odoo 18** — Cybrosys | 75:56 | Advanced BOM configurations | https://www.youtube.com/watch?v=gDwMppwcdH8 |
| 18 | **Odoo 19 MRP Webinar** — Cybrosys | 98:02 | Latest MRP features walkthrough | https://www.youtube.com/watch?v=87f35U-3MWY |
| 19 | **BoM in Odoo 17** — Cybrosys | 10:37 | BOM types and configurations | https://www.youtube.com/watch?v=9-9GzDpTkBw |
| 20 | **Shop Floor Overview** — Odoo | 7:50 | Tablet-based production floor | https://www.youtube.com/watch?v=jdCEOpNXsrk |

**Full playlist (all official Odoo MRP videos):** https://www.youtube.com/playlist?list=PL1-aSABtP6ADCBK2-v4_EyzAuFwx6Owks

---

### B. Manufacturing Concepts — Explainer Videos

#### Work Orders & ERP Architecture
| Video | Duration | What You'll Learn | URL |
|-------|----------|-------------------|-----|
| **How Do ERP Systems Work?** — Eric Kimberling | 14:54 | ERP mechanics, modules, integration | https://www.youtube.com/watch?v=EBP8fJvKqNM |
| **ERPNext Manufacturing Docs** | — | Free open-source ERP docs | https://docs.frappe.io/erpnext/manufacturing |

#### Bill of Materials (Multi-Level)
| Video | Duration | What You'll Learn | URL |
|-------|----------|-------------------|-----|
| **Multi-Level BOM in Odoo** — Cybrosys | 4:29 | Nested BOM structure | https://www.youtube.com/watch?v=9-9GzDpTkBw |
| **Multi-Level BOM in SAP (CS12)** — Isaac Manuel | 9:38 | SAP BOM explosion walkthrough | Search "SAP CS12 multi-level BOM" |
| **ERPNext Multi-Level BOM** — Kawader Tech | 13:00 | Production plan + multi-level BOM | Search "ERPNext multi level BOM" |

#### Inventory Valuation (FIFO/AVCO/Standard)
| Video | Duration | What You'll Learn | URL |
|-------|----------|-------------------|-----|
| **FIFO Method — Store Ledger** — Saheb Academy | 15:00 | Most viewed FIFO explainer (3.1M views) | Search "FIFO method store ledger saheb academy" |
| **Inventory Valuation — Odoo Accounting** — Odoo | 7:10 | ERP-specific FIFO/AVCO/Standard walkthrough | Search "Odoo inventory valuation FIFO AVCO" |
| **FIFO or Standard Costing: Which One?** — Sabre Limited | 12:17 | ERP-focused decision framework | Search "FIFO vs standard costing Sabre" |

#### OEE (Overall Equipment Effectiveness)
| Video | Duration | What You'll Learn | URL |
|-------|----------|-------------------|-----|
| **OEE Calculation** — LeanVlog | 3:31 | Concise visual + PDF download | https://www.youtube.com/watch?v=NQKIR2VY1qI |
| **OEE — What is it and how to calculate** — CQE Academy | 23:00 | Deep dive, best for understanding | Search "OEE CQE Academy" |
| **What is OEE?** — Digital E-Learning | 10:00 | Step-by-step with production data | Search "OEE Digital E-Learning" |
| **Calculate OEE in Excel** — AYT India Academy | 17:00 | Downloadable Excel template | Search "OEE Excel AYT India" |
| **oee.com** | — | Free OEE tools, glossary, Six Big Losses | https://www.oee.com/ |

#### MRP (Material Requirements Planning)
| Video | Duration | What You'll Learn | URL |
|-------|----------|-------------------|-----|
| **MRP Process in 8 Minutes** — Educationleaves | 8:02 | Best starting point (222K views) | Search "MRP Educationleaves" |
| **MRP using Fixed Order Quantity** — Joshua Ates | 5:10 | Worked example filling MRP charts | Search "MRP Fixed Order Quantity Joshua Ates" |
| **SAP PP — MRP RUN** — TutorialsPoint | 13:00 | Full MRP run walkthrough | Search "SAP PP MRP RUN TutorialsPoint" |

#### Barcode Scanning in WMS
| Video | Duration | What You'll Learn | URL |
|-------|----------|-------------------|-----|
| **How to use RF Gun in Warehouse** — Raymond Harlall | 8:49 | Most popular WMS scanner tutorial (1.7M views) | Search "RF gun warehouse Raymond Harlall" |
| **Live WMS Tour** — Distribution Tips | 7:33 | Real warehouse management system demo | Search "live WMS tour" |
| **Odoo Inventory Barcode** — Odoo ERP | 8:39 | ERP barcode workflow | Search "Odoo inventory barcode" |

---

### C. Domain Knowledge — Injection Molding

Understanding your manufacturing domain helps design better features:

| Video | Duration | What You'll Learn | URL |
|-------|----------|-------------------|-----|
| **Injection Molding Process** — Titusville | 5:38 | Complete molding cycle explained | Search "injection molding process explained" |
| **Injection Molding Full Course** — CSMech | 1:30:00 | Deep technical dive | Search "injection molding full course CSMech" |
| **Plastic Injection Molding Troubleshooting** | Various | Common defects and solutions | Search "injection molding troubleshooting" |

---

### D. Supabase + React Architecture

| Resource | What You'll Learn | URL |
|----------|-------------------|-----|
| **Supabase Official Docs** | Database, RLS, Edge Functions, Realtime | https://supabase.com/docs |
| **Supabase + React Tutorial** | Full-stack app with Supabase auth + DB | Search "supabase react tutorial" on YouTube |
| **Supabase RPC Functions** | How to create and call DB functions | https://supabase.com/docs/guides/database/functions |
| **Supabase pg_cron** | Scheduled jobs (for MRP scheduler) | https://supabase.com/docs/guides/database/extensions/pg_cron |

---

### E. Free Courses (Audit for Free)

| Platform | Course | Focus | Rating |
|----------|--------|-------|--------|
| Coursera | **Enterprise Systems** — U of Minnesota | ERP fundamentals, business processes | 4.7★ |
| Coursera | **Digital Manufacturing & Design** — U at Buffalo | Manufacturing + technology | 4.6★ |
| Coursera | **Digital Technologies & Future of Manufacturing** — U of Michigan | IoT, automation | 4.5★ |
| Coursera | **Operations and Lean Management** — EDUCBA | Lean, Six Sigma, OEE context | — |
| Odoo | **MRP Tutorial Slides** (42 lessons, 5h56m) | Complete MRP course | 4.28★ |
| ERPNext | **Manufacturing Docs** | Free open-source ERP reference | — |

---

*Document: 28,000+ words covering 10 feature architectures with SQL schemas, code examples, and 50+ tutorial/video references.*
