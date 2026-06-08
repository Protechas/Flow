import { isOverdue, isStuck } from "@/lib/scoring/flow-score";
import type {
  OperationsTree,
  Project,
  QaStatus,
  User,
  WorkPackage,
  WorkPriority,
  WorkStatus,
  YearWorkItem,
} from "@/types/flow";
import { isBefore, parseISO, startOfDay, subDays } from "date-fns";

export type OpsSavedViewId =
  | "all"
  | "my_team"
  | "overdue"
  | "ready_for_qa"
  | "correction_needed"
  | "stuck"
  | "completed_week";

export const OPS_SAVED_VIEWS: { id: OpsSavedViewId; label: string }[] = [
  { id: "all", label: "All Work" },
  { id: "my_team", label: "My Team" },
  { id: "overdue", label: "Overdue" },
  { id: "ready_for_qa", label: "Ready for QA" },
  { id: "correction_needed", label: "Correction Needed" },
  { id: "stuck", label: "Stuck Work" },
  { id: "completed_week", label: "Completed This Week" },
];

export interface OpsBoardFilters {
  search: string;
  projectId?: string;
  manufacturerId?: string;
  assignedTo?: string;
  status?: WorkStatus;
  priority?: WorkPriority;
  qaStatus?: QaStatus;
  overdue?: boolean;
  stuck?: boolean;
  correctionNeeded?: boolean;
  viewId: OpsSavedViewId;
}

export const DEFAULT_OPS_FILTERS: OpsBoardFilters = {
  search: "",
  viewId: "all",
};

function isYearOverdue(y: YearWorkItem): boolean {
  if (!y.due_date || y.status === "done") return false;
  return isBefore(parseISO(y.due_date), startOfDay(new Date()));
}

