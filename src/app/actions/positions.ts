"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { hasAdminAccess } from "@/lib/auth/access-level";
import { getFlowStore, initFlowStore, updateUser } from "@/lib/data/flow-store";
import { updateUserProfile } from "@/lib/data/users";
import {
  archiveOrgPosition,
  assignUserToPositionRecord,
  createOrgPosition,
  getOrgPositionById,
  listOrgPositions,
  moveOrgPosition,
  updateOrgPosition,
} from "@/lib/positions/store";
import {
  ensureOrgPositionsLoaded,
  insertOrgPositionDb,
  syncUserAssignedPositionDb,
  updateOrgPositionDb,
} from "@/lib/data/org-positions";

import {
  applyPositionAssignmentToStore,
  clearPositionAssignmentFromStore,
  deriveUserFieldsFromPosition,
} from "@/lib/positions/sync";
import type { OrganizationalPosition, OrgPositionInput, OrgPositionStatus } from "@/types/flow";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function revalidateAll() {
  revalidatePath("/", "layout");
}

async function persistPosition(
  positionId: string,
  input: Partial<OrgPositionInput> & { status?: OrgPositionStatus }
) {
  return isSupabaseConfigured()
    ? await updateOrgPositionDb(positionId, input)
    : updateOrgPosition(positionId, input);
}

async function requirePositionManage() {
  return requirePermission("users:manage");
}

export async function listOrgPositionsAction() {
  await requireUser();
  initFlowStore();
  return ensureOrgPositionsLoaded();
}

export async function createOrgPositionAction(input: OrgPositionInput) {
  const actor = await requirePositionManage();
  initFlowStore();
  await ensureOrgPositionsLoaded();

  const position = isSupabaseConfigured()
    ? await insertOrgPositionDb(input)
    : createOrgPosition({
        ...input,
        status: input.status ?? (input.assigned_user_id ? "filled" : "vacant"),
      });

  if (input.assigned_user_id) {
    const users = getFlowStore().users;
    applyPositionAssignmentToStore(
      input.assigned_user_id,
      position.id,
      users,
      (userId, fields) => updateUser(userId, fields)
    );
    const derived = deriveUserFieldsFromPosition(position, listOrgPositions(), users);
    await updateUserProfile(input.assigned_user_id, derived);
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "org_position",
    entityId: position.id,
    summary: `Created position: ${position.title}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return position;
}

export async function updateOrgPositionAction(
  positionId: string,
  input: Partial<OrgPositionInput> & { status?: OrgPositionStatus }
) {
  const actor = await requirePositionManage();
  initFlowStore();

  const updated = isSupabaseConfigured()
    ? await updateOrgPositionDb(positionId, input)
    : updateOrgPosition(positionId, input);
  if (!updated) throw new Error("Position not found.");

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "org_position",
    entityId: positionId,
    summary: `Updated position: ${updated.title}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return updated;
}

export async function assignUserToPositionAction(positionId: string, userId: string) {
  const actor = await requirePositionManage();
  initFlowStore();
  const users = getFlowStore().users;

  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found.");

  const position = getOrgPositionById(positionId);
  if (!position) throw new Error("Position not found.");
  if (position.status === "inactive") throw new Error("Cannot assign to an archived position.");

  if (position.assigned_user_id && position.assigned_user_id !== userId) {
    clearPositionAssignmentFromStore(position.assigned_user_id, users, (id, fields) =>
      updateUser(id, fields)
    );
    await updateUserProfile(position.assigned_user_id, { assigned_position_id: null });
  }

  if (user.assigned_position_id && user.assigned_position_id !== positionId) {
    assignUserToPositionRecord(user.assigned_position_id, null);
  }

  applyPositionAssignmentToStore(userId, positionId, users, (id, fields) =>
    updateUser(id, fields)
  );

  const refreshed = getOrgPositionById(positionId)!;
  await persistPosition(positionId, {
    assigned_user_id: userId,
    status: "filled",
  });
  const derived = deriveUserFieldsFromPosition(refreshed, listOrgPositions(), users);
  const updated = await updateUserProfile(userId, derived);
  await syncUserAssignedPositionDb(userId, positionId);

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "org_position",
    entityId: positionId,
    summary: `Assigned ${user.full_name} to ${position.title}`,
    actorId: actor.id,
    actorEmail: actor.email,
    metadata: { user_id: userId },
  });

  revalidateAll();
  return updated;
}

