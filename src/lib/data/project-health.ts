import { projectRollup } from "@/lib/hierarchy/rollups";
import { getMockStore } from "@/lib/data/mock-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
} from "@/lib/data/production-tracking";
import { ensureProductionTrackingHydrated } from "@/lib/data/production-tracking-db";
import { isOverdue, isStuck } from "@/lib/scoring/flow-score";
import { productiveDayCapacityHours } from "@/lib/forecast/capacity";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { ensureProjectMetricsHydrated } from "@/lib/data/project-metrics-db";
import { resolveProjectMetrics } from "@/lib/metrics/project-metrics-resolver";
import { buildProjectEarlyWarningMap } from "@/lib/forecast/project-early-warning";
import type { ProjectEarlyWarning } from "@/lib/forecast/project-early-warning";
import { buildProgramIntelligence, type ProgramIntelligence } from "@/lib/projects/project-intelligence";
import type { ProjectWithStats } from "@/lib/projects/portfolio-utils";
import type {
  ProjectHealth,
  ProjectHoldup,
  ProjectPersonPulse,
  ProjectRemainingBreakdown,
  User,
  WorkPackage,
} from "@/types/flow";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

const CORRECTION_QA = new Set(["correction_needed", "minor_correction", "major_correction", "rejected"]);

/** Only surface "waiting" as a holdup once it has sat this long. */
const WAITING_HOLDUP_DAYS = 3;

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = parseISO(iso);
  return isNaN(d.getTime()) ? 0 : Math.max(0, differenceInCalendarDays(new Date(), d));
}

/** Per-person live position: current task (timer beats status), counts, hours. */
function buildPeoplePulse(
  analystIds: string[],
  users: User[],
  projectPkgs: WorkPackage[]
): ProjectPersonPulse[] {
  const projectPkgIds = new Set(projectPkgs.map((p) => p.id));

  return analystIds
    .map((id) => {
      const person = users.find((u) => u.id === id);
      const mine = projectPkgs.filter((p) => p.assigned_to === id);
      const done = mine.filter((p) => p.status === "done");

      const timer = getActiveTaskTimeEntry(id);
      const liveTask =
        timer && timer.status === "active" && projectPkgIds.has(timer.task_id)
          ? projectPkgs.find((p) => p.id === timer.task_id) ?? null
          : null;
      const workingOn =
        liveTask ??
        [...mine]
          .filter((p) => p.status === "working_on_it")
          .sort((a, b) =>
            (b.started_at ?? b.assigned_at ?? "").localeCompare(a.started_at ?? a.assigned_at ?? "")
          )[0] ??
        null;

      return {
        userId: id,
        name: person?.full_name ?? id,
        isClockedIn: Boolean(getActiveClockEntry(id)),
        activeTaskId: workingOn?.id ?? null,
        activeTaskTitle: workingOn?.title ?? null,
        activeTaskIsLive: liveTask != null,
        doneCount: done.length,
        openCount: mine.length - done.length,
        totalCount: mine.length,
        hoursLogged: Math.round(mine.reduce((s, p) => s + p.actual_hours, 0) * 10) / 10,
      };
    })
    .sort((a, b) => Number(b.activeTaskIsLive) - Number(a.activeTaskIsLive) || a.name.localeCompare(b.name));
}

/** Every open task that is holding the project up, worst first, with the reason named. */
function buildHoldups(
  projectPkgs: WorkPackage[],
  users: User[],
  manufacturerNames: Map<string, string>
): ProjectHoldup[] {
  const holdups: ProjectHoldup[] = [];

  for (const pkg of projectPkgs) {
    if (pkg.status === "done") continue;

    const overdueDays = isOverdue(pkg) ? daysSince(pkg.due_date) : 0;
    const idleDays = daysSince(pkg.updated_at);

    let kind: ProjectHoldup["kind"];
    let detail: string;
    let days: number;
    if (isStuck(pkg)) {
      kind = "stuck";
      days = idleDays;
      detail = `${days === 0 ? "Stuck · flagged today" : `Stuck · no movement for ${days}d`}${overdueDays ? ` · ${overdueDays}d overdue` : ""}`;
    } else if (CORRECTION_QA.has(pkg.qa_status) || pkg.status === "correction_needed") {
      kind = "correction";
      days = idleDays;
      detail = `QA correction needed${pkg.correction_count > 1 ? ` (×${pkg.correction_count})` : ""}${overdueDays ? ` · ${overdueDays}d overdue` : ""}`;
    } else if (overdueDays > 0) {
      kind = "overdue";
      days = overdueDays;
      detail = `${days}d overdue (due ${format(parseISO(pkg.due_date!), "MMM d")})`;
    } else if (pkg.status === "waiting" && idleDays >= WAITING_HOLDUP_DAYS) {
      kind = "waiting";
      days = idleDays;
      detail = `Waiting for ${days}d`;
    } else {
      continue;
    }

    holdups.push({
      taskId: pkg.id,
      title: pkg.title,
      manufacturer: manufacturerNames.get(pkg.manufacturer_id) ?? null,
      assigneeName: pkg.assigned_to
        ? users.find((u) => u.id === pkg.assigned_to)?.full_name ?? null
        : null,
      kind,
      detail,
      days,
    });
  }

  const order: Record<ProjectHoldup["kind"], number> = { stuck: 0, correction: 1, overdue: 2, waiting: 3 };
  return holdups.sort((a, b) => order[a.kind] - order[b.kind] || b.days - a.days);
}

