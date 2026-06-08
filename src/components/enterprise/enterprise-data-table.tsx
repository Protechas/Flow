import { cn } from "@/lib/utils";

export function EnterpriseDataTable({
  children,
  className,
  maxHeight,
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div className={cn("enterprise-panel overflow-hidden", className)}>
      <div
        className="overflow-auto"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full text-sm">{children}</table>
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
        "px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap",
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
        "px-3 py-2 border-t border-border text-sm",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}