export async function unassignUserFromPositionAction(positionId: string) {
  const actor = await requirePositionManage();
  initFlowStore();

  const position = getOrgPositionById(positionId);
  if (!position) throw new Error("Position not found.");

  const userId = position.assigned_user_id;
  assignUserToPositionRecord(positionId, null);
  await persistPosition(positionId, { assigned_user_id: null, status: "vacant" });

  if (userId) {
    const users = getFlowStore().users;
    clearPositionAssignmentFromStore(userId, users, (id, fields) => updateUser(id, fields));
    await updateUserProfile(userId, { assigned_position_id: null });
    await syncUserAssignedPositionDb(userId, null);
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "org_position",
    entityId: positionId,
    summary: `Vacated position: ${position.title}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return { ok: true as const };
}

export async function moveOrgPositionAction(
  positionId: string,
  reportsToPositionId: string | null
) {
  const actor = await requirePositionManage();
  initFlowStore();

  const moved = moveOrgPosition(positionId, reportsToPositionId);
  if (!moved) throw new Error("Could not move position.");

  await persistPosition(positionId, {
    reports_to_position_id: reportsToPositionId,
  });

  const users = getFlowStore().users;
  if (moved.assigned_user_id) {
    applyPositionAssignmentToStore(moved.assigned_user_id, positionId, users, (id, fields) =>
      updateUser(id, fields)
    );
    const derived = deriveUserFieldsFromPosition(moved, listOrgPositions(), users);
    await updateUserProfile(moved.assigned_user_id, derived);
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "org_position",
    entityId: positionId,
    summary: `Moved position: ${moved.title}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return moved;
}

export async function archiveOrgPositionAction(positionId: string) {
  const actor = await requirePositionManage();
  initFlowStore();

  const position = getOrgPositionById(positionId);
  if (!position) throw new Error("Position not found.");

  if (position.assigned_user_id) {
    await unassignUserFromPositionAction(positionId);
  }

  const archived = archiveOrgPosition(positionId);
  if (!archived) throw new Error("Could not archive position.");

  await persistPosition(positionId, {
    status: "inactive",
    assigned_user_id: null,
  });

  await writeAuditLog({
    action: "status_changed",
    entityType: "org_position",
    entityId: positionId,
    summary: `Archived position: ${position.title}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return archived;
}

export async function markPositionStatusAction(
  positionId: string,
  status: OrgPositionStatus
) {
  const actor = await requirePositionManage();
  initFlowStore();

  if (status === "filled") {
    throw new Error("Use assign user to mark a position as filled.");
  }

  const position = getOrgPositionById(positionId);
  if (!position) throw new Error("Position not found.");

  if ((status === "vacant" || status === "inactive") && position.assigned_user_id) {
    await unassignUserFromPositionAction(positionId);
  }

  const updated = await persistPosition(positionId, { status });
  if (!updated) throw new Error("Position not found.");

  await writeAuditLog({
    action: "status_changed",
    entityType: "org_position",
    entityId: positionId,
    summary: `Position ${position.title} marked as ${status}`,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidateAll();
  return updated;
}

export async function completePositionSetupAction(input: {
  title: string;
  position_level: OrganizationalPosition;
  department_id?: string | null;
  team_id?: string | null;
  reports_to_position_id?: string | null;
  assign_user_id?: string | null;
  status?: OrgPositionStatus;
}) {
  await requirePositionManage();

  const position = await createOrgPositionAction({
    title: input.title,
    position_level: input.position_level,
    department_id: input.department_id ?? null,
    team_id: input.team_id ?? null,
    reports_to_position_id: input.reports_to_position_id ?? null,
    assigned_user_id: input.assign_user_id ?? null,
    status: input.assign_user_id ? "filled" : input.status ?? "vacant",
  });

  return { ok: true as const, positionId: position.id };
}

export async function canManagePositionsAction(): Promise<boolean> {
  const user = await requireUser();
  return hasAdminAccess(user);
}
