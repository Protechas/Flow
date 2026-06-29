import { randomUUID } from "node:crypto";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { createQuickTask } from "@/lib/data/create-work-setup";
import { getFlowStore, initFlowStore, updateWorkPackage } from "@/lib/data/flow-store";
import { persistQuickTaskChain } from "@/lib/data/work-items-db";
import { isCriticalFinding } from "@/lib/validation-center/finding-mapper";
import {
  getMemoryFinding,
  listMemoryFindings,
  upsertMemoryFinding,
} from "@/lib/validation-center/store";
import type {
  ValidationFinding,
  ValidationFindingQaStatus,
  ValidationFindingSeverity,
  ValidationFindingTaskBridge,
} from "@/lib/validation-center/types";
import type { QaResult, WorkPackage, WorkPriority } from "@/types/flow";
import { isValidationDbEnabled } from "@/lib/validation-center/validation-persistence";

let memoryBridges: ValidationFindingTaskBridge[] = [];

function ts() {
  return new Date().toISOString();
}

export function getValidationBridgeMemoryState() {
  return memoryBridges;
}

export function setValidationBridgeMemoryState(bridges: ValidationFindingTaskBridge[]) {
  memoryBridges = bridges;
}

export function severityToPriority(severity: ValidationFindingSeverity): WorkPriority {
  switch (severity) {
    case "critical":
      return "urgent";
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

export function parseYearFromFinding(finding: ValidationFinding): number {
  const ref = finding.affected_record_ref;
  const raw = ref.Year ?? ref.year ?? ref.ModelYear ?? ref.model_year;
  const n = Number(raw);
  if (!Number.isNaN(n) && n >= 1980 && n <= 2100) return Math.floor(n);
  return new Date().getFullYear();
}

export function buildTaskDescription(finding: ValidationFinding): string {
  const lines = [
    "## Validation finding correction",
    "",
    finding.suggested_correction?.trim() || "_No correction notes from the audit engine._",
    "",
    `**Match status:** ${finding.match_status ?? "—"}`,
    `**Root cause:** ${finding.root_cause}`,
    `**Confidence:** ${finding.confidence_score}%`,
  ];

  if (Object.keys(finding.affected_record_ref).length > 0) {
    lines.push(
      "",
      "**Affected record:**",
      "```json",
      JSON.stringify(finding.affected_record_ref, null, 2),
      "```"
    );
  }

  lines.push(
    "",
    "---",
    `Validation finding \`${finding.id}\` · Run \`${finding.validation_run_id}\``
  );
  return lines.join("\n");
}

export function getFindingByWorkItemId(workItemId: string): ValidationFinding | null {
  return listMemoryFindings().find((f) => f.work_item_id === workItemId) ?? null;
}

export function listFindingsWithTasks(): ValidationFinding[] {
  return listMemoryFindings().filter((f) => f.work_item_id);
}

function defaultQaRequired(finding: ValidationFinding): boolean {
  return isCriticalFinding(finding) || finding.severity === "medium";
}

function defaultFilesRequired(finding: ValidationFinding): boolean {
  return finding.root_cause === "library_issue";
}

export async function createTasksFromFindings(input: {
  findingIds: string[];
  projectId: string;
  assignedTo?: string | null;
  createdBy: string;
}): Promise<{ batchId: string; tasks: WorkPackage[]; findings: ValidationFinding[] }> {
  initFlowStore();
  const store = getFlowStore();
  const project = store.projects.find((p) => p.id === input.projectId);
  if (!project) throw new Error("Project not found");

  const batchId = randomUUID();
  const tasks: WorkPackage[] = [];
  const linkedFindings: ValidationFinding[] = [];

  for (const findingId of input.findingIds) {
    const finding = getMemoryFinding(findingId);
    if (!finding) continue;
    if (finding.work_item_id) continue;

    const manufacturerName = finding.manufacturer?.trim() || "General";
    const year = parseYearFromFinding(finding);
    const priority = severityToPriority(finding.severity);

    const description = buildTaskDescription(finding);

    const task = createQuickTask({
      projectId: input.projectId,
      manufacturerName,
      year,
      taskTitle: finding.title,
      assignedTo: input.assignedTo ?? null,
      priority,
      qaRequired: defaultQaRequired(finding),
      filesRequired: defaultFilesRequired(finding),
      notes: description,
    });

    const persistedTask =
      updateWorkPackage(task.id, { description, notes: description }) ?? task;
    await persistQuickTaskChain(persistedTask);

    const updatedFinding: ValidationFinding = {
      ...finding,
      status: "task_created",
      work_item_id: persistedTask.id,
      qa_status: persistedTask.qa_required ? "pending" : "n/a",
      resolution_date: null,
      updated_at: ts(),
    };
    upsertMemoryFinding(updatedFinding);

    const bridge: ValidationFindingTaskBridge = {
      id: randomUUID(),
      validation_finding_id: finding.id,
      work_item_id: persistedTask.id,
      batch_id: batchId,
      created_by: input.createdBy,
      created_at: ts(),
    };
    memoryBridges.push(bridge);

    if (isValidationDbEnabled()) {
      const { persistFindingTaskLink } = await import(
        "@/lib/validation-center/validation-center-db"
      );
      await persistFindingTaskLink(updatedFinding, bridge);
    }

    tasks.push(persistedTask);
    linkedFindings.push(updatedFinding);

    await writeAuditLog({
      action: "project_changed",
      entityType: "validation_finding",
      entityId: finding.id,
      summary: `Created correction task for finding: ${finding.title}`,
      metadata: {
        work_item_id: persistedTask.id,
        batch_id: batchId,
        validation_run_id: finding.validation_run_id,
      },
    });
  }

  if (tasks.length === 0) {
    throw new Error("No tasks were created. Findings may already be linked or not found.");
  }

  return { batchId, tasks, findings: linkedFindings };
}

export async function syncValidationFindingFromWorkPackage(
  workItemId: string,
  event: "ready_for_qa" | "qa_pass" | "qa_fail" | "cancelled",
  qaResult?: QaResult
): Promise<ValidationFinding | null> {
  const finding = getFindingByWorkItemId(workItemId);
  if (!finding) return null;

  const now = ts();
  let updated: ValidationFinding = { ...finding, updated_at: now };

  switch (event) {
    case "ready_for_qa":
      updated = {
        ...updated,
        status: "corrected",
        qa_status: "pending",
      };
      break;
    case "qa_pass":
      updated = {
        ...updated,
        status: "resolved",
        qa_status: "pass",
        resolution_date: now,
      };
      break;
    case "qa_fail":
      updated = {
        ...updated,
        status: "in_review",
        qa_status: "fail",
        resolution_date: null,
      };
      break;
    case "cancelled":
      updated = {
        ...updated,
        status: "open",
        work_item_id: null,
        qa_status: null,
        resolution_date: null,
      };
      break;
  }

  if (qaResult && event === "qa_pass") {
    updated.qa_status = "pass";
  } else if (qaResult && event === "qa_fail") {
    updated.qa_status = "fail";
  }

  upsertMemoryFinding(updated);

  if (isValidationDbEnabled()) {
    const { persistValidationFindingFullUpdate } = await import(
      "@/lib/validation-center/validation-center-db"
    );
    await persistValidationFindingFullUpdate(updated);
  }

  return updated;
}

export function enrichCorrectionViews(
  findings: ValidationFinding[]
): import("@/lib/validation-center/types").ValidationCorrectionView[] {
  initFlowStore();
  const users = getFlowStore().users;
  const packages = getFlowStore().workPackages;

  return findings
    .filter((f) => f.work_item_id)
    .map((f) => {
      const task = packages.find((p) => p.id === f.work_item_id);
      const assignee = task?.assigned_to
        ? users.find((u) => u.id === task.assigned_to)?.full_name ?? task.assigned_to
        : null;
      return {
        ...f,
        task_title: task?.title ?? null,
        task_status: task?.status ?? null,
        task_qa_status: task?.qa_status ?? null,
        task_assignee_name: assignee,
      };
    });
}
