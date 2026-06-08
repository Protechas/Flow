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
        "rounded-xl border overflow-hidden",
        urgent && tasks.length > 0 && "border-orange-500/40 bg-orange-500/5",
        highlight && tasks.length > 0 && "border-indigo-500/40 bg-indigo-500/5",
        !urgent && !highlight && "border-border/60 bg-card/40"
      )}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <h2 className="font-semibold text-base">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground">{tasks.length}</span>
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </span>
      </button>
      {open && (
        <ul className="border-t border-border/40 divide-y divide-border/30">
          {tasks.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center">{emptyLabel}</li>
          ) : (
            tasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/work/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.project?.name} · {t.manufacturer?.name} · {t.year}
                    </p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
