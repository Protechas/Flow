import type { Manufacturer, Project, WorkPackage } from "@/types/flow";
import type { ProjectWorkspaceConfig, WorkspaceColumnDef } from "@/lib/projects/workspace-types";

const MARKER = "[[FLOW_WORKSPACE:v1]]";
const CF_MARKER = "[[FLOW_CF:v1]]";

export const DEFAULT_WORKSPACE_COLUMNS: WorkspaceColumnDef[] = [
  { id: "title", label: "Task", type: "text", builtIn: "title", visible: true, width: 280 },
  { id: "owner", label: "Assign", type: "person", builtIn: "assigned_to", visible: true, width: 140 },
  { id: "status", label: "Status", type: "status", builtIn: "status", visible: true, width: 130 },
  { id: "priority", label: "Priority", type: "dropdown", builtIn: "priority", visible: true, width: 110 },
  { id: "due", label: "Due Date", type: "date", builtIn: "due_date", visible: true, width: 120 },
  { id: "hours", label: "Hours", type: "hours", builtIn: "estimated_hours", visible: true, width: 90 },
  { id: "docs", label: "Est. files", type: "number", builtIn: "estimated_document_count", visible: true, width: 100 },
  { id: "complexity", label: "Complexity", type: "dropdown", builtIn: "complexity_level", visible: false, width: 120 },
  { id: "files", label: "Files", type: "files", builtIn: "file_count", visible: false, width: 80 },
  { id: "qa", label: "QA", type: "status", builtIn: "qa_status", visible: false, width: 100 },
  { id: "progress", label: "Progress", type: "progress", builtIn: "progress", visible: true, width: 110 },
  { id: "created", label: "Created", type: "date", builtIn: "created_at", visible: true, width: 110 },
];

export function encodeWorkspaceConfig(config: ProjectWorkspaceConfig): string {
  return `${MARKER}${JSON.stringify(config)}`;
}

export function parseWorkspaceConfig(description: string | null | undefined): ProjectWorkspaceConfig | null {
  if (!description?.includes(MARKER)) return null;
  const idx = description.indexOf(MARKER);
  try {
    return JSON.parse(description.slice(idx + MARKER.length)) as ProjectWorkspaceConfig;
  } catch {
    return null;
  }
}

export function stripWorkspaceConfig(description: string | null | undefined): string {
  if (!description?.includes(MARKER)) return description?.trim() ?? "";
  return description.slice(0, description.indexOf(MARKER)).trim();
}

export function mergeProjectDescription(
  userDescription: string | null | undefined,
  config: ProjectWorkspaceConfig
): string | null {
  const base = userDescription?.trim() ?? "";
  const encoded = encodeWorkspaceConfig(config);
  const merged = base ? `${base}\n${encoded}` : encoded;
  return merged || null;
}

export function getProjectWorkspaceConfig(
  project: Project,
  manufacturers: Manufacturer[]
): ProjectWorkspaceConfig {
  const parsed = parseWorkspaceConfig(project.description);
  const config: ProjectWorkspaceConfig = parsed ?? {
    version: 1,
    templateId: "legacy",
    tracking: {
      qaRequired: true,
      fileUploads: false,
      dailyReports: false,
      forecasting: true,
      productionTracking: true,
      timeTracking: true,
      wrapUps: true,
      customMetrics: false,
    },
    columns: DEFAULT_WORKSPACE_COLUMNS.map((c) => ({
      ...c,
      visible:
        c.id === "docs"
          ? true
          : c.id === "files"
            ? project.project_type === "special_functions" || project.project_type === "si_corrections"
            : c.visible,
    })),
  };

  if (parsed) {
    const existingIds = new Set(config.columns.map((c) => c.id));
    for (const col of DEFAULT_WORKSPACE_COLUMNS) {
      if (!existingIds.has(col.id)) {
        config.columns.push({ ...col });
      }
    }
  }

  if (config.tracking.forecasting || config.tracking.fileUploads) {
    config.columns = config.columns.map((c) => {
      if (c.id === "docs") return { ...c, visible: true };
      if (c.id === "complexity" && config.tracking.forecasting) return { ...c, visible: true };
      if (c.id === "owner" && c.label === "Owner") return { ...c, label: "Assign" };
      return c;
    });
  } else {
    config.columns = config.columns.map((c) =>
      c.id === "owner" && c.label === "Owner" ? { ...c, label: "Assign" } : c
    );
  }

  return config;
}

export function sectionLabel(manufacturer: Manufacturer): string {
  return manufacturer.name;
}

export function encodeCustomFields(fields: Record<string, unknown>): string {
  return `${CF_MARKER}${JSON.stringify(fields)}`;
}

export function parseCustomFields(description: string | null | undefined): Record<string, string> {
  if (!description?.includes(CF_MARKER)) return {};
  const idx = description.indexOf(CF_MARKER);
  try {
    const raw = JSON.parse(description.slice(idx + CF_MARKER.length)) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

export function mergeTaskCustomFields(
  description: string | null | undefined,
  fields: Record<string, string>
): string | null {
  const base = description?.includes(CF_MARKER)
    ? description.slice(0, description.indexOf(CF_MARKER)).trim()
    : description?.trim() ?? "";
  const encoded = encodeCustomFields(fields);
  return base ? `${base}\n${encoded}` : encoded;
}

export function taskProgress(pkg: WorkPackage): number {
  if (pkg.status === "done") return 100;
  if (pkg.status === "working_on_it" || pkg.status === "in_qa" || pkg.status === "ready_for_qa") return 50;
  if (pkg.status === "stuck" || pkg.status === "correction_needed") return 25;
  return 0;
}
