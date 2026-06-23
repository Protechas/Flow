import type { Department, OrgChartNode, OrgPosition, Team } from "@/types/flow";
import { buildPositionOrgChart } from "@/lib/positions/resolver";

export interface DepartmentOrgSection {
  department: Department;
  /** Senior manager / department-root position nodes */
  departmentRoots: OrgChartNode[];
  teams: TeamOrgSection[];
}

export interface TeamOrgSection {
  team: Team;
  roots: OrgChartNode[];
}

function positionInDepartment(p: OrgPosition, departmentId: string): boolean {
  return p.department_id === departmentId;
}

function positionInTeam(p: OrgPosition, teamId: string): boolean {
  return p.team_id === teamId;
}

function filterNodeTree(nodes: OrgChartNode[], predicate: (p: OrgPosition) => boolean): OrgChartNode[] {
  function filterNode(node: OrgChartNode): OrgChartNode | null {
    const pos = node.position;
    const children = node.children
      .map(filterNode)
      .filter((n): n is OrgChartNode => n !== null);

    if (pos && predicate(pos)) {
      return { ...node, children };
    }
    if (children.length > 0) {
      return { ...node, position: pos ?? null, user: node.user, children };
    }
    return null;
  }

  return nodes.map(filterNode).filter((n): n is OrgChartNode => n !== null);
}

function extractTeamRoots(
  allRoots: OrgChartNode[],
  teamId: string,
  positions: OrgPosition[]
): OrgChartNode[] {
  const teamManagerPositions = positions.filter(
    (p) => p.team_id === teamId && p.position_level === "manager"
  );

  const roots: OrgChartNode[] = [];

  function walk(nodes: OrgChartNode[]) {
    for (const node of nodes) {
      if (node.position?.team_id === teamId && node.position.position_level === "manager") {
        roots.push(node);
      } else {
        walk(node.children);
      }
    }
  }

  walk(allRoots);

  if (roots.length > 0) return roots;

  return filterNodeTree(allRoots, (p) => positionInTeam(p, teamId));
}

export function buildDepartmentGroupedSections(
  roots: OrgChartNode[],
  departments: Department[],
  teams: Team[],
  positions: OrgPosition[]
): DepartmentOrgSection[] {
  const activeDepartments = departments.filter((d) => d.status === "active");

  return activeDepartments
    .map((department) => {
      const deptTeams = teams.filter((t) => t.department_id === department.id);
      const deptPositions = positions.filter((p) => positionInDepartment(p, department.id));

      if (deptPositions.length === 0 && deptTeams.length === 0) {
        return null;
      }

      const departmentRoots = filterNodeTree(
        roots,
        (p) =>
          positionInDepartment(p, department.id) &&
          (p.position_level === "senior_manager" || !p.team_id)
      );

      const teamSections: TeamOrgSection[] = deptTeams.map((team) => ({
        team,
        roots: extractTeamRoots(roots, team.id, positions),
      }));

      return {
        department,
        departmentRoots,
        teams: teamSections,
      };
    })
    .filter((s): s is DepartmentOrgSection => s !== null);
}

export function hasGroupedDepartmentStructure(
  departments: Department[],
  positions: OrgPosition[]
): boolean {
  return departments.some((d) =>
    positions.some((p) => p.department_id === d.id && p.status !== "inactive")
  );
}
