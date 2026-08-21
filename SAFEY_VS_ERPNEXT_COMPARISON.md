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
