import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";

type Breadcrumb = {
  label: string;
  href: string;
};

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  vendors: "Vendors",
  "raw-materials": "Raw Materials",
  parts: "Parts",
  products: "Products",
  production: "Production",
  "production-new": "New Production",
  "production-planning": "Production Planning",
  stock: "Stock",
  "other-items": "Other Items",
  traceability: "Traceability",
  reports: "Reports",
  alerts: "Alerts",
  "batch-recall": "Batch Recall",
  settings: "Settings",
  dashboard: "Dashboard",
};

function inferLabel(segment: string): string {
  // Check if it's a UUID (entity detail page)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return "Details";
  }
  return (
    ROUTE_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

export function useBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return useMemo(() => {
    if (!pathname || pathname === "/") return [{ label: "Dashboard", href: "/" }];

    const segments = pathname.split("/").filter(Boolean);
    const crumbs: Breadcrumb[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      // Skip parameterized segments like $id in the URL display
      const href = "/" + segments.slice(0, i + 1).join("/");
      crumbs.push({ label: inferLabel(segment), href });
    }

    return crumbs;
  }, [pathname]);
}
