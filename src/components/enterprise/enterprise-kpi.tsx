import Link from "next/link";
import { cn } from "@/lib/utils";

export function EnterpriseKpi({
  label,
  value,
  href,
  sublabel,
  warn,
  className,
}: {
  label: string;
  value: string | number;
  href?: string;
  sublabel?: string;
  warn?: boolean;
  className?: string;
}) {
  const inner = (
    <div
      className={cn(
        "enterprise-panel px-4 py-3 min-w-0",
        href && "transition-colors hover:bg-accent/60",
        warn && "border-amber-500/40 bg-amber-500/10",
        className
      )}
    >
      <p className="enterprise-label truncate">{label}</p>
      <p className={cn("enterprise-kpi-value mt-0.5", warn && "text-amber-400")}>{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sublabel}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0">
        {inner}
      </Link>
    );
  }
  return inner;
}
