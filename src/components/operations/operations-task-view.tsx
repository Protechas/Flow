"use client";

import type { ReactNode } from "react";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { TrackingFlagsBadges } from "@/components/work-tracker/tracking-flags-badges";
import { Checkbox } from "@/components/ui/checkbox";
import { userDisplayName } from "@/lib/users/display-name";
import type { OpsTaskGroup } from "@/lib/operations/task-views";
import type { User, WorkPackage } from "@/types/flow";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/scoring/flow-score";
import { Calendar, ChevronRight } from "lucide-react";

interface OperationsTaskViewProps {
  groups: OpsTaskGroup[] | null;
  flatTasks: WorkPackage[] | null;
  analysts: User[];
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectTask: (pkg: WorkPackage) => void;
  activeTaskId?: string;
  showGroups: boolean;
  emptyState?: ReactNode;
}

function TaskRow({
  pkg,
  analysts,
  selected,
  onToggleSelect,
  onSelectTask,
  active,
}: {
  pkg: WorkPackage;
  analysts: User[];
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectTask: (pkg: WorkPackage) => void;
  active: boolean;
}) {
  const key = `pkg-${pkg.id}`;
  const due = pkg.active_due_date ?? pkg.manual_due_date ?? pkg.due_date ?? pkg.suggested_due_date;
  const assignee = pkg.assignee ?? analysts.find((a) => a.id === pkg.assigned_to);

  return (
    <tr
      className={cn(
        "border-b border-border/40 enterprise-row-hover cursor-pointer",
        active && "bg-primary/5"
      )}
      onClick={() => onSelectTask(pkg)}
    >
      <td className="w-8 py-2 pl-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected.has(key)} onCheckedChange={() => onToggleSelect(key)} />
      </td>
      <td className="py-2 pr-3 min-w-[240px]">
        <p className="font-medium text-sm truncate">{pkg.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {pkg.project?.name}
          {pkg.manufacturer?.name ? ` · ${pkg.manufacturer.name}` : ""}
          {pkg.year ? ` · ${pkg.year}` : ""}
        </p>
      </td>
      <td className="py-2 w-[120px]">
        <StatusBadge status={pkg.status} size="sm" />
      </td>
      <td className="py-2 w-[118px] text-xs truncate">
        {assignee ? userDisplayName(assignee) : "—"}
      </td>
      <td className="py-2 w-[90px]">
        <div className="flex flex-col gap-1">
          <PriorityBadge priority={pkg.priority} />
          <TrackingFlagsBadges pkg={pkg} className="flex flex-wrap gap-1" />
        </div>
      </td>
      <td className="py-2 w-[100px] text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            due && isOverdue(pkg) && "text-red-400 font-medium"
          )}
        >
          <Calendar className="h-3 w-3 shrink-0 opacity-60" />
          {due ?? "—"}
        </span>
      </td>
      <td className="py-2 w-8 pr-2">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </td>
    </tr>
  );
}

export function OperationsTaskView({
  groups,
  flatTasks,
  analysts,
  selected,
  onToggleSelect,
  onSelectTask,
  activeTaskId,
  showGroups,
  emptyState,
}: OperationsTaskViewProps) {
  const empty = showGroups
    ? !groups?.some((g) => g.tasks.length > 0)
    : !flatTasks?.length;

  if (empty) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground space-y-4">
        <p>No tasks match this view and your filters.</p>
        {emptyState}
      </div>
    );
  }

  const renderTasks = (tasks: WorkPackage[]) =>
    tasks.map((pkg) => (
      <TaskRow
        key={pkg.id}
        pkg={pkg}
        analysts={analysts}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onSelectTask={onSelectTask}
        active={activeTaskId === pkg.id}
      />
    ));

  return (
    <table className="w-full text-sm border-separate border-spacing-0">
      <thead className="sticky top-0 z-10 enterprise-grid-header">
        <tr className="text-xs text-muted-foreground">
          <th className="w-8 py-2.5 pl-3 bg-secondary" />
          <th className="text-left font-semibold py-2.5 min-w-[240px] bg-secondary">Task</th>
          <th className="text-left font-semibold py-2.5 w-[120px] bg-secondary">Status</th>
          <th className="text-left font-semibold py-2.5 w-[118px] bg-secondary">Assigned</th>
          <th className="text-left font-semibold py-2.5 w-[90px] bg-secondary">Priority</th>
          <th className="text-left font-semibold py-2.5 w-[100px] bg-secondary">Due</th>
          <th className="w-8 py-2.5 bg-secondary" />
        </tr>
      </thead>
      <tbody>
        {showGroups && groups
          ? groups.map((group) => (
              <GroupSection key={group.id} group={group}>
                {renderTasks(group.tasks)}
              </GroupSection>
            ))
          : renderTasks(flatTasks ?? [])}
      </tbody>
    </table>
  );
}

function GroupSection({
  group,
  children,
}: {
  group: OpsTaskGroup;
  children: ReactNode;
}) {
  if (group.tasks.length === 0) return null;
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={7} className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </span>
            {group.sublabel && (
              <span className="text-[11px] text-muted-foreground tabular-nums">{group.sublabel}</span>
            )}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
