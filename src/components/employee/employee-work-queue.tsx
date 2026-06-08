"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { Button } from "@/components/ui/button";
import {
  compareTaskPriority,
  type EmployeeTaskBoard,
} from "@/lib/employee/task-utils";
import type { EmployeeQueueSort, WorkPackage } from "@/types/flow";
import { cn } from "@/lib/utils";

type QueueTab = "assigned" | "in_progress" | "ready_for_qa" | "correction_needed" | "completed";

const TABS: { id: QueueTab; label: string }[] = [
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "ready_for_qa", label: "Ready for QA" },
  { id: "correction_needed", label: "Corrections" },
  { id: "completed", label: "Completed" },
];

function sortTasks(tasks: WorkPackage[], sort: EmployeeQueueSort): WorkPackage[] {
  const copy = [...tasks];
  if (sort === "priority") return copy.sort(compareTaskPriority);
  if (sort === "due_date") {
    return copy.sort((a, b) => {
      if (!a.due_date && !b.due_date) return compareTaskPriority(a, b);
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }
  return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function tabTasks(board: EmployeeTaskBoard, tab: QueueTab): WorkPackage[] {
  switch (tab) {
    case "assigned":
      return board.myTasks;
    case "in_progress":
      return board.inProgress;
    case "ready_for_qa":
      return board.waitingQa;
    case "correction_needed":
      return board.returned;
    case "completed":
      return board.completed;
  }
}

export function EmployeeWorkQueue({ board }: { board: EmployeeTaskBoard }) {
  const [tab, setTab] = useState<QueueTab>("assigned");
  const [sort, setSort] = useState<EmployeeQueueSort>("priority");

  const tasks = useMemo(
    () => sortTasks(tabTasks(board, tab), sort),
    [board, tab, sort]
  );

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40">
        <h2 className="font-semibold text-base">My queue</h2>
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
          {TABS.map((t) => {
            const count = tabTasks(board, t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors",
                  tab === t.id
                    ? "bg-violet-600 text-white"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 mt-2">
          {(["priority", "due_date", "assigned_date"] as EmployeeQueueSort[]).map((s) => (
            <Button
              key={s}
              variant={sort === s ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => setSort(s)}
            >
              {s === "priority" ? "Priority" : s === "due_date" ? "Due date" : "Assigned"}
            </Button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-border/30">
        {tasks.length === 0 ? (
          <li className="px-4 py-8 text-sm text-muted-foreground text-center">
            Nothing in this queue.
          </li>
        ) : (
          tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/work/${t.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 active:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.project?.name} · {t.manufacturer?.name} · {t.year}
                    {t.due_date && ` · Due ${t.due_date}`}
                  </p>
                </div>
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
