import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function OperationalSignalCard({
  href,
  variant = "healthy",
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  href?: string;
  variant?: "help" | "workload" | "healthy";
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <Icon
        className={cn(
          "h-8 w-8 shrink-0",
          variant === "help" && "text-red-400",
          variant === "workload" && "text-amber-400",
          variant === "healthy" && "text-primary"
        )}
      />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
        {children}
      </div>
    </>
  );

  const cardClass = cn(
    "flow-signal-card enterprise-panel p-4 flex items-center gap-3",
    href && "flow-signal-card-interactive cursor-pointer",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cardClass} data-variant={variant}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={cardClass} data-variant={variant}>
      {inner}
    </div>
  );
}
