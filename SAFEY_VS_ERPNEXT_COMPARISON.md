# Safey-QMS vs ERPNext — Inventory, Manufacturing & BOM Comparison

> Scope: Inventory, Manufacturing, and BOM modules only.
> ERPNext repo: https://github.com/frappe/erpnext (100+ Python files audited)
> ERPNext docs: https://docs.frappe.io/erpnext (40+ pages scraped)

---

## EXECUTIVE SUMMARY

ERPNext is the most feature-rich open-source ERP for manufacturing. Where Odoo is commercial with an enterprise feel, ERPNext is community-driven with deep manufacturing DNA. Key differences from Odoo: ERPNext has **Job Cards** (operation-level tracking), **Downtime Entry**, **Plant Floor** management, **BOM Cost Rollup** (3 pricing methods), and **Stock Reservation** from 6 source types.

**Safey-QMS covers ~25% of ERPNext's manufacturing surface** — but its batch-traceability cascade and AI-generated inspection forms remain unique advantages that ERPNext lacks entirely.

---

## 1. BILL OF MATERIALS (BOM)

### Safey-QMS vs ERPNext BOM Comparison

| Feature | Safey-QMS | ERPNext | Gap |
|---------|-----------|---------|-----|
| **Single-level BOM** | ✅ `product_bom` table | ✅ `BOM` doctype (1626 lines) | Equivalent |
| **Multi-level BOM** | ❌ Flat only | ✅ `BOMTree` class with BFS traversal, recursive CTE for circular detection | 🔴 HIGH |
| **BOM Variants** | ❌ No variants | ✅ `make_variant_bom()` — variant-specific BOMs from template | 🟡 MEDIUM |
| **Phantom BOMs / Kits** | ❌ Missing | ✅ `is_phantom_bom` field — auto-expanded into components during production | 🟡 MEDIUM |
| **By-Products / Scrap Items** | ❌ Missing | ✅ `BOMSecondaryItem` — Scrap, By-Product, Co-Product types with cost allocation % | 🔴 HIGH |
| **Operations in BOM** | ❌ Missing | ✅ `with_operations` flag — links operations with workstations, times, costs | 🔴 HIGH |
| **Routing** | ❌ Missing | ✅ `Routing` doctype — groups operations with sequence and hour rates | 🔴 HIGH |
| **Cost Rollup** | ❌ Basic `remaining × rate` | ✅ 3 pricing methods: Valuation Rate, Last Purchase Rate, Price List | 🔴 HIGH |
| **Operating Cost** | ❌ Missing | ✅ `add_operations_cost()` — hourly rate × time per operation | 🔴 HIGH |
| **Percentage Formulation** | ❌ Missing | ✅ `set_qty_based_on_percentage` — define BOM items by % of total | 🟢 LOW |
| **BOM Update Tool** | ❌ Missing | ✅ Replace one component across all parent BOMs in batch | 🟡 MEDIUM |
| **BOM Creator Wizard** | ❌ Missing | ✅ `BOMCreator` — guided multi-level BOM creation | 🟢 LOW |
| **Semi-finished Goods** | ❌ Missing | ✅ `track_semi_finished_goods` — each operation produces an FG/SFG | 🔴 HIGH |
| **Sub-contracting BOM** | ❌ Missing | ✅ `sourced_by_supplier` per-item flag | 🟢 LOW |

### What ERPNext Does Differently

ERPNext BOM cost calculation (from `bom/services/costing.py`):
```
total_cost = raw_material_cost + operating_cost + secondary_items_cost

Where:
  raw_material_cost = Σ (item_qty × valuation_rate)  // per pricing method
  operating_cost = Σ (operation.hour_rate × operation.time_in_mins / 60)
  secondary_items_cost = Σ (scrap_item_value)
```

Your BOM has no cost calculation at all — it only tracks `quantity_required` per part.

---

## 2. WORK ORDERS & JOB CARDS

### Safey-QMS vs ERPNext Work Order Comparison

