# Safey-QMS vs Odoo — Inventory, Manufacturing & BOM Feature Comparison

> Detailed analysis of feature gaps, integration opportunities, and business benefits.
> Scope: Inventory, Manufacturing, and BOM modules only.

---

## EXECUTIVE SUMMARY

Safey-QMS is a **focused, batch-traceability-first ERP** built for injection molding / plastics manufacturing. It excels at raw material → part → product flow with atomic batch tracking and recall cascading. Odoo is a **full-spectrum ERP** with 10x the feature breadth across warehouse ops, planning, quality, maintenance, and accounting integration.

**Key finding:** Safey-QMS covers ~35% of Odoo's inventory/manufacturing feature surface, but its **existing architecture is clean and extensible**. The biggest wins come from adding features that directly leverage what's already built — not bolting on alien patterns.

---

## 1. BILL OF MATERIALS (BOM)

### What Safey-QMS Has
| Feature | Status | Implementation |
|---------|--------|----------------|
| Single-level BOM | ✅ Built | `product_bom` table, split-pane editor |
| Quantity per component | ✅ Built | `quantity_required` (INTEGER) |
| BOM save (full replace) | ✅ Built | Delete-all + re-insert pattern |
| BOM inspection form linking | ✅ Built | `product_inspection_forms` junction |

### What Odoo Has (that Safey-QMS doesn't)

| Odoo Feature | Safey-QMS Gap | Business Benefit | Priority |
|-------------|---------------|-----------------|----------|
| **Multi-level BOM** (nested sub-assemblies) | ❌ Missing — BOM is flat, one level only | Your part_batches already chain RM→Part→Product. Multi-level BOM lets you define "Part A needs Sub-Part X + Sub-Part Y" where Sub-Parts have their own BOMs. Critical if you ever produce intermediate assemblies. | 🔴 HIGH |
| **BOM Variants** (per product variant) | ❌ Missing — no product variants at all | If you make the same product in different colors/sizes with different material mixes, this avoids maintaining separate products. | 🟡 MEDIUM |
| **Phantom BOMs / Kits** | ❌ Missing | Sell a "kit" (e.g., "Back Cover Set = Back Cover + Screw Set") without manufacturing it. Components are picked and shipped directly. Reduces unnecessary production steps. | 🟡 MEDIUM |
| **BOM Substitutes** | ❌ Missing | When Part A is unavailable, system suggests Part B as alternative. Your batch recall already handles blocking — substitutes extend this to "blocked? use this instead." | 🟡 MEDIUM |
| **By-Products** | ❌ Missing | Your wastage tracking logs waste but doesn't capture recoverable by-products (e.g., runners/regrind in injection molding that can be re-used). Adding by-product BOM lines turns waste into inventory. | 🔴 HIGH |
| **BOM Routing** (work center sequence) | ❌ Missing | Define which machine/station each BOM component goes through. Enables time tracking per operation and capacity planning. | 🟡 MEDIUM |
| **BOM Versioning / History** | ❌ Missing — full-replace saves lose history | Every BOM save overwrites. No audit trail of what changed, when, or why. Critical for QMS compliance. | 🔴 HIGH |

### Integration Recommendation

**Multi-level BOM + By-Products + Versioning** are the three BOM features worth adding. Your `product_bom` table needs:
- `parent_bom_id` self-reference for nesting
- `is_phantom` boolean for kit behavior
- `by_product` flag + destination location
- `version` integer + `created_by` for audit trail

---

## 2. MANUFACTURING ORDERS (MO)

### What Safey-QMS Has
| Feature | Status | Implementation |
|---------|--------|----------------|
| Production batch creation | ✅ Built | 7-step wizard → `commit_production` RPC |
| Product + quantity selection | ✅ Built | Step 1 of wizard |
| Team allocation | ✅ Built | Step 2 (hardcoded mock employees) |
| Equipment assignment | ✅ Built | Steps 3 (process + measuring equipment) |
| Part availability check | ✅ Built | `get_part_availability` RPC |
| FIFO batch allocation | ✅ Built | Auto + manual pick modes |
| Expected vs actual tracking | ✅ Built | `expected_raw_material_kg` vs `actual_raw_material_kg` |
| Wastage logging | ✅ Built | Auto-logged via triggers, reason codes |
| Batch recall cascade | ✅ Built | Block RM → block parts → recall production |
| Inspection form integration | ✅ Built | Per-batch inspection results |
| Production planning | ✅ Built | Save plans, execute from plan |
| Status tracking | ✅ Built | `in_progress`, `completed`, `recalled` |

