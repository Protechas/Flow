"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import type { WorkPackage } from "@/types/flow";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

export function EmployeeTaskSection({
  title,
  description,
  tasks,
  emptyLabel,
  highlight,
  urgent,
  collapsed: defaultCollapsed,
}: {
  title: string;
  description: string;
  tasks: WorkPackage[];
  emptyLabel: string;
  highlight?: boolean;
  urgent?: boolean;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={cn(
        "enterprise-panel overflow-hidden",
        urgent && tasks.length > 0 && "border-amber-500/30",
        highlight && tasks.length > 0 && "border-primary/30"
      )}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left enterprise-row-hover transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <h2 className="flow-section-title">{title}</h2>
          <p className="flow-meta">{description}</p>
        </div>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground">{tasks.length}</span>
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </span>
      </button>
      {open && (
        <ul className="border-t border-border divide-y divide-border">
          {tasks.length === 0 ? (
            <li className="px-4 py-6 flow-helper text-center">{emptyLabel}</li>
          ) : (
            tasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/work/${t.id}`}
              prefetch={false}
                  className="flex items-center gap-3 px-4 py-2.5 enterprise-row-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="flow-meta truncate">
                      {t.project?.name} · {t.manufacturer?.name} · {t.year}
                    </p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} size="sm" />
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
