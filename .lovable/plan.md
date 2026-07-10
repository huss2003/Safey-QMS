# Performance Optimization Plan

Scope: fix real bottlenecks in DB, data-fetching, rendering. Skip theatre (Lighthouse chasing, moment.js — unused).

## 1. Database: indexes + RPCs (single migration)

**Indexes** on FKs/hot filters lacking them:
- `raw_materials(vendor_id)`, `(material_type, is_blocked)`, `(purchase_date desc)`
- `part_batches(part_id)`, `(raw_material_batch_id)`, `(created_at desc)`
- `production_batches(product_id)`, `(production_date desc)`, `(status)`, `(created_at desc)`
- `production_batch_parts(production_batch_id)`, `(part_batch_id)`
- `wastage_logs(level, reference_id)`, `(created_at desc)`
- `alerts(is_read, created_at desc)`
- `production_plans(product_id, planned_date)`
- `product_bom(product_id)`

**RPCs** (single round-trip):
- `get_dashboard_kpis()` — totals for raw stock, finished goods, today's production, vendor/part/RM-batch counts, low-stock, wastage %. Replaces 6+ dashboard queries.
- `get_traceability_forward(p_raw_material_id uuid)`, `get_traceability_backward(p_production_batch_id uuid)` — recursive CTE → JSONB chain. Replaces JS-side recursive fetches.
- `get_reports_summary(p_from date, p_to date)` — Reports aggregates.

All `SECURITY DEFINER`, `SET search_path = public`, `STABLE`, granted `authenticated`.

## 2. React Query config

Global in `src/router.tsx`: `staleTime: 30_000`, `gcTime: 5*60_000`, `refetchOnWindowFocus: false`, `retry: 1`.

Overrides:
- Reference data (vendors, parts, products, BOMs): `staleTime: 5*60_000`.
- Alerts badge: `refetchInterval: 60_000`.
- Paginated tables: `placeholderData: keepPreviousData`.

Keys filter-specific: `['raw_materials', { search, material, page }]`.

## 3. Query hygiene

- `select('*')` → explicit columns on list views; `*` only for detail dialogs.
- Server-side pagination `.range(from, to)` + `count: 'exact'` on: Raw Materials, Part Batches, Production, Wastage/Reports, Alerts. Page 25.
- Server-side search `.ilike`/`.or()` on Raw Materials, Parts, Vendors, Production.
- Dashboard: replace client aggregation → `get_dashboard_kpis` RPC.
- Traceability: replace nested per-node fetches → RPCs above.
- Parallelize sequential independent fetches (Production wizard, Reports) via `Promise.all`.

## 4. Component fixes

- Debounce search (300ms) via `useDebouncedValue` — Raw Materials, Parts, Vendors, Production, Alerts.
- Virtualize long tables `@tanstack/react-virtual` when rows > 50 — Raw Materials, Production, Wastage/Reports, Alerts.
- `React.memo` on heavy row components; `useCallback` for handler props crossing memo boundary.
- Route splitting automatic in TanStack Start; verify no route exports its component.
- Reports: lazy-load Recharts via `React.lazy` on chart panels only.
- Icons: named imports from lucide-react (tree-shakeable); no barrel `import *`.

## 5. Realtime & alerts

- Alerts badge: 60s polled count query. Realtime only on Alerts page, filtered `is_read=false`, `removeChannel` cleanup in `useEffect`.

## 6. Triggers

Current triggers minimal (single UPDATE + one wastage log + conditional alert). No rewrite — user reports read latency, not write. Documented intentional non-change.

## 7. Verification

- `EXPLAIN ANALYZE` top 3 slowest queries before/after.
- Manual render check: Dashboard, Traceability, Reports, Raw Materials.
- `bun run build` chunk sizes before/after in README.

## Files touched

- New migration: indexes + 3 RPCs.
- `src/router.tsx` — QueryClient defaults.
- `src/hooks/use-debounced-value.ts` — new.
- `src/components/inventory/virtual-table.tsx` — new thin wrapper.
- `src/routes/_authenticated/dashboard.tsx` — use `get_dashboard_kpis`.
- `src/routes/_authenticated/traceability.tsx` — use RPCs.
- `src/routes/_authenticated/raw-materials.tsx`, `parts.tsx`, `production.tsx`, `vendors.tsx`, `alerts.tsx`, `reports.tsx`, `production-planning.tsx`, `production.new.tsx` — columns, pagination, debounce, memo, parallel.
- `src/routes/__root.tsx` — tighten global realtime if any.
- `package.json` — add `@tanstack/react-virtual`.
- `README.md` — document optimizations + before/after.

**Out of scope** — triggers (not bottleneck), font/image (none used), HTTP/2 (Lovable hosting), bundle visualizer (local tool).