### What Odoo Has (that Safey-QMS doesn't)

| Odoo Feature | Safey-QMS Gap | Business Benefit | Priority |
|-------------|---------------|-----------------|----------|
| **Draft → Confirmed → In Progress → Done** workflow | ❌ Missing — batches go straight to `completed` | Allows review before commitment. Prevents accidental production commits. Adds approval step for regulated industries. | 🟡 MEDIUM |
| **Work Orders** (sub-tasks within MO) | ❌ Missing — production is atomic, one step | Break production into operations (Mix → Mold → Trim → Pack). Each operation tracks time, operator, and quality separately. Enables per-operation costing. | 🔴 HIGH |
| **Work Order Dependencies** (sequential ops) | ❌ Missing | Op B can't start until Op A finishes. Prevents out-of-order production. Critical for multi-machine workflows. | 🟡 MEDIUM |
| **Split / Merge MOs** | ❌ Missing — no way to split a large batch | Split 10,000-unit MO into 2x 5,000 for parallel production. Or merge two small MOs for efficiency. | 🟡 MEDIUM |
| **Manufacturing Backorders** | ❌ Missing | If you produce 7,000 of 10,000, auto-create backorder for remaining 3,000. Currently you'd need manual re-planning. | 🟡 MEDIUM |
| **Make-to-Order (MTO)** | ❌ Missing — planning is manual | Sales order auto-creates production order. Eliminates manual planning step. | 🟡 MEDIUM |
| **Make-to-Stock (MTS) with reorder rules** | ❌ Missing | Auto-trigger production when stock falls below threshold. Your alerts notify but don't auto-create plans. | 🟡 MEDIUM |
| **Multi-step manufacturing** (1/2/3 step routes) | ❌ Missing — production is single-step | Pick components → Produce → Pack. Adds intermediate staging steps for quality checks between operations. | 🟡 MEDIUM |
| **Flexible consumption** | ⚠️ Partial | You track expected vs actual, but there's no UI to consume MORE than BOM quantity. Workers can't over-consume without admin intervention. | 🟡 MEDIUM |
| **Scrap Orders** | ❌ Missing | Dedicated scrap tracking during production. Your wastage_logs capture this but there's no dedicated scrap workflow or scrap location. | 🟡 MEDIUM |
| **Repair Orders** | ❌ Missing | Track rework/repair of defective products. Different from scrap — product is fixed, not discarded. | 🟢 LOW |
| **Manufacturing Lead Times** | ❌ Missing | Define how many days production takes. Used for scheduling and promise dates. | 🟡 MEDIUM |
| **Engineer-to-Order (ETO)** | ❌ Missing | Custom BOMs per project/order. Relevant if you do custom mold work. | 🟢 LOW |

### Integration Recommendation

**Work Orders + MTO + Backorders** are the highest-impact manufacturing additions. Work Orders alone transform your production from "batch committed" to "operation-level tracking" — this is the single biggest capability gap.

---

## 3. WORK CENTERS & SHOP FLOOR

### What Safey-QMS Has
| Feature | Status | Implementation |
|---------|--------|----------------|
| Equipment table | ✅ Built | Separate equipment module (not in scope but exists) |
| Equipment assignment to production | ✅ Built | `process_equipment_id`, `measuring_equipment_id` on production_batches |
| Employee assignment | ⚠️ Partial | Hardcoded mock data, not from DB |

### What Odoo Has (that Safey-QMS doesn't)

