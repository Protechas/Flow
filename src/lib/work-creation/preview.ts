import { calculateProjectPlanningForecast, calculateTaskForecast } from "@/lib/forecast/engine";
import type { ForecastSettings } from "@/types/flow";
import type { WorkCreationMode } from "@/lib/work-creation/types";
import { getBoardTemplate, getProjectTemplate } from "@/lib/work-creation/templates";

export interface CreationPreview {
  mode: WorkCreationMode;
  title: string;
  lines: { label: string; value: string }[];
  enabled: string[];
}

export function buildBoardPreview(input: {
  name: string;
  departmentName: string;
  templateId: string;
  description: string;
}): CreationPreview {
  const tpl = getBoardTemplate(input.templateId);
  return {
    mode: "board",
    title: input.name || "New board",
    lines: [
      { label: "Type", value: "Operations board" },
      { label: "Template", value: tpl.label },
      { label: "Department", value: input.departmentName },
      { label: "Purpose", value: input.description || tpl.purpose },
    ],
    enabled: [
      "Operations board entry",
      "Department scoping",
      "Project & task container",
      "Reporting tracking",
    ],
  };
}

export function buildProjectPreview(input: {
  name: string;
  departmentName: string;
  boardName: string;
  templateId: string;
  ownerName: string;
  docs: number;
  manualDue: string | null;
  forecastSettings: ForecastSettings;
  complexity: string;
}): CreationPreview {
  const tpl = getProjectTemplate(input.templateId);
  const forecast =
    input.docs > 0
      ? calculateProjectPlanningForecast(
          {
            estimated_total_documents: input.docs,
            complexity_level: input.complexity as import("@/types/flow").ForecastComplexityLevel,
            start_date: new Date().toISOString().split("T")[0],
            manual_project_due_date: input.manualDue,
            due_date: input.manualDue,
          },
          { settings: input.forecastSettings }
        )
      : null;

  return {
    mode: "project",
    title: input.name || "New project",
    lines: [
      { label: "Template", value: tpl?.label ?? "Custom" },
      { label: "Department", value: input.departmentName },
      { label: "Board", value: input.boardName || "—" },
      { label: "Owner", value: input.ownerName || "Unassigned" },
      {
        label: "Est. documents",
        value: input.docs > 0 ? input.docs.toLocaleString() : "Not set",
      },
      {
        label: "Planning due",
        value: forecast?.suggested_project_due_date ?? input.manualDue ?? "—",
      },
    ],
    enabled: [
      "Project dashboard entry",
      "Forecast shell",
      "Reporting tracking",
      "Status tracking",
      "QA pipeline connection",
      ...(tpl?.manufacturers?.length ? ["Manufacturer & year matrix"] : []),
    ],
  };
}

export function buildTaskPreview(input: {
  name: string;
  projectName: string;
  assigneeName: string;
  docs: number;
  complexity: string;
  priority: string;
  forecastSettings: ForecastSettings;
}): CreationPreview {
  const forecast =
    input.docs > 0
      ? calculateTaskForecast(
          {
            estimated_document_count: input.docs,
            complexity_level: input.complexity as import("@/types/flow").ForecastComplexityLevel,
            start_date: new Date().toISOString().split("T")[0],
            manual_due_date: null,
            due_date: null,
          },
          { settings: input.forecastSettings }
        )
      : null;

  return {
    mode: "task",
    title: input.name || "New task",
    lines: [
      { label: "Project", value: input.projectName },
      { label: "Assignee", value: input.assigneeName || "Unassigned" },
      { label: "Est. documents", value: input.docs > 0 ? String(input.docs) : "Not set" },
      { label: "Complexity", value: input.complexity },
      { label: "Priority", value: input.priority },
      { label: "Planning due", value: forecast?.suggested_due_date ?? "—" },
    ],
    enabled: [
      "Forecast workload",
      "Planning due date",
      "Active forecast on start",
      "Reporting metrics",
      "QA tracking",
      "File uploads",
      "Task timer connection",
    ],
  };
}