function matchesSearch(
  search: string,
  parts: { project?: string; manufacturer?: string; year?: number; title?: string }
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [parts.project, parts.manufacturer, parts.year?.toString(), parts.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function pkgMatchesView(pkg: WorkPackage, viewId: OpsSavedViewId, teamUserIds: Set<string>): boolean {
  switch (viewId) {
    case "all":
      return true;
    case "my_team":
      return !!pkg.assigned_to && teamUserIds.has(pkg.assigned_to);
    case "overdue":
      return isOverdue(pkg);
    case "ready_for_qa":
      return ["ready_for_qa", "in_qa"].includes(pkg.status);
    case "correction_needed":
      return (
        pkg.status === "correction_needed" ||
        ["minor_correction", "major_correction"].includes(pkg.qa_status)
      );
    case "stuck":
      return isStuck(pkg) || pkg.status === "stuck";
    case "completed_week": {
      if (pkg.status !== "done" || !pkg.completed_date) return false;
      const weekAgo = subDays(new Date(), 7);
      return !isBefore(parseISO(pkg.completed_date), weekAgo);
    }
    default:
      return true;
  }
}

function yearMatchesView(y: YearWorkItem, viewId: OpsSavedViewId, teamUserIds: Set<string>): boolean {
  switch (viewId) {
    case "all":
      return true;
    case "my_team":
      return !!y.assigned_to && teamUserIds.has(y.assigned_to);
    case "overdue":
      return isYearOverdue(y);
    case "ready_for_qa":
      return ["ready_for_qa", "in_qa"].includes(y.status);
    case "correction_needed":
      return y.status === "correction_needed";
    case "stuck":
      return y.status === "stuck";
    case "completed_week":
      return y.status === "done";
    default:
      return true;
  }
}

function pkgMatchesFilters(
  pkg: WorkPackage,
  filters: OpsBoardFilters,
  teamUserIds: Set<string>,
  ctx: { projectName: string; manufacturerName: string }
): boolean {
  if (!matchesSearch(filters.search, {
    project: ctx.projectName,
    manufacturer: ctx.manufacturerName,
    year: pkg.year,
    title: pkg.title,
  })) {
    return false;
  }
  if (filters.projectId && pkg.project_id !== filters.projectId) return false;
  if (filters.manufacturerId && pkg.manufacturer_id !== filters.manufacturerId) return false;
  if (filters.assignedTo && pkg.assigned_to !== filters.assignedTo) return false;
  if (filters.status && pkg.status !== filters.status) return false;
  if (filters.priority && pkg.priority !== filters.priority) return false;
  if (filters.qaStatus && pkg.qa_status !== filters.qaStatus) return false;
  if (filters.overdue && !isOverdue(pkg)) return false;
  if (filters.stuck && !isStuck(pkg) && pkg.status !== "stuck") return false;
  if (
    filters.correctionNeeded &&
    pkg.status !== "correction_needed" &&
    !["minor_correction", "major_correction"].includes(pkg.qa_status)
  ) {
    return false;
  }
  if (!pkgMatchesView(pkg, filters.viewId, teamUserIds)) return false;
  return true;
}

function yearMatchesFilters(
  y: YearWorkItem,
  pkgCount: number,
  filters: OpsBoardFilters,
  teamUserIds: Set<string>,
  ctx: { projectName: string; manufacturerName: string }
): boolean {
  if (
    !matchesSearch(filters.search, {
      project: ctx.projectName,
      manufacturer: ctx.manufacturerName,
      year: y.year,
    })
  ) {
    return false;
  }
  if (filters.projectId && y.project_id !== filters.projectId) return false;
  if (filters.manufacturerId && y.manufacturer_id !== filters.manufacturerId) return false;
  if (filters.assignedTo && y.assigned_to !== filters.assignedTo) return false;
  if (filters.status && y.status !== filters.status) return false;
  if (filters.priority && y.priority !== filters.priority) return false;
  if (filters.overdue && !isYearOverdue(y)) return false;
  if (filters.stuck && y.status !== "stuck") return false;
  if (filters.correctionNeeded && y.status !== "correction_needed") return false;
  if (pkgCount === 0 && !yearMatchesView(y, filters.viewId, teamUserIds)) return false;
  return true;
}

export function filterOperationsTree(
  tree: OperationsTree,
  filters: OpsBoardFilters,
  teamUserIds: string[]
): OperationsTree {
  const teamSet = new Set(teamUserIds);

  return {
    projects: tree.projects
      .map((projNode) => {
        const projectName = projNode.project.name;
        const manufacturers = projNode.manufacturers
          .map((mfrNode) => {
            const manufacturerName = mfrNode.manufacturer.name;
            const ctx = { projectName, manufacturerName };

            const years = mfrNode.years
              .map((yearNode) => {
                const packages = yearNode.packages.filter((pkg) =>
                  pkgMatchesFilters(pkg, filters, teamSet, ctx)
                );
                const yearVisible =
                  packages.length > 0 ||
                  yearMatchesFilters(yearNode.yearWorkItem, packages.length, filters, teamSet, ctx);
                if (!yearVisible) return null;
                return { ...yearNode, packages };
              })
              .filter((y): y is NonNullable<typeof y> => y !== null);

            const mfrVisible =
              years.length > 0 ||
              matchesSearch(filters.search, { project: projectName, manufacturer: manufacturerName });
            if (!mfrVisible) return null;
            if (filters.manufacturerId && mfrNode.manufacturer.id !== filters.manufacturerId) return null;
            return { ...mfrNode, years };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);

        const projVisible =
          manufacturers.length > 0 ||
          matchesSearch(filters.search, { project: projectName });
        if (!projVisible) return null;
        if (filters.projectId && projNode.project.id !== filters.projectId) return null;
        return { ...projNode, manufacturers };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  };
}

export function collectPackageIds(tree: OperationsTree, selectedKeys: Set<string>): string[] {
  const ids: string[] = [];
  for (const proj of tree.projects) {
    const pKey = `proj-${proj.project.id}`;
    const projSelected = selectedKeys.has(pKey);
    for (const mfr of proj.manufacturers) {
      const mKey = `mfr-${mfr.manufacturer.id}`;
      const mfrSelected = projSelected || selectedKeys.has(mKey);
      for (const year of mfr.years) {
        const yKey = `yr-${year.yearWorkItem.id}`;
        const yearSelected = mfrSelected || selectedKeys.has(yKey);
        for (const pkg of year.packages) {
          if (yearSelected || selectedKeys.has(`pkg-${pkg.id}`)) {
            ids.push(pkg.id);
          }
        }
      }
    }
  }
  return [...new Set(ids)];
}

export function getTeamUserIds(currentUser: User, analysts: User[]): string[] {
  const directReports = analysts.filter((a) => a.manager_id === currentUser.id).map((a) => a.id);
  if (directReports.length) return directReports;
  if (currentUser.team_id) {
    return analysts.filter((a) => a.team_id === currentUser.team_id).map((a) => a.id);
  }
  return analysts.map((a) => a.id);
}

export function flattenManufacturers(tree: OperationsTree): { id: string; name: string; projectId: string }[] {
  const out: { id: string; name: string; projectId: string }[] = [];
  for (const p of tree.projects) {
    for (const m of p.manufacturers) {
      out.push({ id: m.manufacturer.id, name: m.manufacturer.name, projectId: p.project.id });
    }
  }
  return out;
}

export function flattenProjects(tree: OperationsTree): Project[] {
  return tree.projects.map((p) => p.project);
}
