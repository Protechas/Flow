"use server";

import { revalidateOrgStructure } from "@/lib/data/revalidate-flow";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import { completeDepartmentStructureAction } from "@/app/actions/departments";
import { createOrgPositionAction } from "@/app/actions/positions";
import { updateUserProfile } from "@/lib/data/users";
import {
  createTeam,
  getFlowStore,
  initFlowStore,
  listDepartments,
  listTeamsStore,
  updateUser,
} from "@/lib/data/flow-store";
import { ensureDepartmentsLoaded, insertTeamDb } from "@/lib/data/departments-db";
import { ensureOrgPositionsLoaded } from "@/lib/data/org-positions";
import {
  buildDepartmentSeatSpecs,
  INFORMATION_SOLUTIONS_TEAMS,
  resolveSeatParentIds,
  type DepartmentOrgBlueprint,
} from "@/lib/positions/bootstrap";
import { applyPositionAssignmentToStore } from "@/lib/positions/sync";
import { syncDepartmentTeamFromPosition } from "@/lib/positions/team-sync";
import { listActiveOrgPositions } from "@/lib/positions/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { listUsers } from "@/lib/data/users";

function revalidateAll() {
  revalidateOrgStructure();
}

export async function bootstrapDepartmentOrgStructureAction(
  blueprint: DepartmentOrgBlueprint & {
    createDepartmentIfMissing?: boolean;
    createTeamsIfMissing?: boolean;
  }
) {
  const actor = await requirePermission("users:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();
  await ensureOrgPositionsLoaded();

  let departmentId = blueprint.departmentId ?? null;

  if (!departmentId && blueprint.createDepartmentIfMissing !== false) {
    const result = await completeDepartmentStructureAction({
      name: blueprint.departmentName,
      lead_user_id: blueprint.seniorManagerUserId ?? null,
      teams: blueprint.teams.map((t) => ({ name: t.name })),
    });
    departmentId = result.departmentId;
  }

  if (!departmentId) {
    throw new Error("Department is required to build org structure.");
  }

  const existingDeptPositions = listActiveOrgPositions().filter(
    (p) => p.department_id === departmentId
  );
  if (existingDeptPositions.length > 0) {
    throw new Error(
      "Position seats already exist for this department. Manage seats from the org chart."
    );
  }

  let teams = listTeamsStore().filter((t) => t.department_id === departmentId);
  for (const teamDef of blueprint.teams) {
    if (!teamDef.name.trim()) continue;
    const existing = teams.find(
      (t) => t.name.toLowerCase() === teamDef.name.trim().toLowerCase()
    );
    if (!existing) {
      const created = isSupabaseConfigured()
        ? await insertTeamDb({
            name: teamDef.name.trim(),
            department_id: departmentId,
          })
        : createTeam({
            name: teamDef.name.trim(),
            department_id: departmentId,
          });
      teams = [...teams, created];
    }
  }

  const teamBlueprints = blueprint.teams.map((teamDef) => {
    const existing = teams.find(
      (t) => t.name.toLowerCase() === teamDef.name.toLowerCase()
    );
    return {
      ...teamDef,
      teamId: teamDef.teamId ?? existing?.id,
    };
  });

  const specs = buildDepartmentSeatSpecs({
    ...blueprint,
    departmentId,
    teams: teamBlueprints,
  });

  const idByKey = new Map<string, string>();
  const createdIds: string[] = [];

  for (const spec of specs) {
    const { key, parentKey, ...input } = spec;
    const position = await createOrgPositionAction({
      ...input,
      department_id: departmentId,
      reports_to_position_id: parentKey ? idByKey.get(parentKey) ?? null : null,
    });
    idByKey.set(key, position.id);
    createdIds.push(position.id);

    if (input.assigned_user_id) {
      const users = getFlowStore().users;
      applyPositionAssignmentToStore(
        input.assigned_user_id,
        position.id,
        users,
        (userId, fields) => updateUser(userId, fields)
      );
      await updateUserProfile(input.assigned_user_id, {
        assigned_position_id: position.id,
      });
      await syncDepartmentTeamFromPosition(position);
    }
  }

  await writeAuditLog({
    action: "assignment_changed",
    entityType: "org_position",
    entityId: departmentId,
    summary: `Built org structure for ${blueprint.departmentName} (${createdIds.length} seats)`,
    actorId: actor.id,
    actorEmail: actor.email,
    metadata: { position_ids: createdIds },
  });

  revalidateAll();
  return {
    ok: true as const,
    departmentId,
    positionIds: createdIds,
    seatCount: createdIds.length,
  };
}

export async function buildInformationSolutionsStructureAction(input?: {
  markUserId?: string | null;
  employeeSeatsPerTeam?: number;
}) {
  await requirePermission("users:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();

  let markUserId = input?.markUserId ?? null;
  if (!markUserId) {
    const users = await listUsers();
    const mark = users.find(
      (u) =>
        u.is_active &&
        (u.first_name?.toLowerCase() === "mark" ||
          u.full_name?.toLowerCase().includes("mark"))
    );
    markUserId = mark?.id ?? null;
  }

  const existing = listDepartments().find(
    (d) => d.name.toLowerCase() === "information solutions"
  );

  return bootstrapDepartmentOrgStructureAction({
    departmentName: "Information Solutions",
    departmentId: existing?.id,
    seniorManagerTitle: "Senior Manager — Information Solutions",
    seniorManagerUserId: markUserId,
    teams: INFORMATION_SOLUTIONS_TEAMS,
    employeeSeatsPerTeam: input?.employeeSeatsPerTeam ?? 1,
    createDepartmentIfMissing: true,
  });
}
