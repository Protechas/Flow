import Link from "next/link";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { Button } from "@/components/ui/button";
import type { WorkPackage } from "@/types/flow";
import { Play } from "lucide-react";

export function EmployeeCurrentTask({ task }: { task: WorkPackage }) {
  return (
    <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">
        Current task
      </p>
      <h2 className="text-lg sm:text-xl font-bold leading-snug">{task.title}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        {task.project?.name} · {task.manufacturer?.name} · {task.year}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.due_date && (
          <span className="text-xs text-muted-foreground">Due {task.due_date}</span>
        )}
      </div>
      <Button
        className="w-full mt-4 h-12 bg-indigo-600 hover:bg-indigo-500"
        render={<Link href={`/work/${task.id}`} />}
      >
        <Play className="h-4 w-4 mr-2" />
        Continue working
      </Button>
    </div>
  );
}
