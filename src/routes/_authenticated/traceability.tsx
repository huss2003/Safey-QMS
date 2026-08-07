import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Search,
  GitBranch,
  Package,
  Puzzle,
  Factory as FactoryIcon,
  Users as UsersIcon,
  Wrench,
  Download,
  ScanLine,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type {
  RawMaterial,
  PartBatch,
  ProductionBatch,
} from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { MaterialBadge } from "@/components/inventory/material-badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate, fmtKg, fmtNum } from "@/lib/inventory/format";
import { EMPLOYEES, roleLabel } from "@/lib/inventory/employees";

export const Route = createFileRoute("/_authenticated/traceability")({
  component: Traceability,
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    return { q: typeof search.q === "string" ? search.q : undefined };
  },
});

type Kind = "production" | "part" | "raw";
type Result = { kind: Kind; id: string; label: string };

type TraceResultRaw = { id: string; batch_number: string; material_type: string };
type TraceResultPart = { id: string; batch_number: string; parts?: { part_name: string } | null };

// Trace RPC response types
type TraceBackwardPart = {
  part_batch?: {
    id: string;
    batch_number: string;
    part_name: string | null;
    quantity: number;
    quantity_used: number;
    wastage_kg: number | null;
    raw_material?: {
      batch_number: string;
      material_type: string;
      remaining_quantity_kg: number;
      vendor?: {
        name: string;
        phone: string | null;
      } | null;
    } | null;
  } | null;
};

type TraceBackwardResponse = {
  production?: {
    id: string;
    batch_number: string;
    product_name: string;
    quantity_produced: number;
    production_date: string;
    status: string;
    wastage_kg: number | null;
    assigned_employee?: string | null;
    process_equipment_name?: string | null;
    measuring_equipment_name?: string | null;
  } | null;
  parts?: TraceBackwardPart[];
};

type TraceForwardPartBatch = {
  id: string;
  batch_number: string;
  part_name: string | null;
  quantity: number;
  wastage_kg: number | null;
  productions?: {
    id: string;
    batch_number: string;
    product_name: string;
    quantity_produced: number;
    status: string;
    assigned_employee?: string | null;
    process_equipment_name?: string | null;
    measuring_equipment_name?: string | null;
  }[];
};

type TraceForwardResponse = {
  raw_material?: {
    id: string;
    batch_number: string;
    material_type: string;
    remaining_quantity_kg: number;
    vendor?: {
      name: string;
      phone: string | null;
    } | null;
  } | null;
  part_batches?: TraceForwardPartBatch[];
};

function empLabel(val: string | null | undefined): string {
  if (!val) return "—";
  const emp = EMPLOYEES.find((e) => e.value === val);
  if (!emp) return val;
  return `${emp.label} (${roleLabel(emp.role)})`;
}

