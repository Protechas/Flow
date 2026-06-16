import { cn } from "@/lib/utils";

export function EnterpriseDataTable({
  children,
  className,
  maxHeight,
  compact,
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("enterprise-table-surface", className)}>
      <div
        className="overflow-auto"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={cn("w-full text-sm", compact && "enterprise-table-compact")}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function EnterpriseTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 enterprise-grid-header">
      {children}
    </thead>
  );
}

export function EnterpriseTh({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

export function EnterpriseTd({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 border-t border-[var(--border-subtle)] text-sm enterprise-row-hover",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}

export function EnterpriseTr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={cn("enterprise-row-hover", className)}>{children}</tr>;
}