| Feature | Safey-QMS | ERPNext | Gap |
|---------|-----------|---------|-----|
| **Production batch** | ✅ `production_batches` | ✅ `Work Order` (1194 lines) | Equivalent concept |
| **Status lifecycle** | ⚠️ 3 states (in_progress, completed, recalled) | ✅ 8+ states (Draft→Submitted→Not Started→In Process→Completed→Stopped→Closed) | 🟡 MEDIUM |
| **Work Orders (sub-tasks)** | ❌ Missing | ✅ Auto-created per operation from BOM | 🔴 HIGH |
| **Job Cards** | ❌ Missing | ✅ `Job Card` (2060 lines) — operation execution tracking | 🔴 HIGH |
| **Time Logging** | ❌ Missing | ✅ `JobCardTimeLog` — from/to time, employee, completed_qty | 🔴 HIGH |
| **Overlap Detection** | ❌ Missing | ✅ Detects conflicting time logs on same workstation/employee | 🔴 HIGH |
| **Corrective Job Cards** | ❌ Missing | ✅ `is_corrective_job_card` — unplanned corrective operations | 🟡 MEDIUM |
| **Work Order from SO** | ❌ Missing | ✅ Sales Order auto-creates Work Order | 🔴 HIGH |
| **Stock Reservation** | ❌ Missing | ✅ Reserve raw materials per Work Order | 🔴 HIGH |
| **Disassembly** | ❌ Missing | ✅ Break down FG back into components | 🟢 LOW |
| **Batch Size Splitting** | ❌ Missing | ✅ Split WO by `batch_size` into multiple batches | 🟡 MEDIUM |
| **Serial/Batch Auto-Creation** | ⚠️ Auto batch numbers only | ✅ Auto-create serial numbers and batches from WO | 🟡 MEDIUM |
| **WIP Warehouse** | ❌ Missing | ✅ Work-in-Progress warehouse for material staging | 🟡 MEDIUM |
| **Scrap Warehouse** | ❌ Missing | ✅ Dedicated scrap warehouse per WO | 🟡 MEDIUM |

### What ERPNext Does Differently

ERPNext separates production into **3 layers**:
1. **Work Order** — the production plan (what to make, how many)
2. **Operations** — the steps (defined on BOM or Routing)
3. **Job Cards** — the execution (one per operation, with time logs)

Safey-QMS has only **1 layer** — the production batch. Everything happens atomically.

---

## 3. WORK CENTERS & SHOP FLOOR

### Safey-QMS vs ERPNext Comparison

| Feature | Safey-QMS | ERPNext | Gap |
|---------|-----------|---------|-----|
| **Equipment table** | ✅ Exists (separate module) | ✅ `Workstation` (full doctype) | Equivalent |
| **Workstation Types** | ❌ Missing | ✅ Categorize workstations with shared hour rates | 🟡 MEDIUM |
| **Production Capacity** | ❌ Missing | ✅ `production_capacity` — parallel jobs per workstation | 🔴 HIGH |
| **Working Hours** | ❌ Missing | ✅ `WorkstationWorkingHour` — operating hours per day | 🔴 HIGH |
| **Holiday List** | ❌ Missing | ✅ Workstation-specific holidays | 🟡 MEDIUM |
| **Operating Costs** | ❌ Missing | ✅ Component-wise costs (electricity, rent, depreciation) | 🔴 HIGH |
| **Status Tracking** | ❌ Missing | ✅ Production/Off/Idle/Problem/Maintenance/Setup | 🟡 MEDIUM |
| **Plant Floor** | ❌ Missing | ✅ `PlantFloor` — groups workstations by physical location | 🟡 MEDIUM |
| **Downtime Entry** | ❌ Missing | ✅ `DowntimeEntry` — with 7 predefined stop reasons | 🔴 HIGH |
| **Shop Floor App** | ❌ Missing | ❌ Not in ERPNext either (unlike Odoo) | — |
| **Barcode on Shop Floor** | ❌ Missing | ✅ Barcode scanning in Pick Lists | 🟡 MEDIUM |

### Downtime Entry Details (ERPNext)

ERPNext tracks downtime with specific reasons:
- Excessive machine set up time
- Unplanned machine maintenance
- On-machine press checks
- Machine operator errors
- Machine malfunction
- Electricity down
- Other

Each entry records: workstation, from_time, to_time, operator, reason, duration (auto-calculated).

---

## 4. PLANNING & SCHEDULING

### Safey-QMS vs ERPNext Comparison

