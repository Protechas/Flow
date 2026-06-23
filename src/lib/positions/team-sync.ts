import { updateDepartment, updateTeam } from "@/lib/data/flow-store";
import { updateDepartmentDb, updateTeamDb } from "@/lib/data/departments-db";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { OrgPosition } from "@/types/flow";

/** Keep department/team leadership fields aligned with filled position seats. */
export async function syncDepartmentTeamFromPosition(position: OrgPosition): Promise<void> {
  if (position.status === "inactive") return;

  const userId = position.assigned_user_id ?? null;

  if (position.position_level === "senior_manager" && position.department_id) {
    if (isSupabaseConfigured()) {
      await updateDepartmentDb(position.department_id, { lead_user_id: userId });
    } else {
      updateDepartment(position.department_id, { lead_user_id: userId });
    }
    return;
  }

  if (!position.team_id) return;

  if (position.position_level === "manager") {
    if (isSupabaseConfigured()) {
      await updateTeamDb(position.team_id, { manager_id: userId });
    } else {
      updateTeam(position.team_id, { manager_id: userId });
    }
    return;
  }

  if (position.position_level === "team_lead") {
    if (isSupabaseConfigured()) {
      await updateTeamDb(position.team_id, { team_lead_user_id: userId });
    } else {
      updateTeam(position.team_id, { team_lead_user_id: userId });
    }
  }
}

export async function clearDepartmentTeamSeat(
  position: OrgPosition,
  previousUserId?: string | null
): Promise<void> {
  if (!previousUserId) return;

  if (position.position_level === "senior_manager" && position.department_id) {
    if (isSupabaseConfigured()) {
      const { listDepartments } = await import("@/lib/data/flow-store");
      const dept = listDepartments().find((d) => d.id === position.department_id);
      if (dept?.lead_user_id === previousUserId) {
        await updateDepartmentDb(position.department_id, { lead_user_id: null });
      }
    } else {
      updateDepartment(position.department_id, { lead_user_id: null });
    }
    return;
  }

  if (!position.team_id) return;

  if (position.position_level === "manager") {
    if (isSupabaseConfigured()) {
      const { listTeamsStore } = await import("@/lib/data/flow-store");
      const team = listTeamsStore().find((t) => t.id === position.team_id);
      if (team?.manager_id === previousUserId) {
        await updateTeamDb(position.team_id, { manager_id: null });
      }
    } else {
      updateTeam(position.team_id, { manager_id: null });
    }
  }

  if (position.position_level === "team_lead") {
    if (isSupabaseConfigured()) {
      const { listTeamsStore } = await import("@/lib/data/flow-store");
      const team = listTeamsStore().find((t) => t.id === position.team_id);
      if (team?.team_lead_user_id === previousUserId) {
        await updateTeamDb(position.team_id, { team_lead_user_id: null });
      }
    } else {
      updateTeam(position.team_id, { team_lead_user_id: null });
    }
  }
}