| Odoo Feature | Safey-QMS Gap | Business Benefit | Priority |
|-------------|---------------|-----------------|----------|
| **Work Centers** as first-class entities | ❌ Missing | Work centers = machines/stations with capacity, cost/hr, OEE. Your equipment table exists but isn't linked to production routing. | 🔴 HIGH |
| **Capacity planning** | ❌ Missing | Know how many units each machine can produce per shift. Prevents over-scheduling. | 🔴 HIGH |
| **Alternative work centers** | ❌ Missing | If Machine A is busy, auto-route to Machine B. Prevents bottlenecks. | 🟡 MEDIUM |
| **Work center parameters** (setup time, processing time, cost/hr) | ❌ Missing | Calculate true production cost per unit including machine time. Currently you only track material cost. | 🔴 HIGH |
| **Shop Floor App** (tablet UI) | ❌ Missing | Paperless production floor. Workers scan barcodes, start/stop timers, record production in real-time. | 🔴 HIGH |
| **Time tracking** (start/stop/pause) | ❌ Missing | Track actual time per operation. Feed into OEE and cost calculations. | 🔴 HIGH |
| **Worksheets** on work centers | ❌ Missing | Display SOPs, safety instructions, quality checklists directly on the machine's tablet. | 🟡 MEDIUM |
| **Barcode scanning** on shop floor | ❌ Missing | Scan part batches, scan to start/stop production, scan for quality checks. Eliminates manual data entry. | 🔴 HIGH |
| **OEE tracking** (Availability × Performance × Quality) | ❌ Missing | Industry-standard metric for machine efficiency. Your wastage tracking is one component of Quality; OEE adds Availability and Performance. | 🔴 HIGH |
| **IoT integration** | ❌ Missing | Connect sensors, scales, printers to work centers. Auto-capture measurements. | 🟢 LOW |

### Integration Recommendation

**Work Centers + OEE + Shop Floor App** form a package. This is where Odoo's manufacturing maturity really shows. Start with Work Center entities and time tracking — OEE calculations follow naturally.

---

## 4. PLANNING & SCHEDULING

### What Safey-QMS Has
| Feature | Status | Implementation |
|---------|--------|----------------|
| Production planning | ✅ Built | `production_plans` table, plan → execute flow |
| Material requirement calculation | ✅ Built | BOM qty × planned qty → parts + RM requirements |
| Readiness check | ✅ Built | "Ready to produce" vs "Not ready — shopping list" |
| Execute from plan | ✅ Built | Pre-fills production wizard |

### What Odoo Has (that Safey-QMS doesn't)

| Odoo Feature | Safey-QMS Gap | Business Benefit | Priority |
|-------------|---------------|-----------------|----------|
| **MRP Scheduler** (automated) | ❌ Missing — planning is fully manual | Automatically generates production orders based on demand + reorder rules. Runs in background. | 🔴 HIGH |
| **Master Production Schedule (MPS)** | ❌ Missing | Time-phased planning view. See production needs by day/week/month. Aligns sales forecasts with manufacturing capacity. | 🟡 MEDIUM |
| **Gantt chart planning** | ❌ Missing — planning is a list, not visual | Drag-and-drop scheduling. See capacity load per machine over time. Spot bottlenecks visually. | 🟡 MEDIUM |
| **Finite capacity scheduling** | ❌ Missing | Scheduler respects machine capacity limits. Won't over-schedule a machine beyond its throughput. | 🔴 HIGH |
| **Backward/Forward scheduling** | ❌ Missing | Schedule backward from delivery date to find optimal start date. Or forward from today to find delivery date. | 🟡 MEDIUM |
| **Replenishment automation** (auto-RFQ, auto-MO) | ❌ Missing — alerts only, no auto-action | When stock is low, auto-generate purchase requests or production orders. Your alerts notify; Odoo acts. | 🔴 HIGH |
| **Forecasting** | ❌ Missing | Predict future stock needs based on historical consumption patterns. | 🟡 MEDIUM |
| **Lead time management** | ❌ Missing | Vendor lead time, manufacturing lead time, safety lead time. Factor into all planning. | 🟡 MEDIUM |

### Integration Recommendation

**MRP Scheduler + Replenishment Automation** are transformative. This moves Safey-QMS from "user plans → user executes" to "system plans → user confirms." Start with reorder-triggered auto-planning.

---

## 5. QUALITY MANAGEMENT

