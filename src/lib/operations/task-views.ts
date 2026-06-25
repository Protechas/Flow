import { isOverdue } from "@/lib/scoring/flow-score";
import type { OperationsTree, User, WorkPackage } from "@/types/flow";
import { isSameDay, parseISO, startOfDay } from "date-fns";
import type { OpsBoardFilters } from "@/lib/operations/board-filters";
import { filterOperationsTree } from "@/lib/operations/board-filters";

export type OpsGroupingId = "hierarchy" | "today" | "by_program" | "by_person";

export const OPS_GROUPING_MODES: { id: OpsGroupingId; label: string; description: string }[] = [
  { id: "today", label: "Today", description: "Open tasks due today or overdue" },
  { id: "by_program", label: "By Program", description: "Tasks grouped by program" },
  { id: "by_person", label: "By Person", description: "Tasks grouped by assignee" },
  { id: "hierarchy", label: "Hierarchy", description: "Full project tree" },
];

export interface OpsTaskGroup {
  id: string;
  label: string;
  sublabel?: string;
  tasks: WorkPackage[];
}

function flattenPackagesFromTree(tree: OperationsTree): WorkPackage[] {
  const out: WorkPackage[] = [];
  for (const proj of tree.projects) {
    for (const mfr of proj.manufacturers) {
      for (const year of mfr.years) {
        out.push(...year.packages);
      }
    }
  }
  return out;
}

function isDueTodayOrOverdue(pkg: WorkPackage): boolean {
  if (pkg.status === "done") return false;
  if (isOverdue(pkg)) return true;
  const due = pkg.active_due_date ?? pkg.manual_due_date ?? pkg.due_date ?? pkg.suggested_due_date;
  if (!due) return false;
  try {
    return isSameDay(parseISO(due), startOfDay(new Date()));
  } catch {
    return false;
  }
}

function taskSortKey(pkg: WorkPackage): [number, string] {
  const due = pkg.active_due_date ?? pkg.manual_due_date ?? pkg.due_date ?? pkg.suggested_due_date;
  const overdue = isOverdue(pkg) ? 0 : 1;
  return [overdue, due ?? "9999-12-31"];
}

function sortTasks(tasks: WorkPackage[]): WorkPackage[] {
  return [...tasks].sort((a, b) => {
    const [aOver, aDue] = taskSortKey(a);
    const [bOver, bDue] = taskSortKey(b);
    if (aOver !== bOver) return aOver - bOver;
    return aDue.localeCompare(bDue);
  });
}

export function collectFilteredPackages(
  tree: OperationsTree,
  filters: OpsBoardFilters,
  teamUserIds: string[]
): WorkPackage[] {
  const filtered = filterOperationsTree(tree, filters, teamUserIds);
  return flattenPackagesFromTree(filtered);
}

export function buildTodayTasks(packages: WorkPackage[]): WorkPackage[] {
  return sortTasks(packages.filter(isDueTodayOrOverdue));
}

export function buildProgramGroups(packages: WorkPackage[]): OpsTaskGroup[] {
  const byProject = new Map<string, WorkPackage[]>();
  for (const pkg of packages) {
    const list = byProject.get(pkg.project_id) ?? [];
    list.push(pkg);
    byProject.set(pkg.project_id, list);
  }

  return [...byProject.entries()]
    .map(([projectId, tasks]) => ({
      id: projectId,
      label: tasks[0]?.project?.name ?? "Program",
      sublabel: `${tasks.length} open`,
      tasks: sortTasks(tasks.filter((t) => t.status !== "done")),
    }))
    .filter((g) => g.tasks.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildPersonGroups(packages: WorkPackage[], analysts: User[]): OpsTaskGroup[] {
  const open = packages.filter((p) => p.status !== "done");
  const byPerson = new Map<string, WorkPackage[]>();

  for (const pkg of open) {
    const key = pkg.assigned_to ?? "__unassigned__";
    const list = byPerson.get(key) ?? [];
    list.push(pkg);
    byPerson.set(key, list);
  }

  const analystName = (id: string) =>
    analysts.find((a) => a.id === id)?.full_name ?? "Unknown";

  const groups: OpsTaskGroup[] = [...byPerson.entries()].map(([personId, tasks]) => ({
    id: personId,
    label: personId === "__unassigned__" ? "Unassigned" : analystName(personId),
    sublabel: `${tasks.length} open`,
    tasks: sortTasks(tasks),
  }));

  return groups.sort((a, b) => {
    if (a.id === "__unassigned__") return 1;
    if (b.id === "__unassigned__") return -1;
    return a.label.localeCompare(b.label);
  });
}
