import type { OrganizationalPosition, OrgPosition, OrgPositionInput } from "@/types/flow";

export interface TeamSeatBlueprint {
  name: string;
  teamId?: string;
  employeeSeatCount?: number;
  managerTitle?: string;
  teamLeadTitle?: string;
  employeeTitlePrefix?: string;
}

export interface DepartmentOrgBlueprint {
  departmentName: string;
  departmentId?: string;
  seniorManagerTitle?: string;
  seniorManagerUserId?: string | null;
  teams: TeamSeatBlueprint[];
  employeeSeatsPerTeam?: number;
}

export interface GeneratedSeatSpec extends OrgPositionInput {
  key: string;
  parentKey?: string;
}

/** Build position seat specs: Sr Mgr → per team (Manager → Team Lead → Employees). */
export function buildDepartmentSeatSpecs(
  blueprint: DepartmentOrgBlueprint
): GeneratedSeatSpec[] {
  const specs: GeneratedSeatSpec[] = [];
  const deptId = blueprint.departmentId ?? null;
  const srKey = "sr-mgr";

  specs.push({
    key: srKey,
    title: blueprint.seniorManagerTitle ?? "Senior Manager",
    position_level: "senior_manager",
    department_id: deptId,
    team_id: null,
    reports_to_position_id: null,
    assigned_user_id: blueprint.seniorManagerUserId ?? null,
    status: blueprint.seniorManagerUserId ? "filled" : "vacant",
  });

  blueprint.teams.forEach((team, index) => {
    const teamKey = `team-${index}`;
    const mgrKey = `${teamKey}-mgr`;
    const tlKey = `${teamKey}-tl`;
    const employeeCount = team.employeeSeatCount ?? blueprint.employeeSeatsPerTeam ?? 1;

    specs.push({
      key: mgrKey,
      parentKey: srKey,
      title: team.managerTitle ?? `${team.name} Manager`,
      position_level: "manager",
      department_id: deptId,
      team_id: team.teamId ?? null,
      reports_to_position_id: null,
      status: "vacant",
    });

    specs.push({
      key: tlKey,
      parentKey: mgrKey,
      title: team.teamLeadTitle ?? `${team.name} Team Lead`,
      position_level: "team_lead",
      department_id: deptId,
      team_id: team.teamId ?? null,
      reports_to_position_id: null,
      status: "vacant",
    });

    for (let e = 0; e < employeeCount; e++) {
      specs.push({
        key: `${teamKey}-emp-${e}`,
        parentKey: tlKey,
        title:
          employeeCount === 1
            ? team.employeeTitlePrefix ?? `${team.name} Analyst`
            : `${team.employeeTitlePrefix ?? team.name + " Analyst"} ${e + 1}`,
        position_level: "employee",
        department_id: deptId,
        team_id: team.teamId ?? null,
        reports_to_position_id: null,
        status: "vacant",
      });
    }
  });

  return specs;
}

export function resolveSeatParentIds(
  specs: GeneratedSeatSpec[],
  idByKey: Map<string, string>
): OrgPositionInput[] {
  return specs.map((spec) => {
    const { key, parentKey, ...input } = spec;
    void key;
    return {
      ...input,
      reports_to_position_id: parentKey ? idByKey.get(parentKey) ?? null : null,
    };
  });
}

export const INFORMATION_SOLUTIONS_TEAMS: TeamSeatBlueprint[] = [
  { name: "Advanced Projects Team" },
  { name: "Service Information Team" },
  { name: "ID³ Validation Team" },
];
