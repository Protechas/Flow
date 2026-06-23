import type {
  Department,
  OrgChartNode,
  OrgPosition,
  Team,
  User,
} from "@/types/flow";
import { initFlowStore } from "@/lib/data/flow-store";
import { hydrateDepartmentStructure } from "@/lib/data/departments-db";
import { hydrateOrgPositions } from "@/lib/data/org-positions";
import { hydrateAppStore } from "@/lib/data/users";
import {
  comparePositions,
  sortDepartments,
  sortTeams,
  sortUsers,
} from "@/lib/positions/sort";

export interface OrgChartDataBundle {
  users: User[];
  departments: Department[];
  teams: Team[];
  positions: OrgPosition[];
}

export interface OrgChartIntegrityIssue {
  code:
    | "orphan_position"
    | "duplicate_seat_user"
    | "missing_parent"
    | "user_multiple_seats"
    | "position_missing_department"
    | "circular_hierarchy";
  message: string;
  positionId?: string;
  userId?: string;
}

export interface OrgChartIntegrityReport {
  issues: OrgChartIntegrityIssue[];
}

export interface OrgTreeResult {
  roots: OrgChartNode[];
  nodesByPositionId: Map<string, OrgChartNode>;
  activePositions: OrgPosition[];
}

export interface DepartmentOrgSection {
  department: Department;
  departmentRoots: OrgChartNode[];
  teams: TeamOrgSection[];
}

export interface TeamOrgSection {
  team: Team;
  roots: OrgChartNode[];
}

function logOrgChartDiagnostics(report: OrgChartIntegrityReport): void {
  if (!report.issues.length) return;
  const payload = report.issues.map((i) => ({
    code: i.code,
    message: i.message,
    positionId: i.positionId,
    userId: i.userId,
  }));
  console.warn("[org-chart] integrity issues:", JSON.stringify(payload));
}

export function diagnoseOrgChartIntegrity(
  positions: OrgPosition[],
  users: User[]
): OrgChartIntegrityReport {
  const issues: OrgChartIntegrityIssue[] = [];
  const active = positions.filter((p) => p.status !== "inactive");
  const byId = new Map(active.map((p) => [p.id, p]));
  const userSeatCounts = new Map<string, string[]>();

  for (const position of active) {
    if (position.assigned_user_id) {
      const list = userSeatCounts.get(position.assigned_user_id) ?? [];
      list.push(position.id);
      userSeatCounts.set(position.assigned_user_id, list);
    }

    if (position.reports_to_position_id && !byId.has(position.reports_to_position_id)) {
      issues.push({
        code: "missing_parent",
        message: `Position "${position.title}" references missing parent`,
        positionId: position.id,
      });
    }

    if (position.department_id === null && position.position_level !== "senior_manager") {
      issues.push({
        code: "position_missing_department",
        message: `Position "${position.title}" has no department`,
        positionId: position.id,
      });
    }
  }

  for (const [userId, seatIds] of userSeatCounts) {
    if (seatIds.length > 1) {
      issues.push({
        code: "user_multiple_seats",
        message: `User is assigned to ${seatIds.length} active seats`,
        userId,
        positionId: seatIds[0],
      });
    }
  }

  const assignedUsers = new Map<string, string>();
  for (const position of active) {
    if (!position.assigned_user_id) continue;
    const prior = assignedUsers.get(position.assigned_user_id);
    if (prior) {
      issues.push({
        code: "duplicate_seat_user",
        message: "Duplicate user assignment across seats",
        userId: position.assigned_user_id,
        positionId: position.id,
      });
    } else {
      assignedUsers.set(position.assigned_user_id, position.id);
    }
  }

  for (const position of active) {
    if (
      position.reports_to_position_id &&
      !byId.has(position.reports_to_position_id)
    ) {
      issues.push({
        code: "orphan_position",
        message: `Orphan position "${position.title}"`,
        positionId: position.id,
      });
    }
  }

  for (const position of active) {
    const visited = new Set<string>();
    let current: string | null = position.reports_to_position_id ?? null;
    while (current) {
      if (visited.has(current)) {
        issues.push({
          code: "circular_hierarchy",
          message: `Circular reporting chain at "${position.title}"`,
          positionId: position.id,
        });
        break;
      }
      visited.add(current);
      current = byId.get(current)?.reports_to_position_id ?? null;
    }
  }

  const activeUserIds = new Set(users.filter((u) => u.is_active).map((u) => u.id));
  for (const [userId] of assignedUsers) {
    if (!activeUserIds.has(userId)) {
      issues.push({
        code: "duplicate_seat_user",
        message: "Seat assigned to missing or inactive user",
        userId,
      });
    }
  }

  return { issues };
}

/** Load all org-chart inputs from Supabase in a fixed order (no stale cache skip). */
export async function loadOrgChartBundle(): Promise<OrgChartDataBundle> {
  initFlowStore();
  const users = sortUsers(await hydrateAppStore());
  const { departments, teams } = await hydrateDepartmentStructure();
  const positions = (await hydrateOrgPositions()).filter((p) => p.status !== "inactive");

  return {
    users,
    departments: sortDepartments(departments.filter((d) => d.status === "active")),
    teams: sortTeams(teams),
    positions: [...positions].sort(comparePositions),
  };
}

