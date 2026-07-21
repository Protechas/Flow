import Link from "next/link";
import { formatQueueDueFriendly, isQueueTaskOverdue } from "@/lib/employee/queue";
import { cn } from "@/lib/utils";
import type { WorkPackage } from "@/types/flow";
import { AlertTriangle } from "lucide-react";

export function EmployeeUpNextList({
  tasks,
  max,
}: {
  tasks: WorkPackage[];
  /** Optional display cap — omit to show the full assigned queue. */
  max?: number;
}) {
  const items = max != null ? tasks.slice(0, max) : tasks;
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
        Up Next
      </h2>
      <ul className="space-y-2">
        {items.map((task, index) => {
          const overdue = isQueueTaskOverdue(task);
          return (
            <li key={task.id}>
              <Link
                href={`/work/${task.id}`}
                prefetch={false}
                className={cn(
                  "enterprise-panel flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors",
                  overdue && "border-red-500/40 bg-red-500/5"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold tabular-nums",
                    overdue && "bg-red-500/15 text-red-500"
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{task.title}</p>
                  <p
                    className={cn(
                      "text-sm text-muted-foreground mt-0.5",
                      overdue && "text-red-500 font-medium flex items-center gap-1"
                    )}
                  >
                    {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                    {formatQueueDueFriendly(task)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
