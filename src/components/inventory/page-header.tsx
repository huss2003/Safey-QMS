import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  subtitle,
  meta,
  actions,
  gradient,
}: {
  title: ReactNode;
  description?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Apply gradient text to title */
  gradient?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 mb-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          {subtitle && (
            <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1 block">
              {subtitle}
            </span>
          )}
          <h1
            className={cn(
              "text-[20px] font-semibold tracking-[-0.01em] leading-tight",
              gradient && "gradient-text-accent",
            )}
          >
            {title}
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {(description || meta) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {(description || subtitle) && (
            <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
              {description ?? subtitle}
            </p>
          )}
          {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{meta}</div>}
        </div>
      )}
    </div>
  );
}

export function StatInline({
  label,
  value,
  tone = "default",
  pulse,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "alert" | "ok";
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "num font-medium",
          tone === "alert" && "text-destructive",
          tone === "ok" && "text-success",
        )}
      >
        {value}
        {pulse && <PulseDot tone={tone} />}
      </span>
    </div>
  );
}

function PulseDot({ tone }: { tone?: string }) {
  return (
    <span className="ml-1.5 inline-block align-middle">
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full animate-pulse",
          tone === "alert" ? "bg-destructive" : "bg-success",
        )}
      />
    </span>
  );
}

/** Premium stat badge with glass effect */
export function StatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-2 text-[12px]">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-semibold text-foreground">{value}</span>
    </div>
  );
}
