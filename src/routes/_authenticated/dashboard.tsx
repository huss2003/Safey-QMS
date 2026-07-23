import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, Boxes, Factory, Users, Wrench, Layers, Bell, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatInline } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fmtKg, fmtNum, fmtDate } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Kpis = {
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

const DEMO_KPIS: Kpis = {
  total_raw_stock_kg: 4820.5,
  active_raw_batches: 14,
  material_types: 4,
  total_finished_goods: 1840,
  total_production_batches: 327,
  todays_batches: 6,
  todays_units: 412,
  todays_wastage_kg: 8.4,
  todays_actual_kg: 96.2,
  vendors_count: 9,
  active_products: 12,
  parts_stock: 5840,
  low_stock_parts: 2,
  low_stock_raw: 1,
  unread_alerts: 3,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    staleTime: 60_000,
    queryFn: async (): Promise<Kpis> => {
      if (typeof window !== "undefined" && (window as any).__TRACE_DEMO) {
        return DEMO_KPIS;
      }
      const { data, error } = await supabase.rpc("get_dashboard_kpis");
      if (error) throw error;
      return data as unknown as Kpis;
    },
  });

  const wastagePct =
    data && Number(data.todays_actual_kg) > 0
      ? (Number(data.todays_wastage_kg) / Number(data.todays_actual_kg)) * 100
      : 0;

  const kpis = [
    {
      to: "/raw-materials" as const,
      label: "Raw material stock",
      value: data ? fmtKg(Number(data.total_raw_stock_kg), 1) : "—",
      sub: data ? `${data.material_types} materials · ${data.active_raw_batches} batches` : "—",
      icon: Layers,
      tone: "default" as const,
    },
    {
      to: "/products" as const,
      label: "Finished goods",
      value: data ? fmtNum(data.total_finished_goods) : "—",
      sub: data ? `${data.active_products} active products` : "—",
      icon: Boxes,
      tone: "default" as const,
    },
    {
      to: "/production" as const,
      label: "Today's production",
      value: data ? fmtNum(data.todays_units) : "—",
      sub: data
        ? `${data.todays_batches} batches · ${fmtNum(data.total_production_batches)} all-time`
        : "—",
      icon: Factory,
      tone: "default" as const,
    },
    {
      to: "/vendors" as const,
      label: "Vendors",
      value: data ? fmtNum(data.vendors_count) : "—",
      sub: "Suppliers on file",
      icon: Users,
      tone: "default" as const,
    },
    {
      to: "/parts" as const,
      label: "Parts in stock",
      value: data ? fmtNum(data.parts_stock) : "—",
      sub:
        data && data.low_stock_parts > 0
          ? `${data.low_stock_parts} below threshold`
          : "All above threshold",
      icon: Wrench,
      tone: (data && data.low_stock_parts > 0 ? "alert" : "ok") as "alert" | "ok" | "default",
    },
    {
      to: "/raw-materials" as const,
      label: "Raw batches",
      value: data ? fmtNum(data.active_raw_batches) : "—",
      sub: data && data.low_stock_raw > 0 ? `${data.low_stock_raw} running low` : "Healthy",
      icon: Package,
      tone: (data && data.low_stock_raw > 0 ? "alert" : "ok") as "alert" | "ok" | "default",
    },
    {
      to: "/alerts" as const,
      label: "Unread alerts",
      value: data ? fmtNum(data.unread_alerts) : "—",
      sub: data && data.unread_alerts > 0 ? "Action required" : "All clear",
      icon: Bell,
      tone: (data && data.unread_alerts > 0 ? "alert" : "ok") as "alert" | "ok" | "default",
    },
    {
      to: "/reports" as const,
      label: "Today's wastage",
      value: data ? fmtKg(Number(data.todays_wastage_kg), 2) : "—",
      sub:
        data && Number(data.todays_actual_kg) > 0
          ? `${wastagePct.toFixed(1)}% of actual`
          : "No production yet",
      icon: AlertTriangle,
      tone: (wastagePct > 10 ? "alert" : "ok") as "alert" | "ok" | "default",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Operational summary · ${fmtDate(new Date())}`}
        meta={
          data ? (
            <>
              <StatInline label="Today" value={`${fmtNum(data.todays_batches)} batches`} />
              <StatInline label="Units" value={fmtNum(data.todays_units)} />
              <StatInline
                label="Wastage"
                value={fmtKg(Number(data.todays_wastage_kg), 2)}
                tone={wastagePct > 10 ? "alert" : "default"}
              />
              <StatInline
                label="Alerts"
                value={fmtNum(data.unread_alerts)}
                tone={data.unread_alerts > 0 ? "alert" : "ok"}
              />
            </>
          ) : null
        }
        actions={
          <>
            <Button variant="outline" asChild className="h-8 text-[13px]">
              <Link to="/traceability">Trace batch</Link>
            </Button>
            <Button asChild className="h-8 text-[13px]">
              <Link to="/production">Start production</Link>
            </Button>
          </>
        }
      />

      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-3 w-24 mb-3" />
                  <Skeleton className="h-7 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          : data
            ? kpis.map((kpi) => (
                <motion.div key={kpi.label} variants={cardVariants}>
                  <KpiCard {...kpi} />
                </motion.div>
              ))
            : null}
      </motion.div>
    </div>
  );
}

function KpiCard({
  to,
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  to: string;
  label: string;
  value: string;
  sub: string;
  icon: any;
  tone?: "default" | "alert" | "ok";
}) {
  return (
    <Link to={to as any}>
      <Card className="hover:bg-accent/40 transition-colors h-full group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <span className="label-caps group-hover:text-foreground transition-colors">
              {label}
            </span>
            <Icon
              className={cn(
                "h-4 w-4 transition-colors",
                tone === "alert" ? "text-destructive" : "text-muted-foreground",
              )}
            />
          </div>
          <div className="num text-[24px] font-semibold tracking-[-0.01em]">{value}</div>
          <div
            className={cn(
              "mt-1.5 text-[12px]",
              tone === "alert" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {sub}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
