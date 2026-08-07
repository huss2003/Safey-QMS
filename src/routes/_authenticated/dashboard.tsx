import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Package,
  Boxes,
  Factory,
  Users,
  Wrench,
  Layers,
  Bell,
  AlertTriangle,
  TrendingUp,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCountUp } from "@/hooks/use-count-up";
import { PageHeader, StatInline, StatBadge } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fmtKg, fmtNum, fmtDate } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

/* ───── Types ───── */
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

/* ───── Framer Motion variants ───── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

/* ───── Dashboard ───── */
function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    staleTime: 60_000,
    queryFn: async (): Promise<Kpis> => {
      // Demo mode check — works both client and SSR via import.meta.env
      if (typeof window !== "undefined" && (window as any).__TRACE_DEMO) {
        return DEMO_KPIS;
      }
      try {
        const { data, error } = await supabase.rpc("get_dashboard_kpis");
        if (error) throw error;
        return data as unknown as Kpis;
      } catch {
        // Fall back to demo data when RPC is unavailable (SSR, demo, dev)
        return DEMO_KPIS;
      }
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
      value: data ? Number(data.total_raw_stock_kg) : 0,
      fmt: (v: number) => fmtKg(v, 1),
      sub: data ? `${data.material_types} materials · ${data.active_raw_batches} batches` : "—",
      icon: Layers,
      tone: "default" as const,
    },
    {
      to: "/products" as const,
      label: "Finished goods",
      value: data ? data.total_finished_goods : 0,
      fmt: (v: number) => fmtNum(v),
      sub: data ? `${data.active_products} active products` : "—",
      icon: Boxes,
      tone: "default" as const,
    },
    {
      to: "/production" as const,
      label: "Today's production",
      value: data ? data.todays_units : 0,
      fmt: (v: number) => fmtNum(v),
      sub: data
        ? `${data.todays_batches} batches · ${fmtNum(data.total_production_batches)} all-time`
        : "—",
      icon: Factory,
      tone: "default" as const,
    },
    {
      to: "/vendors" as const,
      label: "Vendors",
      value: data ? data.vendors_count : 0,
      fmt: (v: number) => fmtNum(v),
      sub: "Suppliers on file",
      icon: Users,
      tone: "default" as const,
    },
    {
      to: "/parts" as const,
      label: "Parts in stock",
      value: data ? data.parts_stock : 0,
      fmt: (v: number) => fmtNum(v),
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
      value: data ? data.active_raw_batches : 0,
      fmt: (v: number) => fmtNum(v),
      sub: data && data.low_stock_raw > 0 ? `${data.low_stock_raw} running low` : "Healthy",
      icon: Package,
      tone: (data && data.low_stock_raw > 0 ? "alert" : "ok") as "alert" | "ok" | "default",
    },
    {
      to: "/alerts" as const,
      label: "Unread alerts",
      value: data ? data.unread_alerts : 0,
      fmt: (v: number) => fmtNum(v),
      sub: data && data.unread_alerts > 0 ? "Action required" : "All clear",
      icon: Bell,
      tone: (data && data.unread_alerts > 0 ? "alert" : "ok") as "alert" | "ok" | "default",
    },
    {
      to: "/reports" as const,
      label: "Today's wastage",
      value: data ? Number(data.todays_wastage_kg) : 0,
      fmt: (v: number) => fmtKg(v, 2),
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
      {/* Premium header with gradient */}
      <PageHeader
        title="Dashboard"
        subtitle="Safey Operations"
        description={
          <span className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Operational summary · {fmtDate(new Date())}
          </span>
        }
        gradient
        meta={
          data ? (
            <>
              <StatBadge
                icon={TrendingUp}
                label="Today"
                value={`${fmtNum(data.todays_batches)} batches`}
              />
              <StatBadge icon={Boxes} label="Units" value={fmtNum(data.todays_units)} />
              <StatBadge
                icon={AlertTriangle}
                label="Wastage"
                value={fmtKg(Number(data.todays_wastage_kg), 2)}
              />
            </>
          ) : null
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              asChild
              className="h-8 text-[13px] rounded-lg border-border/60 hover:border-border transition-all"
            >
              <Link to="/traceability">Trace batch</Link>
            </Button>
            <Button
              asChild
              className="h-8 text-[13px] rounded-lg shadow-sm hover:shadow-md transition-all"
            >
              <Link to="/production">Start production</Link>
            </Button>
          </div>
        }
      />

      {/* KPI grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/60">
                <CardContent className="p-4">
                  <Skeleton className="h-3 w-24 mb-3 rounded" />
                  <Skeleton className="h-8 w-32 mb-2 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
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

/* ───── Premium KPI Card with count-up ───── */
function KpiCard({
  to,
  label,
  value,
  fmt,
  sub,
  icon: Icon,
  tone = "default",
}: {
  to: string;
  label: string;
  value: number;
  fmt: (v: number) => string;
  sub: string;
  icon: any;
  tone?: "default" | "alert" | "ok";
}) {
  const { formatted } = useCountUp({
    end: value,
    duration: 900,
    delay: 100,
    formatter: fmt,
  });

  return (
    <Link to={to as any} className="block group">
      <Card
        className={cn(
          "card-hover h-full border-border/60 hover:border-border/90",
          tone === "alert" && "ring-1 ring-destructive/10",
        )}
      >
        <CardContent className="p-4">
          {/* Icon area */}
          <div className="flex items-center justify-between mb-3">
            <span className="label-caps group-hover:text-foreground transition-colors duration-200">
              {label}
            </span>
            <div
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200",
                tone === "alert"
                  ? "bg-destructive/10 text-destructive group-hover:bg-destructive/15"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Animated value */}
          <div
            className={cn(
              "num text-[26px] font-semibold tracking-[-0.02em] leading-none transition-colors",
              tone === "alert" ? "text-destructive" : "text-foreground",
            )}
          >
            {formatted}
          </div>

          {/* Sub label */}
          <div
            className={cn(
              "mt-2 text-[12px] leading-snug transition-colors",
              tone === "alert"
                ? "text-destructive/80"
                : tone === "ok"
                  ? "text-success"
                  : "text-muted-foreground",
            )}
          >
            {sub}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
