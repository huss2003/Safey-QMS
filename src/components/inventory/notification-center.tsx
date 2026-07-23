import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Info, AlertTriangle, ShieldAlert, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/inventory/format";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["alerts", "notifications"],
    queryFn: async () =>
      (
        await supabase
          .from("alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10)
      ).data ?? [],
    refetchInterval: 30_000,
  });

  const unread = (data ?? []).filter((a: any) => !a.is_read).length;

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("alerts").update({ is_read: true }).eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const iconFor = (severity: string) =>
    severity === "info" ? Info : severity === "warning" ? AlertTriangle : ShieldAlert;
  const colorFor = (severity: string) =>
    severity === "info"
      ? "text-blue-500"
      : severity === "warning"
        ? "text-warning"
        : "text-destructive";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-8 w-8 flex items-center justify-center rounded border border-border hover:bg-accent transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-[16px] min-w-[16px] bg-foreground text-background text-[9px] font-bold rounded-full flex items-center justify-center px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAll.mutate()}
            >
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto divide-y">
          {(data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            (data ?? []).map((a: any) => {
              const Icon = iconFor(a.severity);
              const nav = a.alert_type?.includes("raw")
                ? "/raw-materials"
                : a.alert_type?.includes("part")
                  ? "/parts"
                  : a.alert_type?.includes("product")
                    ? "/production"
                    : "/dashboard";
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors",
                    !a.is_read && "bg-primary/5",
                  )}
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: nav });
                  }}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", colorFor(a.severity))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{a.title}</span>
                      {!a.is_read && (
                        <Badge variant="secondary" className="text-[9px] h-[16px]">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(a.created_at)}
                      {!a.is_read && (
                        <button
                          className="ml-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            markOne.mutate(a.id);
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t px-4 py-2">
          <button
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/alerts" });
            }}
          >
            View all alerts
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
