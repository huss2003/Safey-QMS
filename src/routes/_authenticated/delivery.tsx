import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck, Clock, CheckCircle2, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

import { db as supabase } from "@/lib/db";
import { PageHeader } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/delivery")({
  component: DeliveryDashboard,
});

// Invoice stages (confirmed): 0 Invoice Created, 1 Shipped, 2 Delivered (Completed merged into Delivered)
const STAGE = {
  CREATED: 0,
  SHIPPED: 1,
  DELIVERED: 2,
} as const;

type FilterKey = "parcels" | "followups" | "deliveries";

type DeliveryRow = {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string | null;
  stage: number;
  stage_updated_at: string | null;
  delivery_tracking_code: string | null;
  delivery_service_provider: string | null;
  created_at: string | null;
};

const STAGE_LABEL: Record<number, string> = {
  0: "Invoice Created",
  1: "Shipped",
  2: "Delivered",
};

const FILTERS: { key: FilterKey; label: string; stage: number; icon: LucideIcon }[] = [
  { key: "parcels", label: "Parcels to Ship", stage: STAGE.CREATED, icon: PackageCheck },
  { key: "followups", label: "Pending Follow-ups", stage: STAGE.SHIPPED, icon: Clock },
  { key: "deliveries", label: "Recent Deliveries", stage: STAGE.DELIVERED, icon: CheckCircle2 },
];

function DeliveryDashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("parcels");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["delivery-dashboard"],
    queryFn: async (): Promise<DeliveryRow[]> => {
      const { data, error } = await supabase
        .from("udi_registrations" as any)
        .select(
          "id, invoice_number, customer_name, invoice_date, stage, stage_updated_at, delivery_tracking_code, delivery_service_provider, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryRow[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { parcels: 0, followups: 0, deliveries: 0 };
    for (const r of rows) {
      if (r.stage === STAGE.CREATED) c.parcels++;
      else if (r.stage === STAGE.SHIPPED) c.followups++;
      else if (r.stage === STAGE.DELIVERED) c.deliveries++;
    }
    return c;
  }, [rows]);

  const activeStage = FILTERS.find((f) => f.key === filter)!.stage;
  const listRows = useMemo(
    () => rows.filter((r) => r.stage === activeStage),
    [rows, activeStage],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader subtitle="Delivery" title="Delivery Dashboard" />
        <Link to="/new-shipment">
          <Button>
            <Plus className="h-4 w-4 mr-1" /> New Shipment
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="text-left"
            >
              <Card className={cn("transition-colors hover:border-primary", active && "border-primary")}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{f.label}</p>
                    <p className="text-3xl font-semibold">{isLoading ? "…" : counts[f.key]}</p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : listRows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No invoices in {FILTERS.find((f) => f.key === filter)!.label}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Courier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listRows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/shipment/$id", params: { id: r.id } })}
                  >
                    <TableCell className="font-mono">{r.invoice_number}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell>{r.invoice_date ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{STAGE_LABEL[r.stage] ?? r.stage}</Badge>
                    </TableCell>
                    <TableCell>{r.delivery_tracking_code ?? "—"}</TableCell>
                    <TableCell>{r.delivery_service_provider ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
