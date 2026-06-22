"use client";

import { useState } from "react";
import { ActivityFeed } from "@/components/enterprise/activity-feed";
import type { ActivityEvent } from "@/types/flow";
import { ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmployeeActivityHistory({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="enterprise-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/20 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">View Activity History</span>
          {events.length > 0 && (
            <span className="text-xs text-muted-foreground">({events.length})</span>
          )}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-border/60 px-2 py-2">
          <ActivityFeed
            events={events}
            maxItems={15}
            emptyTitle="No activity yet"
            emptyDescription="Updates on your tasks will show up here."
          />
        </div>
      )}
    </section>
  );
}