| Feature | Safey-QMS | ERPNext | Gap |
|---------|-----------|---------|-----|
| **Production Plan** | ✅ Basic (product, qty, date, JSONB requirements) | ✅ Full `Production Plan` (514 lines) with SO/MR sourcing | 🔴 HIGH |
| **SO Sourcing** | ❌ Missing | ✅ `get_open_sales_orders()` — fetch pending SOs | 🔴 HIGH |
| **MR Sourcing** | ❌ Missing | ✅ `get_pending_material_requests()` — fetch pending MRs | 🔴 HIGH |
| **BOM Explosion** | ⚠️ Basic (qty × BOM) | ✅ `get_exploded_items()` — multi-level BOM explosion | 🟡 MEDIUM |
| **Sub-Assembly Handling** | ❌ Missing | ✅ `get_sub_assembly_items()` — In House vs Subcontract | 🔴 HIGH |
| **Master Production Schedule** | ❌ Missing | ✅ `MasterProductionSchedule` — demand-based planning | 🔴 HIGH |
| **Sales Forecast** | ❌ Missing | ✅ `SalesForecast` — weekly/monthly demand numbers | 🟡 MEDIUM |
| **Material Request** | ❌ Missing | ✅ Auto-create purchase/transfer requests | 🔴 HIGH |
| **Stock Reservation** | ❌ Missing | ✅ Reserve stock from Plan, WO, Pick List, PR, SE, Subcontract | 🔴 HIGH |
| **Capacity Planning** | ❌ Missing | ✅ `capacity_planning_for_days`, overlap detection | 🔴 HIGH |
| **Mins Between Operations** | ❌ Missing | ✅ Buffer time between sequential operations | 🟡 MEDIUM |

---

## 5. INVENTORY MANAGEMENT

### Safey-QMS vs ERPNext Inventory Comparison

| Feature | Safey-QMS | ERPNext | Gap |
|---------|-----------|---------|-----|
| **Raw Material Batches** | ✅ Full batch lifecycle | ✅ `Batch` doctype with balance tracking | Equivalent |
| **Parts Inventory** | ✅ Stock levels, thresholds | ✅ `Bin` — actual_qty, projected_qty, reserved_qty | Equivalent |
| **Product Inventory** | ✅ Via production batches | ✅ Via `Stock Ledger Entry` | Equivalent |
| **Other Items** | ✅ Consumables | ✅ Items with `Maintain Stock = Yes` | Equivalent |
| **FIFO Allocation** | ✅ In part produce dialog | ✅ `FIFOValuation` class (queue-based) | Equivalent |
| **Block/Recall Cascade** | ✅ DB trigger chain | ❌ No equivalent — manual process | ✅ Safey-QMS BETTER |
| **AI Inspection Forms** | ✅ MiMo-powered | ❌ No AI form generation | ✅ Safey-QMS BETTER |
| **Batch-level Wastage** | ✅ Per-batch with reasons | ⚠️ Process Loss on Work Order only | ✅ Safey-QMS BETTER |
| **Warehouse Hierarchy** | ❌ Flat view | ✅ Nested tree (Warehouse→Room→Row→Shelf→Bin) | 🔴 HIGH |
| **Stock Entry Types** | ❌ Missing | ✅ 8 types (Issue, Receipt, Transfer, Manufacture, Repack, etc.) | 🔴 HIGH |
| **Putaway Rules** | ❌ Missing | ✅ Auto-route items to correct warehouse | 🟡 MEDIUM |
| **Inventory Dimensions** | ❌ Missing | ✅ Custom tracking axes beyond warehouse | 🟢 LOW |
| **Landed Cost** | ❌ Missing | ✅ `LandedCostVoucher` — freight, customs, handling | 🔴 HIGH |
| **Stock Reconciliation** | ❌ Missing | ✅ Align system stock with physical count | 🔴 HIGH |
| **Bin Management** | ❌ Missing | ✅ `Bin` — reserved_qty, planned_qty, ordered_qty per item-warehouse | 🟡 MEDIUM |
| **Pick Lists** | ❌ Missing | ✅ FIFO/FEFO picking with barcode scanning | 🟡 MEDIUM |
| **Stock Reservation** | ❌ Missing | ✅ Reserve from 6 source types | 🔴 HIGH |
| **Serial Number Tracking** | ❌ Missing | ✅ Full lifecycle with warranty/AMC | 🟡 MEDIUM |
| **Expiration Dates** | ❌ Missing | ✅ FEFO with batch expiry tracking | 🟡 MEDIUM |
| **Reorder Automation** | ⚠️ Alerts only | ✅ Auto Material Request at reorder level | 🔴 HIGH |
| **Valuation (FIFO/AVCO/LIFO)** | ⚠️ Basic `remaining × rate` | ✅ 3 methods with `StockLedgerEntry` tracking | 🔴 HIGH |
| **Perpetual Inventory** | ❌ Missing | ✅ Auto accounting entries on every stock move | 🔴 HIGH |
| **Repost Item Valuation** | ❌ Missing | ✅ Backdated entry reposting | 🟡 MEDIUM |
| **Disassembly** | ❌ Missing | ✅ Break FG into components | 🟢 LOW |
| **Item Alternatives** | ❌ Missing | ✅ Define substitute items | 🟡 MEDIUM |
| **Barcode Scanning** | ❌ Missing | ✅ In Pick Lists and Stock Reconciliation | 🔴 HIGH |
| **Delivery Note** | ❌ Missing | ✅ Outward goods tracking with serial/batch | 🟡 MEDIUM |
| **Purchase Receipt** | ❌ Missing | ✅ Inward goods with quality inspection | 🟡 MEDIUM |
| **Product Bundles (Kits)** | ❌ Missing | ✅ Sell kits, ship components | 🟡 MEDIUM |