### What Safey-QMS Has
| Feature | Status | Implementation |
|---------|--------|----------------|
| Inspection form templates | ✅ Built | AI-generated from .docx via MiMo |
| Per-product form association | ✅ Built | `product_inspection_forms` junction |
| Per-batch inspection results | ✅ Built | `inspection_result` on part_batches + production_batches |
| Inspection result aggregation | ✅ Built | ANY fail → Failed, ALL pass → Passed |
| Inspection picker UI | ✅ Built | In parts and production pages |

### What Odoo Has (that Safey-QMS doesn't)

| Odoo Feature | Safey-QMS Gap | Business Benefit | Priority |
|-------------|---------------|-----------------|----------|
| **Quality Control Points** (auto-triggered) | ⚠️ Partial — your forms are manual | Auto-trigger inspections at specific production stages, on receipt, on delivery. No manual "pick a form" needed. | 🔴 HIGH |
| **Multiple check types** (pass/fail, measurement, picture, worksheet) | ⚠️ Partial — your forms are template-based | Measurement checks with tolerance ranges (e.g., dimension 10mm ±0.5mm → auto pass/fail). Picture-based inspections. | 🟡 MEDIUM |
| **Tolerance checks** | ❌ Missing | Define acceptable ranges for measurements. Auto-determine pass/fail. Your current inspection forms don't validate numeric values against limits. | 🔴 HIGH |
| **Quality Alerts** (Kanban) | ❌ Missing — alerts exist but not for quality | Dedicated quality defect tracking with root cause analysis, corrective/preventive actions (CAPA). Your `alerts` table is stock-level focused. | 🟡 MEDIUM |
| **Quality Teams** | ❌ Missing | Assign quality checks to dedicated teams. Dashboard per team showing assigned checks/alerts. | 🟢 LOW |
| **Quality dashboards** | ❌ Missing | Aggregate view of quality metrics: defect rates, root causes, trend analysis. | 🟡 MEDIUM |
| **Statistical process control** | ❌ Missing | SPC charts, control limits, process capability indices. Advanced but valuable for plastics. | 🟢 LOW |
| **Quality checks from shop floor** | ❌ Missing | Workers perform QC directly from the production tablet without leaving the work center. | 🟡 MEDIUM |

### Integration Recommendation

**Tolerance Checks + Auto-triggered Control Points** are the two quality features that directly improve your existing system. Tolerance checks alone make your inspection forms actionable (not just data collection).

---

## 6. INVENTORY MANAGEMENT

### What Safey-QMS Has
| Feature | Status | Implementation |
|---------|--------|----------------|
| Raw material batch tracking | ✅ Built | Full batch lifecycle with auto-numbering |
| Parts inventory | ✅ Built | Stock levels, thresholds, low-stock alerts |
| Product inventory | ✅ Built | Via production batches |
| Other items (consumables) | ✅ Built | Standalone inventory for non-production items |
| FIFO allocation | ✅ Built | In part produce dialog |
| Block/recall cascade | ✅ Built | DB trigger chain |
| Stock overview | ✅ Built | Unified view across all types |
| Stock history | ✅ Built | Per-item history with stats |
| Wastage tracking | ✅ Built | Logged at part and product level |
| Document uploads (COA/PO/Invoice) | ✅ Built | Base64 JSONB storage |
| Low stock alerts | ✅ Built | Via DB triggers |
| Inventory value (basic) | ✅ Built | remaining × rate/kg |

### What Odoo Has (that Safey-QMS doesn't)