function childPositionIds(
  parentId: string,
  positions: OrgPosition[]
): string[] {
  return positions
    .filter((p) => p.reports_to_position_id === parentId)
    .sort(comparePositions)
    .map((p) => p.id);
}

function buildPositionNode(
  positionId: string,
  positions: OrgPosition[],
  usersById: Map<string, User>,
  departments: Department[],
  teams: Team[],
  nodesByPositionId: Map<string, OrgChartNode>
): OrgChartNode | null {
  const existing = nodesByPositionId.get(positionId);
  if (existing) return existing;

  const position = positions.find((p) => p.id === positionId);
  if (!position) return null;

  const assignedUser = position.assigned_user_id
    ? usersById.get(position.assigned_user_id) ?? null
    : null;

  const dept = departments.find((d) => d.id === position.department_id);
  const team = teams.find((t) => t.id === position.team_id);

  const node: OrgChartNode = {
    position,
    user: assignedUser?.is_active ? assignedUser : null,
    department_name: dept?.name ?? null,
    team_name: team?.name ?? null,
    children: [],
  };

  nodesByPositionId.set(positionId, node);

  node.children = childPositionIds(positionId, positions)
    .map((id) =>
      buildPositionNode(id, positions, usersById, departments, teams, nodesByPositionId)
    )
    .filter((n): n is OrgChartNode => n !== null);

  return node;
}

/**
 * Canonical position tree — pure, deterministic, no global store reads.
 */
export function buildOrgTree(data: OrgChartDataBundle): OrgTreeResult {
  const activePositions = [...data.positions].sort(comparePositions);
  const usersById = new Map(data.users.map((u) => [u.id, u]));
  const nodesByPositionId = new Map<string, OrgChartNode>();
  const positionIds = new Set(activePositions.map((p) => p.id));

  const rootIds = activePositions
    .filter(
      (p) =>
        !p.reports_to_position_id || !positionIds.has(p.reports_to_position_id)
    )
    .sort(comparePositions)
    .map((p) => p.id);

  const roots = rootIds
    .map((id) =>
      buildPositionNode(
        id,
        activePositions,
        usersById,
        data.departments,
        data.teams,
        nodesByPositionId
      )
    )
    .filter((n): n is OrgChartNode => n !== null);

  return { roots, nodesByPositionId, activePositions };
}

function collectPositionIdsFromNodes(nodes: OrgChartNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(node: OrgChartNode) {
    if (node.position?.id) ids.add(node.position.id);
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

function headerOnlyNode(node: OrgChartNode): OrgChartNode {
  return { ...node, children: [] };
}

export function buildDepartmentGroupedSections(
  tree: OrgTreeResult,
  departments: Department[],
  teams: Team[],
  visibleRoots?: OrgChartNode[]
): DepartmentOrgSection[] {
  const roots = visibleRoots ?? tree.roots;
  const visiblePositionIds = collectPositionIdsFromNodes(roots);
  const sortedDepartments = sortDepartments(departments);
  const sortedTeams = sortTeams(teams);

  return sortedDepartments.map((department) => {
    const deptTeams = sortedTeams.filter((t) => t.department_id === department.id);

    const departmentRoots = roots
      .filter((node) => {
        const pos = node.position;
        return (
          pos &&
          pos.department_id === department.id &&
          (pos.position_level === "senior_manager" || !pos.team_id)
        );
      })
      .sort((a, b) => comparePositions(a.position!, b.position!))
      .map(headerOnlyNode);

    const teamSections: TeamOrgSection[] = deptTeams.map((team) => {
      const managerRoots = tree.activePositions
        .filter(
          (p) =>
            p.team_id === team.id &&
            p.position_level === "manager" &&
            visiblePositionIds.has(p.id)
        )
        .sort(comparePositions)
        .map((p) => tree.nodesByPositionId.get(p.id))
        .filter((n): n is OrgChartNode => n !== null);

      return { team, roots: managerRoots };
    });

    return { department, departmentRoots, teams: teamSections };
  }).filter(
    (section) =>
      section.departmentRoots.length > 0 ||
      section.teams.some((t) => t.roots.length > 0)
  );
}

export function hasGroupedDepartmentStructure(
  departments: Department[],
  positions: OrgPosition[]
): boolean {
  const deptIds = new Set(departments.map((d) => d.id));
  return positions.some(
    (p) => p.status !== "inactive" && p.department_id && deptIds.has(p.department_id)
  );
}

export function buildOrgChartWithDiagnostics(
  data: OrgChartDataBundle
): OrgTreeResult & { integrity: OrgChartIntegrityReport } {
  const integrity = diagnoseOrgChartIntegrity(data.positions, data.users);
  logOrgChartDiagnostics(integrity);
  return { ...buildOrgTree(data), integrity };
}