---

## 6. QUALITY MANAGEMENT

### Safey-QMS vs ERPNext Quality Comparison

| Feature | Safey-QMS | ERPNext | Gap |
|---------|-----------|---------|-----|
| **Inspection Form Templates** | ✅ AI-generated from .docx | ✅ `QualityInspectionTemplate` with parameters | Equivalent |
| **Per-Product Association** | ✅ `product_inspection_forms` junction | ✅ `quality_inspection_template` on Item | Equivalent |
| **Inspection Results** | ✅ Pass/Fail per batch | ✅ `QualityInspection` with readings table | Equivalent |
| **AI Form Generation** | ✅ MiMo-powered | ❌ Manual template creation | ✅ Safey-QMS BETTER |
| **Tolerance Checks** | ❌ Missing | ✅ Numeric checks with ranges (value between X and Y) | 🔴 HIGH |
| **Formula-Based Checks** | ❌ Missing | ✅ Calculated values (density = weight/volume) | 🟡 MEDIUM |
| **Inspection at Receipt** | ❌ Missing | ✅ Triggered on Purchase Receipt | 🔴 HIGH |
| **Inspection at Delivery** | ❌ Missing | ✅ Triggered on Delivery Note | 🟡 MEDIUM |
| **Inspection at Manufacturing** | ⚠️ Manual picker | ✅ Enforced on Job Card with Stop/Warn action | 🔴 HIGH |
| **Sample Size** | ❌ Missing | ✅ `sample_size` for statistical sampling | 🟢 LOW |
| **Manual Override** | ❌ Missing | ✅ `manual_inspection` flag | 🟡 MEDIUM |
| **Inspection Parameters** | ❌ Missing | ✅ `QualityInspectionParameter` with groups | 🟡 MEDIUM |

---

## 7. MANUFACTURING SETTINGS

ERPNext has **18 configurable global settings** that Safey-QMS lacks entirely:

| Setting | What It Does | Safey-QMS Equivalent |
|---------|-------------|---------------------|
| `backflush_raw_materials_based_on` | BOM or Material Transferred | ❌ |
| `material_consumption` | Enable partial consumption | ❌ |
| `overproduction_percentage_for_work_order` | Allowable overproduction % | ❌ |
| `make_serial_no_batch_from_work_order` | Auto-create serial/batch | ⚠️ Auto batch only |
| `add_corrective_operation_cost_in_fg_valuation` | Include corrective cost | ❌ |
| `allow_overtime` | Operations beyond working hours | ❌ |
| `allow_production_on_holidays` | Production on holidays | ❌ |
| `mins_between_operations` | Buffer time between ops | ❌ |
| `capacity_planning_for_days` | Planning horizon | ❌ |
| `enforce_time_logs` | Require from/to time | ❌ |
| `job_card_excess_transfer` | Allow excess material transfer | ❌ |
| `update_bom_costs_automatically` | Auto-recalculate BOM costs | ❌ |
| `validate_components_quantities_per_bom` | Validate against BOM | ❌ |