| Odoo Feature | Safey-QMS Gap | Business Benefit | Priority |
|-------------|---------------|-----------------|----------|
| **Multiple warehouses** | ❌ Missing — single factory view | If you ever expand to multiple locations (warehouse + factory + showroom), you need separate stock locations with inter-transfer. | 🟢 LOW (for now) |
| **Warehouse locations hierarchy** | ❌ Missing | Organize stock as Factory/Aisle1/Shelf2/Rack3. Currently flat — no physical location tracking. | 🟡 MEDIUM |
| **Putaway rules** | ❌ Missing | Auto-route incoming materials to correct storage location based on product type, capacity, or zone. | 🟡 MEDIUM |
| **Removal strategies** (LIFO, FEFO, Closest, Least Packages) | ⚠️ Partial — FIFO only | FEFO is critical for perishable materials (some plastics degrade). Closest location minimizes picker travel. | 🟡 MEDIUM |
| **Lot/Serial number tracking** | ⚠️ Partial — batch numbers only | Your batch numbers serve this purpose, but there's no per-unit serial tracking. For finished products requiring individual traceability (medical, automotive), serial numbers are mandatory. | 🟡 MEDIUM |
| **Expiration date management** | ❌ Missing | 4-tier system: expiration, best before, removal, alert. Some materials (masterbatch, certain polymers) have shelf lives. | 🟡 MEDIUM |
| **Inventory valuation** (FIFO, AVCO, Standard) | ⚠️ Partial — basic `remaining × rate` only | Your valuation doesn't account for multiple costing methods. AVCO gives accurate per-unit cost as purchase prices fluctuate. | 🔴 HIGH |
| **Landed costs** | ❌ Missing | Include freight, duties, handling in material cost. Currently only `rate/kg` at purchase. | 🟡 MEDIUM |
| **Perpetual inventory valuation** | ❌ Missing | Real-time accounting entries on every stock move. Currently no accounting integration. | 🟡 MEDIUM |
| **Barcode scanning** | ❌ Missing | Scan materials in/out. Eliminates manual data entry errors. GS1/QR support. | 🔴 HIGH |
| **Cycle counting** | ❌ Missing — no physical count workflow | Schedule recurring stock counts for accuracy. Currently no way to reconcile system stock vs physical stock. | 🔴 HIGH |
| **Reorder rules with auto-RFQ** | ❌ Missing — alerts only | Auto-generate purchase requests when stock is low. Your alerts say "low stock" but don't create purchase orders. | 🔴 HIGH |
| **Dropship** | ❌ Missing | Ship directly from supplier to customer without touching your warehouse. | 🟢 LOW |
| **Cross-dock** | ❌ Missing | Receive and immediately ship without storage. Relevant if you do trading/distribution. | 🟢 LOW |
| **Returns management** | ❌ Missing | Customer return workflow with inspection, restock, or dispose. | 🟡 MEDIUM |
| **Scrap tracking** | ⚠️ Partial via wastage_logs | Dedicated scrap location + scrap orders + scrap cost reports. | 🟡 MEDIUM |
| **Multi-step routes** (push/pull rules) | ❌ Missing | Custom receipt/delivery flows: 1-step, 2-step, 3-step. Important as operations grow. | 🟢 LOW |
| **Picking methods** (batch, cluster, wave) | ❌ Missing | Optimize warehouse picking for efficiency. Relevant when you have many SKUs. | 🟢 LOW |
| **Reservation methods** | ❌ Missing | Reserve stock for specific orders. Prevents one order from consuming stock needed by another. | 🟡 MEDIUM |
| **Package management** | ❌ Missing | Track packages with barcodes, multi-package shipments. | 🟢 LOW |
| **Consignment** | ❌ Missing | Manage stock you don't own (supplier-owned inventory in your warehouse). | 🟢 LOW |
| **Shipping connectors** (FedEx, DHL, Shiprocket) | ❌ Missing | Auto-calculate shipping, print labels. Shiprocket is India-specific — relevant for you. | 🟡 MEDIUM |
| **Customer portal** | ❌ Missing | Let customers track their orders, initiate returns. | 🟢 LOW |
| **Stock aging report** | ❌ Missing | See how long each batch has been in stock. Critical for perishable materials and inventory turnover analysis. | 🔴 HIGH |
| **Double-entry inventory** | ❌ Missing | Complete audit trail: every stock move has a source and destination. Your triggers do the math but there's no move-level audit log. | 🔴 HIGH |
| **Audit trail** | ⚠️ Placeholder — `audit.ts` is 3 lines | Log all user actions on inventory. Compliance requirement for QMS. | 🔴 HIGH |
| **Multi-currency** | ❌ Missing | If you buy materials in USD/EUR and sell in INR. | 🟡 MEDIUM |
| **Units of Measure conversion** | ❌ Missing | Buy in tons, use in kg, sell in pieces. Automatic conversion. | 🟡 MEDIUM |
| **Forecasted stock report** | ❌ Missing | Predict when you'll run out based on consumption rate + incoming orders. | 🟡 MEDIUM |
| **Subcontracting** | ❌ Missing | Outsource production to subcontractors with component tracking. | 🟢 LOW |
| **Rental** | ❌ Missing | Not relevant for your business. | ⚪ SKIP |