function Traceability() {
  const { q: initialQ } = useSearch({ from: Route.id });
  const [q, setQ] = useState(initialQ ?? "");
  const debouncedQ = useDebouncedValue(q, 300);
  const [selected, setSelected] = useState<Result | null>(null);

  const { data: matches } = useQuery({
    queryKey: ["trace-search", debouncedQ],
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("production_batches")
        .select("id,batch_number,products(product_name)")
        .ilike("batch_number", `%${debouncedQ}%`)
        .limit(12);
      return (data ?? []).map((x: any) => ({
        kind: "production" as const,
        id: x.id,
        label: `${x.batch_number} · ${x.products?.product_name} (production)`,
      }));
    },
  });

  return (
    <div>
      <PageHeader title="Traceability" subtitle="Full forward and backward batch tracking" />

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by batch number…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          {debouncedQ.length >= 2 && (
            <div className="border rounded-md divide-y">
              {(matches ?? []).length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No matches</div>
              ) : (
                (matches ?? []).map((m) => (
                  <button
                    key={m.kind + m.id}
                    className="w-full text-left p-3 hover:bg-accent text-sm"
                    onClick={() => {
                      setSelected(m);
                      setQ("");
                    }}
                  >
                    {m.label}
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && <TraceView result={selected} />}
    </div>
  );
}

function TraceView({ result }: { result: Result }) {
  const { data } = useQuery({
    queryKey: ["trace", result.kind, result.id],
    staleTime: 60_000,
    queryFn: async () => {
      // Single RPC call replaces the previous N-query embed chain
      if (result.kind === "production") {
        const { data, error } = await (supabase.rpc as any)("get_traceability_backward", {
          p_production_batch_id: result.id,
        });
        if (error) throw error;
        return { mode: "backward" as const, payload: data as unknown as TraceBackwardResponse };
      }
      if (result.kind === "raw") {
        const { data, error } = await (supabase.rpc as any)("get_traceability_forward", {
          p_raw_material_id: result.id,
        });
        if (error) throw error;
        return { mode: "forward" as const, payload: data as unknown as TraceForwardResponse };
      }
      // part: fetch the part batch's raw_material_batch_id, then reuse the forward RPC scoped to just this part batch
      const { data: pb, error: pbErr } = await (supabase.from("part_batches") as any)
        .select("raw_material_batch_id")
        .eq("id", result.id)
        .single();
      if (pbErr) throw pbErr;
      const resp = await (supabase.rpc as any)("get_traceability_forward", {
        p_raw_material_id: pb.raw_material_batch_id,
      });
      if (resp.error) throw resp.error;
      const rawPayload = resp.data as unknown as TraceForwardResponse;
      // Narrow the returned part_batches to just this one for the tree view
      const filtered: TraceForwardResponse = {
        ...rawPayload,
        part_batches: (rawPayload.part_batches ?? []).filter((x) => x.id === result.id),
      };
      return { mode: "forward" as const, payload: filtered };
    },
  });

  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <TraceTree data={data} />
      <ProductSummary data={data} />
      <WastageSummary data={data} />
    </div>
  );
}

function TraceTree({
  data,
}: {
  data: { mode: "forward" | "backward"; payload: TraceBackwardResponse | TraceForwardResponse };
}) {
  const { mode, payload } = data;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="h-4 w-4" />
          <h2>Trace chain</h2>
        </div>
        <div>
          {mode === "backward" ? (
            <BackwardTree payload={payload as TraceBackwardResponse} />
          ) : (
            <ForwardTree payload={payload as TraceForwardResponse} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BackwardTree({ payload }: { payload: TraceBackwardResponse }) {
  const prod = payload?.production;
  if (!prod) return null;
  return (
    <TreeNode
      icon={FactoryIcon}
      title={`Production ${prod.batch_number}`}
      subtitle={`${prod.product_name} × ${fmtNum(prod.quantity_produced)} · ${fmtDate(prod.production_date)}`}
      status={prod.status}
    >
      {prod.assigned_employee && (
        <TreeNode icon={UsersIcon} title={`Employee: ${empLabel(prod.assigned_employee)}`} />
      )}
      {prod.process_equipment_name && (
        <TreeNode icon={Wrench} title={`Process: ${prod.process_equipment_name}`} />
      )}
      {prod.measuring_equipment_name && (
        <TreeNode icon={Wrench} title={`Measuring: ${prod.measuring_equipment_name}`} />
      )}
      {(payload.parts ?? []).map((p) => (
        <TreeNode
          key={p.part_batch?.id}
          icon={Puzzle}
          title={`Part ${p.part_batch?.batch_number}`}
          subtitle={`${p.part_batch?.part_name} — ${fmtNum(p.part_batch?.quantity_used ?? 0)} used`}
        >
          <TreeNode
            icon={Package}
            title={`Raw ${p.part_batch?.raw_material?.batch_number}`}
            subtitle={
              <>
                {p.part_batch?.raw_material?.material_type ? (
                  <MaterialBadge material={p.part_batch.raw_material.material_type} />
                ) : null}{" "}
                · {fmtKg(p.part_batch?.raw_material?.remaining_quantity_kg ?? 0)} remaining
              </>
            }
          >
            <TreeNode
              icon={UsersIcon}
              title={`Vendor ${p.part_batch?.raw_material?.vendor?.name}`}
              subtitle={p.part_batch?.raw_material?.vendor?.phone ?? undefined}
            />
          </TreeNode>
        </TreeNode>
      ))}
    </TreeNode>
  );
}

function ForwardTree({ payload }: { payload: TraceForwardResponse }) {
  const rm = payload?.raw_material;
  if (!rm) return null;
  return (
    <TreeNode
      icon={Package}
      title={`Raw ${rm.batch_number}`}
      subtitle={
        <>
          {<MaterialBadge material={rm.material_type} />} · {fmtKg(rm.remaining_quantity_kg)}{" "}
          remaining
        </>
      }
    >
      <TreeNode
        icon={UsersIcon}
        title={`Vendor ${rm.vendor?.name}`}
        subtitle={rm.vendor?.phone ?? undefined}
      />
      {(payload.part_batches ?? []).map((pb) => (
        <TreeNode
          key={pb.id}
          icon={Puzzle}
          title={`Part ${pb.batch_number}`}
          subtitle={`${pb.part_name} · ${fmtNum(pb.quantity)} units`}
        >
          {(pb.productions ?? []).map((p) => (
            <TreeNode
              key={p.id}
              icon={FactoryIcon}
              title={`Production ${p.batch_number}`}
              subtitle={`${p.product_name} × ${fmtNum(p.quantity_produced)}`}
              status={p.status}
            >
              {p.assigned_employee && (
                <TreeNode icon={UsersIcon} title={`Employee: ${empLabel(p.assigned_employee)}`} />
              )}
              {p.process_equipment_name && (
                <TreeNode icon={Wrench} title={`Process: ${p.process_equipment_name}`} />
              )}
              {p.measuring_equipment_name && (
                <TreeNode icon={Wrench} title={`Measuring: ${p.measuring_equipment_name}`} />
              )}
            </TreeNode>
          ))}
        </TreeNode>
      ))}
    </TreeNode>
  );
}

function TreeNode({
  icon: Icon,
  title,
  subtitle,
  children,
  status,
}: {
  icon: any;
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  status?: string;
}) {
  return (
    <div className="border-l-2 border-border pl-4 ml-2 pt-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{title}</span>
        {status && (
          <Badge
            variant={status === "recalled" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {status}
          </Badge>
        )}
      </div>
      {subtitle && <div className="text-xs text-muted-foreground ml-6">{subtitle}</div>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

function ProductSummary({
  data,
}: {
  data: { mode: "forward" | "backward"; payload: TraceBackwardResponse | TraceForwardResponse };
}) {
  // Only backward mode has production data with GTIN
  if (data.mode !== "backward") return null;
  const prod = (data.payload as TraceBackwardResponse).production;
  if (!prod) return null;

  return <ProductSummaryInner prod={prod} />;
}

function ProductSummaryInner({ prod }: { prod: NonNullable<TraceBackwardResponse["production"]> }) {
  // Fetch GTIN — direct query, no maybeSingle
  const {
    data: product,
    isLoading,
    error: gtinErr,
  } = useQuery({
    queryKey: ["product-gtin", prod.product_name],
    queryFn: async () => {
      console.log("[GTIN] Fetching for:", prod.product_name);
      if (!prod.product_name) {
        console.log("[GTIN] No product_name");
        return null;
      }
      const { data, error } = await supabase
        .from("products" as any)
        .select("gtin")
        .eq("product_name", prod.product_name)
        .limit(1);
      console.log("[GTIN] Raw response:", JSON.stringify(data), "error:", error);
      if (error) return null;
      const result = (data as any[])?.[0] ?? null;
      console.log("[GTIN] Final result:", result);
      return result;
    },
    enabled: !!prod.product_name,
  });

  const gtin = product?.gtin ?? "";
  const qty = Number(prod.quantity_produced) || 1;
  const batchNum = prod.batch_number;
  const statusKey = `trace-status-${batchNum}`;

  // ── Mutable rows with status tracking ──
  const buildRows = (gtinVal: string) => {
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(statusKey) || "[]") as Record<number, string>;
      } catch {
        return {} as Record<number, string>;
      }
    })();
    return Array.from({ length: qty }, (_, i) => {
      const serial = String(i + 1).padStart(4, "0");
      const dateStr = prod.production_date?.slice(0, 10) ?? "";
      const udi = gtinVal
        ? `${gtinVal}(11)${dateStr}(10)${batchNum}(21)${batchNum}-${serial}`
        : "—";
      let ddMmYyyy = "—";
      if (dateStr) {
        const [y, m, d] = dateStr.split("-");
        ddMmYyyy = `${d}/${m}/${y}`;
      }
      return {
        dateOfManufacture: ddMmYyyy,
        gtin: gtinVal || "—",
        serialNumber: serial,
        lotNumber: batchNum,
        udi,
        status: (saved[i] ?? "Pending") as string,
      };
    });
  };

  const [rows, setRows] = useState(() => buildRows(gtin));

  // Rebuild rows when GTIN query completes
  useEffect(() => {
    if (gtin) {
      setRows((prev) => {
        // Only update if rows still have empty gtin (first load)
        const needsUpdate = prev.some((r) => r.gtin === "—");
        if (!needsUpdate) return prev;
        return buildRows(gtin);
      });
    }
  }, [gtin]);

  const updateRowStatus = (index: number, status: string) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, status } : r));
      // ponytail: persist all statuses to localStorage
      const map: Record<number, string> = {};
      next.forEach((r, i) => {
        map[i] = r.status;
      });
      try {
        localStorage.setItem(statusKey, JSON.stringify(map));
      } catch {
        /* quota */
      }
      return next;
    });
  };

  const updateAllRowStatuses = (status: string) => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r, status }));
      const map: Record<number, string> = {};
      next.forEach((r, i) => {
        map[i] = r.status;
      });
      try {
        localStorage.setItem(statusKey, JSON.stringify(map));
      } catch {
        /* quota */
      }
      return next;
    });
  };

  const [scanOpen, setScanOpen] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState("");

  const handleDownloadCsv = () => {
    const header = "Date of batch creation,GTIN,Serial Number,Lot Number,UDI,Status";
    const csvRows = rows.map(
      (r) =>
        `${r.dateOfManufacture},${r.gtin},${r.serialNumber},${r.lotNumber},${r.udi},${r.status}`,
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batchNum}-labels.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // After successful download, update all statuses
    updateAllRowStatuses("Label generated");
    toast.success("CSV downloaded — status updated to Label generated");
  };

  const handleScan = () => {
    const udi = scanInput.trim();
    setScanError("");
    if (!udi) {
      setScanError("Enter a UDI to scan");
      return;
    }
    // Find matching row by UDI
    const matchIndex = rows.findIndex((r) => r.udi === udi);
    if (matchIndex === -1) {
      setScanError("Product not present in this LOT");
      return;
    }
    if (rows[matchIndex].status === "In stock") {
      setScanError("This product is already in stock");
      return;
    }
    // Mark as In stock
    updateRowStatus(matchIndex, "In stock");
    toast.success(`Serial ${rows[matchIndex].serialNumber} marked as In stock`);
    setScanOpen(false);
    setScanInput("");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2>Product summary</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadCsv}>
              <Download className="h-4 w-4 mr-1" /> Label generate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setScanInput("");
                setScanOpen(!scanOpen);
              }}
            >
              <ScanLine className="h-4 w-4 mr-1" /> Scan
            </Button>
          </div>
        </div>

        {/* Scan UDI input */}
        {scanOpen && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Input
                value={scanInput}
                onChange={(e) => {
                  setScanInput(e.target.value);
                  setScanError("");
                }}
                placeholder="Enter UDI to scan…"
                className="flex-1 font-mono text-[13px]"
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                autoFocus
              />
              <Button size="sm" onClick={handleScan}>
                Scan
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setScanOpen(false);
                  setScanError("");
                }}
              >
                Cancel
              </Button>
            </div>
            {scanError && <p className="text-sm text-red-600 mt-1.5">{scanError}</p>}
          </div>
        )}

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date of batch creation</TableHead>
                <TableHead>GTIN</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Lot Number</TableHead>
                <TableHead>UDI</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-[13px] py-2.5">{r.dateOfManufacture}</TableCell>
                  <TableCell className="text-[13px] py-2.5 font-mono">{r.gtin}</TableCell>
                  <TableCell className="text-[13px] py-2.5 font-mono">{r.serialNumber}</TableCell>
                  <TableCell className="text-[13px] py-2.5 font-mono">{r.lotNumber}</TableCell>
                  <TableCell className="text-[12px] py-2.5 font-mono text-muted-foreground max-w-[400px] break-all">
                    {r.udi}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge
                      variant={
                        r.status === "In stock"
                          ? "secondary"
                          : r.status === "Label generated"
                            ? "destructive"
                            : "destructive"
                      }
                      className={`text-[11px] ${
                        r.status === "In stock"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : r.status === "Label generated"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : ""
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function WastageSummary({
  data,
}: {
  data: { mode: "forward" | "backward"; payload: TraceBackwardResponse | TraceForwardResponse };
}) {
  const partWaste =
    data.mode === "backward"
      ? ((data.payload as TraceBackwardResponse).parts?.reduce(
          (s, p) => s + Number(p.part_batch?.wastage_kg ?? 0),
          0,
        ) ?? 0)
      : ((data.payload as TraceForwardResponse).part_batches?.reduce(
          (s, pb) => s + Number(pb.wastage_kg ?? 0),
          0,
        ) ?? 0);
  const productWaste =
    data.mode === "backward"
      ? Number((data.payload as TraceBackwardResponse).production?.wastage_kg ?? 0)
      : 0;
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3">Wastage summary</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-md p-3">
            <div className="label-caps">Part-level wastage</div>
            <div className="text-xl font-bold">{fmtKg(partWaste)}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="label-caps">Product-level wastage</div>
            <div className="text-xl font-bold">{fmtKg(productWaste)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