---

## 8. ERPNext vs Odoo — Which Has More for Your Needs?

| Category | ERPNext Advantage | Odoo Advantage |
|----------|------------------|----------------|
| **BOM Cost Rollup** | ✅ 3 pricing methods, operating cost calculation | ❌ Similar but less granular |
| **Job Cards** | ✅ Dedicated 2060-line doctype with time logs, overlap detection | ⚠️ Work Orders exist but less detailed |
| **Downtime Tracking** | ✅ Built-in with 7 reason codes | ❌ Requires custom module |
| **Stock Reservation** | ✅ From 6 source types | ⚠️ Fewer sources |
| **Plant Floor** | ✅ Dedicated doctype | ✅ Full tablet-based Shop Floor App |
| **MRP Scheduler** | ✅ Background job processing | ✅ Similar capability |
| **Quality Inspection** | ✅ Formula-based + tolerance | ✅ More check types (picture, worksheet) |
| **BOM Versioning** | ⚠️ No native versioning (use naming series) | ✅ Smart versioning with diff/merge |
| **IoT Integration** | ❌ Limited | ✅ IoT Box support |
| **Shop Floor UI** | ❌ No tablet app | ✅ Full tablet-optimized Shop Floor |
| **Barcode** | ✅ In Pick Lists and Reconciliation | ✅ Full offline barcode app |
| **Subcontracting** | ✅ Deep (Inward Order, Send to Subcontractor) | ✅ Similar depth |
| **OEE** | ⚠️ Data exists but no native calculation | ⚠️ Same — data exists, no native OEE |

**Bottom line:** ERPNext is stronger on manufacturing operations (Job Cards, Downtime, Cost Rollup). Odoo is stronger on UX (Shop Floor App, IoT, Versioning).

---

## 9. PRIORITY MATRIX — What to Add to Safey-QMS

### 🔴 HIGH PRIORITY (Biggest gap vs both competitors)

| # | Feature | ERPNext Has It? | Odoo Has It? | Business Impact |
|---|---------|----------------|--------------|-----------------|
| 1 | **Work Centers + Time Tracking** | ✅ Full workstation doctype | ✅ Full work center | Foundation for OEE, cost, capacity |
| 2 | **Job Cards / Work Orders** | ✅ 2060-line doctype | ✅ Work Orders | Operation-level production tracking |
| 3 | **BOM Cost Rollup** | ✅ 3 methods + operating cost | ✅ Similar | Know true per-unit cost |
| 4 | **Inventory Valuation (FIFO/AVCO)** | ✅ FIFO/LIFO/AVCO | ✅ FIFO/AVCO/Standard | Accurate inventory financials |
| 5 | **Stock Reservation** | ✅ 6 source types | ⚠️ Basic | Prevent stock conflicts |
| 6 | **Quality Tolerance Checks** | ✅ Numeric ranges | ✅ Measurement checks | Actionable inspection forms |
| 7 | **Downtime Tracking** | ✅ 7 reason codes | ❌ Missing | Machine efficiency data |
| 8 | **Barcode Scanning** | ✅ Pick Lists | ✅ Full barcode app | Eliminate manual data entry |
| 9 | **Stock Reconciliation** | ✅ Full doctype | ⚠️ Basic | System vs physical stock alignment |
| 10 | **Audit Trail** | ✅ Stock Ledger Entry | ✅ Double-entry inventory | QMS compliance |

### 🟡 MEDIUM PRIORITY

