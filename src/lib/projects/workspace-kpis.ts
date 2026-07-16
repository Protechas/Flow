import { measureProjectPace, remainingDocumentCount } from "@/lib/forecast/engine";
import { taskProgress } from "@/lib/projects/workspace-config";
import type { ProjectTrackingFlags, WorkspaceKpiCard } from "@/lib/projects/workspace-types";
import type { WorkPackage } from "@/types/flow";

export function buildWorkspaceKpis(
  tasks: WorkPackage[],
  tracking: ProjectTrackingFlags
): WorkspaceKpiCard[] {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  const remaining = total - completed;
  const inProgress = tasks.filter((t) => t.status === "working_on_it").length;
  const readyQa = tasks.filter((t) => t.status === "ready_for_qa" || t.status === "in_qa").length;
  const hoursLogged = tasks.reduce((s, t) => s + (t.actual_hours ?? 0), 0);
  const hoursEst = tasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0);
  // Remaining hours from the team's real pace when we have it — planned
  // estimates go stale the moment actuals outrun them, and "estimate minus
  // logged" turns nonsensical once that happens.
  const pace = measureProjectPace(tasks);
  const docsRemaining = remainingDocumentCount(tasks);
  const hoursRemaining =
    pace && docsRemaining > 0
      ? (docsRemaining * pace.minutesPerDocument) / 60
      : Math.max(0, hoursEst - hoursLogged);
  const hoursRemainingHint =
    pace && docsRemaining > 0
      ? `at measured pace (${pace.minutesPerDocument} min/doc)`
      : undefined;
  const docsCompleted = tasks.reduce((s, t) => s + (t.current_documents_completed ?? 0), 0);
  const docsTarget = tasks.reduce((s, t) => s + (t.estimated_document_count ?? 0), 0);
  const qaPassed = tasks.filter((t) => t.qa_status === "passed").length;
  const qaReviewed = tasks.filter(
    (t) =>
      t.qa_status === "passed" ||
      t.qa_status === "rejected" ||
      t.qa_status === "minor_correction" ||
      t.qa_status === "major_correction"
  ).length;
  const qaPct = qaReviewed > 0 ? Math.round((qaPassed / qaReviewed) * 100) : null;
  const avgProgress =
    total > 0
      ? Math.round(tasks.reduce((s, t) => s + taskProgress(t), 0) / total)
      : 0;

  const kpis: WorkspaceKpiCard[] = [
    {
      id: "tasks_complete",
      label: "Tasks complete",
      value: String(completed),
      hint: `${remaining} remaining`,
      tone: completed === total && total > 0 ? "success" : "default",
    },
    {
      id: "tasks_remaining",
      label: "Tasks remaining",
      value: String(remaining),
      hint: inProgress > 0 ? `${inProgress} in progress` : undefined,
    },
    {
      id: "completion",
      label: "Avg completion",
      value: `${avgProgress}%`,
      tone: avgProgress >= 85 ? "success" : avgProgress < 50 ? "warn" : "default",
    },
  ];

  if (tracking.timeTracking) {
    kpis.push(
      {
        id: "hours_logged",
        label: "Hours logged",
        value: hoursLogged.toFixed(1),
      },
      {
        id: "hours_remaining",
        label: "Hours remaining",
        value: hoursRemaining.toFixed(1),
        hint: hoursRemainingHint,
        tone: hoursRemaining > hoursEst * 0.25 ? "warn" : "default",
      }
    );
  }

  if (tracking.qaRequired) {
    kpis.push({
      id: "qa_pct",
      label: "QA pass rate",
      value: qaPct != null ? `${qaPct}%` : "—",
      hint: readyQa > 0 ? `${readyQa} in QA queue` : undefined,
      tone: qaPct != null && qaPct < 85 ? "warn" : "default",
    });
  }

  if (tracking.fileUploads || docsTarget > 0) {
    kpis.push({
      id: "docs",
      label: "Documents completed",
      value: String(docsCompleted),
      hint: docsTarget > 0 ? `of ${docsTarget} planned` : undefined,
    });
  }

  if (tracking.forecasting) {
    const late = tasks.filter(
      (t) => t.due_date_status === "at_risk" || t.due_date_status === "behind_capacity"
    ).length;
    kpis.push({
      id: "forecast_risk",
      label: "Overdue tasks",
      value: String(late),
      tone: late > 0 ? "danger" : "success",
    });
  }

  return kpis.slice(0, 8);
}
