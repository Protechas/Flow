import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function ContextBreadcrumb({
  segments,
  className,
}: {
  segments: BreadcrumbSegment[];
  className?: string;
}) {
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex flex-wrap items-center gap-1", className)}>
      {segments.map((seg, i) => {
        const last = i === segments.length - 1;
        return (
          <span key={`${seg.label}-${i}`} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
            {seg.href && !last ? (
              <Link
                href={seg.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[160px]"
              >
                {seg.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "text-xs truncate max-w-[200px]",
                  last ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {seg.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