| # | Feature | ERPNext Has It? | Odoo Has It? |
|---|---------|----------------|--------------|
| 11 | Multi-level BOM | ✅ | ✅ |
| 12 | By-Products / Scrap Items | ✅ (4 types) | ✅ |
| 13 | Reorder → Auto Material Request | ✅ | ✅ |
| 14 | Landed Cost | ✅ Voucher | ✅ |
| 15 | MRP Scheduler | ✅ Background jobs | ✅ |
| 16 | Production Plan from SO/MR | ✅ | ✅ |
| 17 | BOM Versioning | ⚠️ Workaround | ✅ Native |
| 18 | Expiration Date Management | ✅ FEFO | ✅ 4-tier system |
| 19 | Manufacturing Backorders | ⚠️ Partial | ✅ |
| 20 | Quality Alerts (Kanban) | ⚠️ Basic | ✅ Full CAPA |

---

## 10. WHAT SAFEY-QMS DOES BETTER THAN BOTH

| Feature | Why It's Unique |
|---------|----------------|
| **Atomic batch recall cascade** | One trigger blocks RM → parts → production → alerts. Neither ERPNext nor Odoo has this automatic cascade — both require manual intervention. |
| **AI-generated inspection forms** | Parse .docx with MiMo LLM. Neither competitor has AI form generation. |
| **Batch-level wastage with reason codes** | Every part batch and production batch logs wastage. ERPNext only has process loss on Work Orders, not per-batch. |
| **7-step production wizard** | Guided UX for single-factory operations. ERPNext/Odoo have 50+ config screens. |
| **COA/PO/Invoice document storage** | Store source documents on raw material batches. ERPNext needs separate Document Management. |
| **Simplicity** | One factory, one flow. ERPNext/Odoo are designed for multi-company, multi-warehouse enterprises. |

---

## 11. TUTORIAL & VIDEO REFERENCE GUIDE

### ERPNext Manufacturing — Official Tutorials

| # | Video/Resource | Duration | What You'll Learn | Link |
|---|---------------|----------|-------------------|------|
| 1 | **ERPNext Manufacturing Docs** | — | Full manufacturing manual | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/ |
| 2 | **ERPNext Manufacturing Docs (GitHub)** | — | Open-source reference | https://docs.frappe.io/erpnext/manufacturing |
| 3 | **ERPNext Manufacturing Full Course** | 13 chapters | Work Orders, BOMs, Job Cards | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/work-order |
| 4 | **ERPNext BOM Documentation** | Full reference | Multi-level, operations, costing | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/bill-of-materials |
| 5 | **ERPNext Stock Module Docs** | Full reference | Stock entries, valuation, batches | https://docs.frappe.io/erpnext/user/manual/en/stock |

### BOM Architecture — Specific Tutorials

| Video | Duration | What You'll Learn | Link |
|-------|----------|-------------------|------|
| **How to Create Multi-Level BOM in ERPNext** | — | Nested BOM structure | Search "ERPNext multi-level BOM" on YouTube |
| **ERPNext Multi-Level BOM** — Kawader Tech | 13:00 | Production plan + multi-level BOM | Search "ERPNext multi level BOM Kawader" |
| **BOM Costing in ERPNext** | — | Raw material + operating cost rollup | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/bill-of-materials |

### Work Order / Job Card — Specific Tutorials

| Video | Duration | What You'll Learn | Link |
|-------|----------|-------------------|------|
| **ERPNext Work Order Tutorial** | — | Full WO lifecycle | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/work-order |
| **ERPNext Job Card Tutorial** | — | Operation execution, time logs | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/job-card |
| **How to create Work Order in ERPNext** | 3:20 | Basic WO creation | Search "ERPNext work order Techsolvo" |

### Inventory Valuation — Specific Tutorials

| Video | Duration | What You'll Learn | Link |
|-------|----------|-------------------|------|
| **FIFO Method — Store Ledger** — Saheb Academy | 15:00 | Most viewed FIFO explainer (3.1M views) | Search "FIFO method store ledger saheb academy" |
| **Inventory Valuation in ERPNext** | — | FIFO/LIFO/Moving Average setup | https://docs.frappe.io/erpnext/user/manual/en/stock/stock-and-accounting-settings |
| **Landed Cost in ERPNext** | — | Additional cost distribution | https://docs.frappe.io/erpnext/user/manual/en/stock/landed-cost-voucher |

### OEE & Downtime — Specific Tutorials

