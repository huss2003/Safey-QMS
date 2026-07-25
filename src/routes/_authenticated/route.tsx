import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Puzzle,
  Boxes,
  Factory,
  CalendarClock,
  GitBranch,
  BarChart3,
  Bell,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  Warehouse,
  Archive,
  Wrench,
  UserRound,
  GraduationCap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts";
import { GlobalSearch } from "@/components/search/global-search";
import { ShortcutsModal } from "@/components/inventory/shortcuts-modal";
import { NotificationCenter } from "@/components/inventory/notification-center";
import { PageTransition } from "@/components/inventory/page-transition";
import { ThemeToggle } from "@/components/inventory/theme-toggle";
import { ChevronRight, Home } from "lucide-react";

function LayoutNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <h2 className="mt-3 text-lg font-semibold text-foreground">Page not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  notFoundComponent: LayoutNotFound,
});

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "ops" | "insight" | "system";
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "ops" },
  { to: "/vendors", label: "Vendors", icon: Users, group: "ops" },
  { to: "/raw-materials", label: "Raw materials", icon: Package, group: "ops" },
  { to: "/parts", label: "Parts", icon: Puzzle, group: "ops" },
  { to: "/products", label: "Products", icon: Boxes, group: "ops" },
  { to: "/production", label: "Production", icon: Factory, group: "ops" },
  { to: "/equipment", label: "Equipment", icon: Wrench, group: "ops" },
  {
    to: "/production-planning",
    label: "Production planning",
    icon: CalendarClock,
    group: "insight",
  },
  { to: "/stock", label: "Stock", icon: Warehouse, group: "insight" },
  { to: "/other-items", label: "Other items", icon: Archive, group: "ops" },
  { to: "/roles/employees", label: "Employees", icon: UserRound, group: "hr" },
  { to: "/roles/training", label: "Training Program", icon: GraduationCap, group: "hr" },
  { to: "/traceability", label: "Traceability", icon: GitBranch, group: "insight" },
  { to: "/reports", label: "Reports", icon: BarChart3, group: "insight" },
  { to: "/alerts", label: "Alerts", icon: Bell, group: "insight" },
  { to: "/batch-recall", label: "Batch recall", icon: ShieldAlert, group: "system" },
  { to: "/settings", label: "Settings", icon: Settings, group: "system" },
];

function AuthenticatedLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useKeyboardShortcuts();

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-[232px] flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-sidebar-border">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenu={() => setMobileOpen(true)} />
        {!online && (
          <div className="bg-warning text-warning-foreground text-[12px] text-center py-1.5">
            Connection lost — retrying
          </div>
        )}
        <main className="flex-1 w-full max-w-[1400px] mx-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <PageTransition>
                <Outlet />
              </PageTransition>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ShortcutsModal />
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadAlertsCount();

  const grouped = (["ops", "insight", "system", "hr"] as const).map((g) => ({
    group: g,
    items: NAV.filter((n) => n.group === g),
  }));

  return (
    <>
      {/* Brand row — standard, not editorial. */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
        <div className="h-7 w-7 rounded bg-primary text-primary-foreground flex items-center justify-center">
          <Factory className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[13.5px] font-semibold tracking-[-0.005em]">Safey</span>
          <span className="text-[10.5px] text-muted-foreground tracking-[0.04em] uppercase mt-0.5">
            v1.0
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div className="px-2 mb-1 label-caps">
              {group === "ops" ? "Operations" : group === "insight" ? "Insight" : group === "system" ? "System" : "Human Resources"}
            </div>
            <div className="space-y-px">
              {items.map((item) => {
                const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-2 h-8 rounded text-[13px] transition-colors",
                      active
                        ? "bg-sidebar-accent text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                    )}
                  >
                    <item.icon className="h-[14px] w-[14px] shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.to === "/alerts" && unread > 0 && (
                      <span className="num text-[10.5px] bg-foreground text-background px-1.5 h-[16px] inline-flex items-center rounded-sm font-medium">
                        {unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">realtime</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
          <span className="text-[11px] text-muted-foreground">live</span>
        </span>
      </div>
    </>
  );
}

function useUnreadAlertsCount() {
  const { data } = useQuery({
    queryKey: ["alerts", "unread-count"],
    queryFn: async () => {
      if (typeof window !== "undefined" && (window as any).__TRACE_DEMO) return 3;
      const { count, error } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return data ?? 0;
}

function Breadcrumbs({ crumbs }: { crumbs: { label: string; href: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[13px] min-w-0">
      <Link to="/" className="text-muted-foreground hover:text-foreground shrink-0">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.slice(1).map((c, i) => (
        <span key={c.href} className="flex items-center gap-1.5 min-w-0">
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          {i === crumbs.slice(1).length - 1 ? (
            <span className="font-semibold truncate">{c.label}</span>
          ) : (
            <Link
              to={c.href as any}
              className="text-muted-foreground hover:text-foreground truncate"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
function Header({ onMenu }: { onMenu: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const crumbs = useBreadcrumbs();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const email = user?.email ?? "?";
  const handle = email.split("@")[0] ?? "user";

  return (
    <header className="h-14 border-b bg-card flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-30">
      <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onMenu}>
        <Menu className="h-4 w-4" />
      </Button>
      <Breadcrumbs crumbs={crumbs} />
      <div className="flex-1 max-w-[480px] mx-auto">
        <GlobalSearch />
      </div>
      <NotificationCenter />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 pl-1 pr-2 h-8 rounded border border-border hover:bg-accent transition-colors">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-secondary text-foreground text-[10.5px] font-medium">
                {handle.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline text-[12.5px] truncate max-w-[120px]">{handle}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel className="font-normal pb-1">
            <div className="label-caps mb-1">Signed in as</div>
            <div className="text-[13px] truncate font-medium">{email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-[13px]">
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-[13px]">
            Preferences
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={signOut}
            className="text-[13px] text-destructive focus:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
