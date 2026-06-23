import type { OrgPosition } from "@/types/flow";
import { DEFAULT_DEPARTMENT_ID } from "./mock-data";

const now = new Date().toISOString();

function pos(
  id: string,
  title: string,
  level: OrgPosition["position_level"],
  opts: Partial<OrgPosition> = {}
): OrgPosition {
  return {
    id,
    title,
    department_id: DEFAULT_DEPARTMENT_ID,
    team_id: null,
    reports_to_position_id: null,
    position_level: level,
    position_type: "standard",
    status: "vacant",
    assigned_user_id: null,
    created_at: now,
    updated_at: now,
    ...opts,
  };
}

/** Demo org structure with filled and vacant seats */
export const MOCK_ORG_POSITIONS: OrgPosition[] = [
  pos("pos-sr-mgr", "Senior Manager — Service Info", "senior_manager", {
    assigned_user_id: "user-mark",
    status: "filled",
    team_id: null,
  }),
  pos("pos-mgr-a", "Manager — Audit Team", "manager", {
    reports_to_position_id: "pos-sr-mgr",
    assigned_user_id: "user-manager",
    status: "filled",
    team_id: "team-1",
  }),
  pos("pos-mgr-b", "Manager — Honda Group", "manager", {
    reports_to_position_id: "pos-sr-mgr",
    status: "vacant",
    team_id: "team-b",
  }),
  pos("pos-tl-a1", "Team Lead — Branch A", "team_lead", {
    reports_to_position_id: "pos-mgr-a",
    assigned_user_id: "user-tara",
    status: "filled",
    team_id: "team-1",
  }),
  pos("pos-emp-a1", "Employee — Research Specialist", "employee", {
    reports_to_position_id: "pos-tl-a1",
    status: "vacant",
    team_id: "team-1",
  }),
  pos("pos-emp-a2", "Employee — Documentation", "employee", {
    reports_to_position_id: "pos-tl-a1",
    assigned_user_id: "user-michael",
    status: "filled",
    team_id: "team-1",
  }),
];

export function syncMockUsersToPositions(users: { id: string; assigned_position_id?: string | null }[]): void {
  for (const position of MOCK_ORG_POSITIONS) {
    if (!position.assigned_user_id) continue;
    const user = users.find((u) => u.id === position.assigned_user_id);
    if (user) {
      user.assigned_position_id = position.id;
    }
  }
}
