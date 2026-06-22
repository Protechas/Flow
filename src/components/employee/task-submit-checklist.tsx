"use client";

import { useEffect, useState } from "react";
import { getTaskSubmitChecklistAction } from "@/app/actions/employee-workflow";
import type { TaskSubmitChecklist } from "@/lib/employee/submit-checklist";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskSubmitChecklistPanel({
  taskId,
  refreshKey = 0,
}: {
  taskId: string;
  refreshKey?: number;
}) {
  const [checklist, setChecklist] = useState<TaskSubmitChecklist | null>(null);

  useEffect(() => {
    void getTaskSubmitChecklistAction(taskId).then(setChecklist);
  }, [taskId, refreshKey]);

  if (!checklist || checklist.ready) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-xs">
      <p className="font-medium text-sm">Before submitting this task, complete:</p>
      <ul className="space-y-1.5">
        {checklist.items
          .filter((i) => i.required && !i.complete)
          .map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <Circle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>{item.label}</span>
            </li>
          ))}
      </ul>
      {checklist.fileCount < 1 && (
        <p className="text-muted-foreground pt-1">
          Required files must be uploaded before this task can be submitted.
        </p>
      )}
    </div>
  );
}

export function TaskSubmitChecklistInline({ checklist }: { checklist: TaskSubmitChecklist }) {
  if (checklist.ready) {
    return (
      <p className="text-xs text-emerald-400 flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5" />
        Ready to submit
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {checklist.items.map((item) => (
        <p
          key={item.id}
          className={cn(
            "text-xs flex items-center gap-1.5",
            item.complete ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {item.complete ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Circle className="h-3 w-3 text-amber-400" />
          )}
          {item.label}
        </p>
      ))}
    </div>
  );
}