function buildRemaining(projectPkgs: WorkPackage[]): ProjectRemainingBreakdown {
  const count = (statuses: string[]) =>
    projectPkgs.filter((p) => statuses.includes(p.status)).length;
  return {
    notStarted: count(["not_started", "assigned"]),
    inMotion: count(["working_on_it"]),
    waiting: count(["waiting", "stuck"]),
    inQa: count(["ready_for_qa", "in_qa"]),
    correction: count(["correction_needed"]),
    done: count(["done"]),
    total: projectPkgs.length,
  };
}

export async function getProjectHealthList(): Promise<ProjectHealth[]> {
  await hydrateForecastSettings();
  await ensureProjectMetricsHydrated();
  // Live clock/timer state for the people pulse comes from production tracking.
  await ensureProductionTrackingHydrated();
  initFlowStore();
  const forecastSettings = getFlowStore().forecastSettings;
  const store = getMockStore();
  const packages = await getWorkPackages();

  return store.projects.map((project) => {
    const projectPkgs = packages.filter((p) => p.project_id === project.id);
    const rollup = projectRollup(project, projectPkgs, store.manufacturers, store.qaReviews, store.yearWorkItems.filter((y) => y.project_id === project.id));
    const mfrs = store.manufacturers.filter((m) => m.project_id === project.id);

    const manufacturerProgress = mfrs.map((m) => {
      const mfrPkgs = projectPkgs.filter((p) => p.manufacturer_id === m.id);
      const done = mfrPkgs.filter((p) => p.status === "done").length;
      return {
        name: m.name,
        completedPct: mfrPkgs.length ? Math.round((done / mfrPkgs.length) * 100) : 0,
        packages: mfrPkgs.length,
      };
    });

    const hoursLogged = rollup.hoursLogged;
    const estimatedRemaining = Math.max(0, rollup.estimatedHours - hoursLogged);
    const hoursPerDay = productiveDayCapacityHours(forecastSettings);
    const projectedDays =
      estimatedRemaining > 0 ? Math.ceil(estimatedRemaining / hoursPerDay) : 0;

    const analystIds = [...new Set(projectPkgs.map((p) => p.assigned_to).filter(Boolean))] as string[];
    const assignedAnalysts = analystIds.map(
      (id) => store.users.find((u) => u.id === id)?.full_name ?? id
    );
    const manufacturerNames = new Map(mfrs.map((m) => [m.id, m.name]));

    return {
      project,
      overallProgress: rollup.completedPct,
      manufacturerProgress,
      hoursLogged,
      estimatedRemaining,
      qaIssues: projectPkgs.filter((p) =>
        ["correction_needed", "minor_correction", "major_correction", "rejected"].includes(p.qa_status)
      ).length,
      blockedCount: rollup.stuckCount,
      overdueCount: rollup.overdueCount,
      assignedAnalysts,
      projectedCompletion:
        projectedDays > 0 ? format(addDays(new Date(), projectedDays), "yyyy-MM-dd") : null,
      rollup,
      customMetrics: resolveProjectMetrics(project),
      people: buildPeoplePulse(analystIds, store.users, projectPkgs),
      holdups: buildHoldups(projectPkgs, store.users, manufacturerNames),
      remaining: buildRemaining(projectPkgs),
    };
  });
}

export async function getProjectHealthIntelligenceMap(): Promise<Record<string, ProgramIntelligence>> {
  await hydrateForecastSettings();
  initFlowStore();
  const forecastSettings = getFlowStore().forecastSettings;
  const store = getMockStore();
  const packages = await getWorkPackages();
  const map: Record<string, ProgramIntelligence> = {};

  for (const project of store.projects) {
    if (project.status === "archived") continue;
    const projectPkgs = packages.filter((p) => p.project_id === project.id);
    const rollup = projectRollup(
      project,
      projectPkgs,
      store.manufacturers,
      store.qaReviews,
      store.yearWorkItems.filter((y) => y.project_id === project.id)
    );
    const withStats: ProjectWithStats = {
      ...project,
      manufacturerCount: rollup.manufacturerCount,
      yearCount: rollup.yearCount,
      completedPct: rollup.completedPct,
    };
    map[project.id] = buildProgramIntelligence(
      withStats,
      packages,
      store.manufacturers,
      store.yearWorkItems,
      store.qaReviews,
      store.activity,
      forecastSettings
    );
  }

  return map;
}

export async function getProjectEarlyWarningMap(): Promise<Record<string, ProjectEarlyWarning>> {
  await hydrateForecastSettings();
  initFlowStore();
  const store = getMockStore();
  const forecastSettings = getFlowStore().forecastSettings;
  const packages = await getWorkPackages();

  return buildProjectEarlyWarningMap({
    projects: store.projects,
    packages,
    users: store.users,
    settings: forecastSettings,
    qaReviews: store.qaReviews,
  });
}