---

## 7. REPORTING & ANALYTICS

### What Safey-QMS Has
| Feature | Status | Implementation |
|---------|--------|----------------|
| Dashboard KPIs | ✅ Built | `get_dashboard_kpis` RPC |
| Wastage analysis | ✅ Built | `wastage_logs` with percentage calc |
| Traceability (forward + backward) | ✅ Built | Two RPC functions |
| Stock history per item | ✅ Built | Client-side computed stats |
| Alert summary | ✅ Built | By type and severity |

### What Odoo Has (that Safey-QMS doesn't)

| Odoo Feature | Safey-QMS Gap | Business Benefit | Priority |
|-------------|---------------|-----------------|----------|
| **Production cost analysis** (per MO) | ❌ Missing | See true cost per production batch: materials + labor + machine time. Currently only material cost is tracked. | 🔴 HIGH |
| **OEE reporting** | ❌ Missing | Industry-standard machine efficiency metric. | 🔴 HIGH |
| **Inventory aging report** | ❌ Missing | Identify slow-moving or aging stock before it expires/degrades. | 🔴 HIGH |
| **Stock valuation report** | ⚠️ Basic — `remaining × rate` | Proper valuation with FIFO/AVCO/Standard methods. Balance sheet integration. | 🔴 HIGH |
| **Allocation reports** | ❌ Missing | See which MOs have reserved which materials. Prevents double-allocation. | 🟡 MEDIUM |
| **Quality reporting** (defect rates, trends) | ❌ Missing | Aggregate quality metrics over time. Identify patterns. | 🟡 MEDIUM |
| **Pivot/graph/list views** | ❌ Missing — all views are tables/cards | Visual analytics: charts, pivot tables, drill-downs. | 🟡 MEDIUM |
| **Custom dashboards** | ❌ Missing | Build role-specific dashboards (production manager, QC, procurement). | 🟡 MEDIUM |
| **Audit trail reporting** | ❌ Missing | Who changed what, when. Compliance requirement. | 🔴 HIGH |

---

## 8. PRIORITY MATRIX

### 🔴 HIGH PRIORITY (Add these first — biggest business impact)

| # | Feature | Effort | Impact | Why |
|---|---------|--------|--------|-----|
| 1 | **Work Centers + Time Tracking** | Medium | 🔥🔥🔥 | Foundation for OEE, cost tracking, capacity planning. Transforms production from batch-level to operation-level visibility. |
| 2 | **Work Orders** (within production) | Medium | 🔥🔥🔥 | Break production into Mix→Mold→Trim→Pack. Each step tracked independently. |
| 3 | **Inventory Valuation** (FIFO/AVCO) | Low-Med | 🔥🔥🔥 | Know your true per-unit cost. Currently you only know material cost, not blended cost across batches at different rates. |
| 4 | **Cycle Counting / Audit Trail** | Low | 🔥🔥🔥 | Compliance requirement for QMS. Know who changed what, reconcile system vs physical stock. |
| 5 | **Barcode Scanning** | Medium | 🔥🔥🔥 | Eliminate manual data entry. Speed up production commits, stock movements, quality checks. |
| 6 | **MRP Scheduler** (auto-planning) | Medium-High | 🔥🔥🔥 | System auto-generates production plans based on reorder rules + demand. Moves from reactive to proactive. |
| 7 | **Reorder Rules → Auto-RFQ** | Low-Med | 🔥🔥 | Auto-generate purchase requests when RM stock is low. Your alerts already detect low stock; this makes them actionable. |
| 8 | **Multi-level BOM + By-Products** | Medium | 🔥🔥 | Sub-assembly tracking + recoverable waste (regrind). Directly relevant to injection molding. |
| 9 | **Quality Tolerance Checks** | Low | 🔥🔥 | Make inspection forms validate measurements against limits. Auto pass/fail. |
| 10 | **Stock Aging Report** | Low | 🔥🔥 | See how long each batch has been sitting. Critical for material shelf life management. |

