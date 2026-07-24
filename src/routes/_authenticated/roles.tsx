import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Users, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roles")({
  ssr: false,
  component: RolesLayout,
});

const TABS = [
  { to: "/roles/employees", label: "Employees", icon: Users, end: true },
  { to: "/roles/training", label: "Training Program", icon: GraduationCap, end: false },
] as const;

function RolesLayout() {
  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.end }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors",
              "text-muted-foreground hover:text-foreground",
              "data-[status=active]:border-primary data-[status=active]:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
