"use server";

import { revalidatePath } from "next/cache";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  ensureProjectMetricsHydrated,
  persistMetricDefinition,
  persistMetricValue,
} from "@/lib/data/project-metrics-db";
import {
  canManageProjectMetrics,
  canUpdateProjectMetricValues,
} from "@/lib/metrics/project-metrics-permissions";
import { resolveProjectMetrics } from "@/lib/metrics/project-metrics-resolver";
import {
  archiveProjectMetricDefinition,
  createProjectMetricDefinition,
  getProjectMetricDefinition,
  listProjectMetricDefinitions,
  listProjectMetricValues,
  recordProjectMetricValue,
  reorderProjectMetricDefinitions,
  updateProjectMetricDefinitionRecord,
} from "@/lib/metrics/project-metrics-store";
import { requireUser } from "@/lib/auth/session";
import type { ProjectMetricDefinitionInput } from "@/types/flow";

function getProjectOrThrow(projectId: string) {
  initFlowStore();
  const project = getFlowStore().projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  return project;
}

export async function listProjectMetricsAction(projectId: string) {
  await requireUser();
  await ensureProjectMetricsHydrated();
  const project = getProjectOrThrow(projectId);
  return resolveProjectMetrics(project);
}

export async function createProjectMetricAction(
  projectId: string,
  input: ProjectMetricDefinitionInput
) {
  const user = await requireUser();
  const project = getProjectOrThrow(projectId);
  if (!canManageProjectMetrics(user)) throw new Error("FORBIDDEN");

  await ensureProjectMetricsHydrated();
  const created = createProjectMetricDefinition(projectId, input);
  await persistMetricDefinition(created);
  revalidatePath("/projects");
  revalidatePath("/executive");
  return created;
}

export async function updateProjectMetricAction(
  metricId: string,
  input: Partial<ProjectMetricDefinitionInput>
) {
  const user = await requireUser();
  const existing = getProjectMetricDefinition(metricId);
  if (!existing) throw new Error("Metric not found");
  getProjectOrThrow(existing.project_id);
  if (!canManageProjectMetrics(user)) throw new Error("FORBIDDEN");

  const updated = updateProjectMetricDefinitionRecord(metricId, input);
  if (updated) await persistMetricDefinition(updated);
  revalidatePath("/projects");
  revalidatePath("/executive");
  return updated;
}

export async function archiveProjectMetricAction(metricId: string) {
  const user = await requireUser();
  const existing = getProjectMetricDefinition(metricId);
  if (!existing) throw new Error("Metric not found");
  if (!canManageProjectMetrics(user)) throw new Error("FORBIDDEN");

  const archived = archiveProjectMetricDefinition(metricId);
  if (archived) await persistMetricDefinition(archived);
  revalidatePath("/projects");
  return archived;
}

export async function reorderProjectMetricsAction(projectId: string, orderedIds: string[]) {
  const user = await requireUser();
  getProjectOrThrow(projectId);
  if (!canManageProjectMetrics(user)) throw new Error("FORBIDDEN");

  const reordered = reorderProjectMetricDefinitions(projectId, orderedIds);
  for (const def of reordered) await persistMetricDefinition(def);
  revalidatePath("/projects");
  return reordered;
}

export async function updateProjectMetricValueAction(metricId: string, value: string) {
  const user = await requireUser();
  const existing = getProjectMetricDefinition(metricId);
  if (!existing) throw new Error("Metric not found");
  const project = getProjectOrThrow(existing.project_id);
  if (!canUpdateProjectMetricValues(user, project)) throw new Error("FORBIDDEN");
  if (existing.is_formula) throw new Error("Calculated metrics cannot be edited manually.");

  const entry = recordProjectMetricValue(metricId, value, user.id);
  const updated = getProjectMetricDefinition(metricId);
  if (updated) await persistMetricDefinition(updated);
  await persistMetricValue(entry);
  revalidatePath("/projects");
  revalidatePath("/executive");
  return entry;
}

export async function listProjectMetricHistoryAction(metricId: string) {
  await requireUser();
  await ensureProjectMetricsHydrated();
  return listProjectMetricValues(metricId, 30);
}

export async function listProjectMetricDefinitionsAction(projectId: string) {
  await requireUser();
  await ensureProjectMetricsHydrated();
  return listProjectMetricDefinitions(projectId);
}