### 🟡 MEDIUM PRIORITY (Add in phase 2)

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 11 | BOM Versioning / History | Low | Prevents data loss on BOM edits |
| 12 | Manufacturing Backorders | Low | Handle partial production |
| 13 | MTO/MTS with reorder triggers | Medium | Demand-driven production |
| 14 | Quality Alerts (Kanban + CAPA) | Medium | Defect tracking with root cause |
| 15 | Gantt chart planning | Medium | Visual scheduling |
| 16 | Expiration date management | Low | Material shelf life tracking |
| 17 | Landed costs | Low | True material cost including freight |
| 18 | Shipping connectors (Shiprocket) | Medium | India-specific shipping |
| 19 | Multi-currency | Low | USD/EUR material purchases |
| 20 | UoM conversion | Low | Buy in tons, use in kg |
| 21 | Forecasted stock report | Medium | Predict stockouts |
| 22 | Customer portal | Medium | Order tracking for customers |
| 23 | Scrap orders (dedicated) | Low | Formalize scrap tracking |
| 24 | Returns management | Medium | Customer return workflow |
| 25 | BOM substitutes | Low | Alternate part suggestions |

### 🟢 LOW PRIORITY (Add when scaling)

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 26 | Multiple warehouses | Medium | Multi-location support |
| 27 | Subcontracting | Medium | Outsource production |
| 28 | Product variants | Medium | Color/size variants |
| 29 | Phantom BOMs / Kits | Low | Kit selling without manufacturing |
| 30 | Engineer-to-Order | High | Custom BOMs per project |
| 31 | IoT integration | High | Sensor/data collection |
| 32 | Statistical process control | High | Advanced quality analytics |
| 33 | Consignment | Medium | Supplier-owned inventory |
| 34 | Rental | Low | Not applicable |
| 35 | Wave/cluster picking | Medium | Large warehouse optimization |

---

## 9. WHAT SAFEY-QMS DOES BETTER THAN ODOO (in this scope)

Don't overlook your advantages:

| Feature | Safey-QMS Advantage |
|---------|-------------------|
| **Atomic batch recall cascade** | One click blocks RM → parts → production → alerts. Odoo requires manual configuration of traceability rules. Your DB trigger chain is elegant. |
| **FIFO allocation with over-consumption guard** | `commit_production` RPC pre-checks every batch before committing. Prevents race conditions. Odoo's consumption is more flexible but less safe. |
| **AI-generated inspection forms** | MiMo-powered form parsing from .docx. Odoo has no AI form generation — you create forms manually. |
| **Simplicity** | 7-step wizard vs Odoo's 50+ configuration screens. For a single-factory operation, your UX is faster to learn and use. |
| **Wastage tracking at batch level** | Every part batch and production batch logs wastage with reason codes. Odoo tracks wastage but not with this granularity per batch. |
| **COA/PO/Invoice document storage** | Raw material batches store source documents. Odoo requires separate document management module. |

---

## 10. SUGGESTED IMPLEMENTATION PHASES

### Phase 1: Foundation (Weeks 1-3)
- Work Centers table + link to equipment
- Time tracking on production (start/stop timestamps)
- Inventory valuation upgrade (weighted average cost)
- Audit trail (log all inventory mutations)
- Cycle counting workflow

### Phase 2: Intelligence (Weeks 4-6)
- Work Orders (break production into operations)
- OEE calculation from time tracking data
- Reorder rules → auto-production-planning
- Stock aging report
- Quality tolerance checks on inspection forms

### Phase 3: Automation (Weeks 7-9)
- MRP Scheduler (auto-generate plans from reorder rules)
- Barcode scanning (production commits + stock movements)
- Manufacturing backorders
- BOM versioning
- Multi-level BOM + by-products

### Phase 4: Integration (Weeks 10-12)
- Quality alerts Kanban (CAPA)
- Shipping connector (Shiprocket)
- Customer portal (order tracking)
- Gantt chart planning view
- Forecasted stock report

---

*Report compiled from: Safey-QMS codebase audit (30+ files, 15 migrations), Odoo.com MRP features page + tutorial slides (42 lessons, 5h56m), Odoo.com Inventory features page + 17.0 documentation.*
