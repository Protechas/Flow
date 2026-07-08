"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { hasPermission } from "@/lib/auth/permissions";
import { canViewerSeeUser } from "@/lib/auth/team-scope";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore } from "@/lib/data/flow-store";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  deleteEmployeeIncident,
  logEmployeeIncident,
  type IncidentCategory,
  type IncidentSeverity,
} from "@/lib/people/employee-evaluation";

async function assertCanEvaluate(targetUserId: string) {
  const viewer = await requireUser();
  const role = getEffectivePermissionRole(viewer);
  if (viewer.id === targetUserId) throw new Error("FORBIDDEN");
  const canManage =
    hasPermission(role, "people:view_all") || hasPermission(role, "people:view_team");
  if (!canManage) throw new Error("FORBIDDEN");
  await ensureAppDataLoaded();
  const store = getFlowStore();
  if (
    !hasPermission(role, "people:view_all") &&
    !canViewerSeeUser(viewer, targetUserId, store.users, store.teams)
  ) {
    throw new Error("FORBIDDEN");
  }
  return viewer;
}

export async function logEmployeeIncidentAction(input: {
  employeeId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  summary: string;
  notes?: string;
  occurredOn: string;
}) {
  try {
    const viewer = await assertCanEvaluate(input.employeeId);
    if (!input.summary.trim()) {
      return { ok: false as const, message: "A short summary is required." };
    }
    const incident = await logEmployeeIncident({
      employee_id: input.employeeId,
      category: input.category,
      severity: input.severity,
      summary: input.summary,
      notes: input.notes,
      occurred_on: input.occurredOn,
      created_by: viewer.id,
    });
    await writeAuditLog({
      action: "status_changed",
      entityType: "employee_incident",
      entityId: incident.id,
      summary: `Logged ${input.severity} ${input.category} incident for employee`,
      metadata: { employee_id: input.employeeId, category: input.category },
      actorId: viewer.id,
      actorEmail: viewer.email,
    });
    revalidatePath(`/people/${input.employeeId}`);
    return { ok: true as const, incident };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error && e.message !== "FORBIDDEN" ? e.message : "Not permitted.",
    };
  }
}

export async function deleteEmployeeIncidentAction(employeeId: string, incidentId: string) {
  try {
    const viewer = await assertCanEvaluate(employeeId);
    await deleteEmployeeIncident(incidentId);
    await writeAuditLog({
      action: "status_changed",
      entityType: "employee_incident",
      entityId: incidentId,
      summary: "Removed employee incident record",
      metadata: { employee_id: employeeId },
      actorId: viewer.id,
      actorEmail: viewer.email,
    });
    revalidatePath(`/people/${employeeId}`);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error && e.message !== "FORBIDDEN" ? e.message : "Not permitted.",
    };
  }
}
