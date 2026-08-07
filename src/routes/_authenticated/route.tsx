import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
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
  ClipboardCheck,
  Search,
  ChevronRight,
  ChevronDown,
  Home,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts";
import { GlobalSearch } from "@/components/search/global-search";
import { ShortcutsModal } from "@/components/inventory/shortcuts-modal";
import { NotificationCenter } from "@/components/inventory/notification-center";
import { PageTransition } from "@/components/inventory/page-transition";
import { ThemeToggle } from "@/components/inventory/theme-toggle";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

/* ───── 404 ───── */
function LayoutNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center animate-fade-in">
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

/* ───── Navigation config ───── */
type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "ops" | "insight" | "system" | "hr" | "qa";
  children?: NavItem[];
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "ops" },
  {
    to: "/vendors",
    label: "Vendors",
    icon: Users,
    group: "ops",
    children: [{ to: "/raw-materials", label: "Raw materials", icon: Package, group: "ops" }],
  },
  {
    to: "/production",
    label: "Production",
    icon: Factory,
    group: "ops",
    children: [
      { to: "/parts", label: "Set up Part", icon: Puzzle, group: "ops" },
      { to: "/products", label: "Set up Product", icon: Boxes, group: "ops" },
    ],
  },
  { to: "/equipment", label: "Equipment", icon: Wrench, group: "ops" },
  { to: "/other-items", label: "Other items", icon: Archive, group: "ops" },
  {
    to: "/production-planning",
    label: "Production planning",
    icon: CalendarClock,
    group: "insight",
  },
  { to: "/stock", label: "Stock", icon: Warehouse, group: "insight" },
  { to: "/traceability", label: "Traceability", icon: GitBranch, group: "insight" },
  { to: "/udi-registration", label: "Scan UDI", icon: ScanLine, group: "insight" },
  { to: "/reports", label: "Reports", icon: BarChart3, group: "insight" },
  { to: "/alerts", label: "Alerts", icon: Bell, group: "insight" },
  { to: "/roles/employees", label: "Employees", icon: UserRound, group: "hr" },
  { to: "/roles/training", label: "Training Program", icon: GraduationCap, group: "hr" },
  { to: "/batch-recall", label: "Batch recall", icon: ShieldAlert, group: "system" },
  { to: "/settings", label: "Settings", icon: Settings, group: "system" },
  {
    to: "/inspection-form-template",
    label: "Inspection Form Template",
    icon: ClipboardCheck,
    group: "qa",
  },
];

/* ───── Layout ───── */
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
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-sidebar-border">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenu={() => setMobileOpen(true)} />

        {!online && (
          <div className="bg-destructive/10 text-destructive text-[12px] text-center py-1.5 border-b border-destructive/20 animate-fade-in">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              Connection lost — retrying
            </span>
          </div>
        )}

        <main className="flex-1 w-full max-w-[1400px] mx-auto p-5 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
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

/* ───── Sidebar ───── */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadAlertsCount();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const grouped = (["ops", "insight", "system", "hr", "qa"] as const).map((g) => ({
    group: g,
    items: NAV.filter((n) => n.group === g),
  }));

  const groupLabels: Record<string, string> = {
    ops: "Operations",
    insight: "Insight",
    system: "System",
    hr: "Human Resources",
    qa: "Quality Assurance",
  };

  return (
    <>
      {/* Premium brand */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-sidebar-border shrink-0">
        <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <Factory className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[13.5px] font-semibold tracking-[-0.005em]">Safey</span>
          <span className="text-[10.5px] text-muted-foreground tracking-[0.04em] uppercase mt-0.5">
            v1.0
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-5 scrollbar-thin">
        {grouped.map(({ group, items }) =>
          items.length > 0 ? (
            <div key={group}>
              <div className="px-2 mb-1.5">
                <span className="label-caps">{groupLabels[group] ?? group}</span>
              </div>
              <div className="space-y-px">
                {items.map((item) => {
                  const isExpanded = expanded[item.to] ?? false;
                  const hasChildren = item.children && item.children.length > 0;
                  const active =
                    item.to === "/"
                      ? path === "/"
                      : path.startsWith(item.to) &&
                        (item.to === "/" ||
                          path.length <= item.to.length ||
                          path[item.to.length] === "/" ||
                          path[item.to.length] === undefined);

                  if (hasChildren) {
                    return (
                      <div key={item.to}>
                        <div
                          className={cn(
                            "relative flex items-center gap-2.5 px-2 h-8 rounded-[6px] text-[13px] transition-all duration-150",
                            active
                              ? "bg-sidebar-accent text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                          )}
                        >
                          <Link
                            to={item.to}
                            onClick={onNavigate}
                            className="flex items-center gap-2.5 flex-1 min-w-0"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleExpand(item.to);
                            }}
                            className="p-1 rounded hover:bg-sidebar-accent/60 shrink-0"
                          >
                            <ChevronRight
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                                isExpanded && "rotate-90",
                              )}
                            />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="ml-5 space-y-px">
                            {item.children!.map((child) => {
                              const childActive =
                                path.startsWith(child.to) &&
                                (path.length <= child.to.length ||
                                  path[child.to.length] === "/" ||
                                  path[child.to.length] === undefined);
                              return (
                                <NavLink
                                  key={child.to}
                                  item={child}
                                  active={childActive}
                                  onNavigate={onNavigate}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.to}
                      item={item}
                      active={active}
                      unread={item.to === "/alerts" ? unread : 0}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            </div>
          ) : null,
        )}
      </nav>

      {/* Connection status */}
      <div className="px-4 py-3 border-t border-sidebar-border flex items-center justify-between shrink-0">
        <span className="text-[11px] text-muted-foreground">Connection</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="status-dot status-dot--live" />
          <span className="text-[11px] text-muted-foreground">live</span>
        </span>
      </div>
    </>
  );
}

/* ───── Animated nav link ───── */
function NavLink({
  item,
  active,
  unread,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 px-2 h-8 rounded-[6px] text-[13px] transition-all duration-150",
        active
          ? "bg-sidebar-accent text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
      )}
    >
      {/* Active indicator bar */}
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <Icon className="h-[14px] w-[14px] shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>

      {unread > 0 && (
        <span className="num text-[10.5px] bg-foreground text-background px-1.5 h-[16px] inline-flex items-center rounded-sm font-medium leading-none">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

/* ───── Breadcrumbs ───── */
function Breadcrumbs({ crumbs }: { crumbs: { label: string; href: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[13px] min-w-0">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.slice(1).map((c, i) => {
        const isLast = i === crumbs.slice(1).length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            {isLast ? (
              <span className="font-semibold truncate">{c.label}</span>
            ) : (
              <Link
                to={c.href as any}
                className="text-muted-foreground hover:text-foreground truncate transition-colors"
              >
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ───── Header — Glass ───── */
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
    <header className="h-14 glass-header flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-20">
      <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={onMenu}>
        <Menu className="h-4 w-4" />
      </Button>

      <Breadcrumbs crumbs={crumbs} />

      <div className="flex-1 max-w-[480px] mx-auto">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <NotificationCenter />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-1 pr-2 h-8 rounded-lg border border-border/60 hover:bg-accent/10 transition-all duration-150 hover:border-border">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-secondary text-foreground text-[10.5px] font-medium">
                  {handle.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-[12.5px] truncate max-w-[120px]">
                {handle}
              </span>
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
      </div>
    </header>
  );
}

/* ───── Unread alerts ───── */
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