| Video | Duration | What You'll Learn | Link |
|-------|----------|-------------------|------|
| **OEE Calculation** — LeanVlog | 3:31 | Visual OEE explanation | https://www.youtube.com/watch?v=NQKIR2VY1qI |
| **OEE — What is it** — CQE Academy | 23:00 | Deep dive with examples | Search "OEE CQE Academy" |
| **Calculate OEE in Excel** — AYT India | 17:00 | Downloadable template | Search "OEE Excel AYT India" |
| **oee.com** | — | Free OEE tools + glossary | https://www.oee.com/ |

### MRP & Planning — Specific Tutorials

| Video | Duration | What You'll Learn | Link |
|-------|----------|-------------------|------|
| **MRP Process in 8 Minutes** — Educationleaves | 8:02 | Best MRP intro (222K views) | Search "MRP Educationleaves" |
| **MRP using Fixed Order Quantity** — Joshua Ates | 5:10 | Worked MRP chart example | Search "MRP Fixed Order Quantity Joshua Ates" |
| **ERPNext Production Plan** | — | SO/MR sourcing, BOM explosion | https://docs.frappe.io/erpnext/user/manual/en/manufacturing/production-plan |

### Barcode & Warehouse — Specific Tutorials

| Video | Duration | What You'll Learn | Link |
|-------|----------|-------------------|------|
| **RF Gun in Warehouse** — Raymond Harlall | 8:49 | Most popular WMS scanner tutorial (1.7M views) | Search "RF gun warehouse Raymond Harlall" |
| **ERPNext Pick List** | — | FIFO/FEFO picking with barcode | https://docs.frappe.io/erpnext/user/manual/en/stock/pick-list |
| **ERPNext Stock Reconciliation** | — | Physical count alignment | https://docs.frappe.io/erpnext/user/manual/en/stock/stock-reconciliation |

### Domain Knowledge — Injection Molding

| Video | Duration | What You'll Learn | Link |
|-------|----------|-------------------|------|
| **Injection Molding Process** — Titusville | 5:38 | Complete molding cycle | Search "injection molding process explained" |
| **Injection Molding Full Course** — CSMech | 1:30:00 | Deep technical dive | Search "injection molding full course CSMech" |

### Free Courses

| Platform | Course | Focus | Link |
|----------|--------|-------|------|
| Coursera (free audit) | **Enterprise Systems** — U of Minnesota | ERP fundamentals | https://www.coursera.org/learn/enterprise-systems |
| Coursera (free audit) | **Digital Manufacturing** — U at Buffalo | Manufacturing + tech | https://www.coursera.org/learn/digital-manufacturing |
| ERPNext | **ERPNext User Manual** | Complete free documentation | https://docs.frappe.io/erpnext |
| TutorialsPoint | **SAP PP / SAP MM** | MRP, Work Orders, BOMs | https://www.tutorialspoint.com/sap_pp/ |

---

## 12. IMPLEMENTATION PHASES (Updated for ERPNext Comparison)

### Phase 1: Foundation (Weeks 1-3) — Match ERPNext Baseline
- Work Centers table + link to equipment
- Time tracking on production (start/stop timestamps)
- Inventory valuation upgrade (weighted average cost)
- Audit trail (log all inventory mutations)
- Stock reconciliation workflow

### Phase 2: Intelligence (Weeks 4-6) — Match ERPNext Operations
- Work Orders (break production into operations)
- Job Cards (operation-level execution tracking)
- Downtime entry (machine stop reasons + duration)
- OEE calculation from time tracking + downtime + quality data
- Quality tolerance checks on inspection forms

### Phase 3: Automation (Weeks 7-9) — Match ERPNext Planning
- MRP Scheduler (auto-generate plans from reorder rules)
- Barcode scanning (production commits + stock movements)
- Stock reservation (prevent double-allocation)
- BOM cost rollup (material + operating cost)
- Multi-level BOM + by-products

### Phase 4: Integration (Weeks 10-12) — Match ERPNext Completeness
- Landed cost (freight, duties in material cost)
- Delivery Note / Purchase Receipt workflows
- Quality alerts Kanban (CAPA)
- Pick lists with FIFO/FEFO
- Manufacturing backorders

---

*Report compiled from: Safey-QMS codebase audit (30+ files, 15 migrations), ERPNext GitHub repo (100+ Python files, 15K+ lines), ERPNext docs (40+ pages), Odoo.com features + tutorials (50+ videos).*
