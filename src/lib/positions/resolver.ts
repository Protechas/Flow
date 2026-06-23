import { hasAdminAccess } from "@/lib/auth/access-level";
import { getPrimarySupervisorId } from "@/lib/hierarchy/visibility-core";
import { comparePositions } from "@/lib/positions/sort";
import type { OrgChartNode, OrgPosition, Team, User } from "@/types/flow";

export function getOrgChartNodeUserId(node: OrgChartNode): string | null {
  return node.user?.id ?? node.position?.assigned_user_id ?? null;
}

export function isPositionBasedNode(node: OrgChartNode): boolean {
  return !!node.position;
}

export function isVacantPositionNode(node: OrgChartNode): boolean {
  return !!node.position && !node.user && !node.position.assigned_user_id;
}

export function collectOrgChartNodeUserIds(nodes: OrgChartNode[]): string[] {
  const ids: string[] = [];
  function walk(n: OrgChartNode) {
    const uid = getOrgChartNodeUserId(n);
    if (uid) ids.push(uid);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

function getChildPositionIds(
  parentId: string,
  positions: OrgPosition[]
): string[] {
  return positions
    .filter((p) => p.reports_to_position_id === parentId)
    .sort(comparePositions)
    .map((p) => p.id);
}

function getPositionDescendantIds(
  rootPositionId: string,
  positions: OrgPosition[]
): string[] {
  const result: string[] = [];
  const queue = [...getChildPositionIds(rootPositionId, positions)];

  while (queue.length) {
    const id = queue.shift()!;
    if (result.includes(id)) continue;
    result.push(id);
    queue.push(...getChildPositionIds(id, positions));
  }

  return result;
}

export function getVisiblePositionIds(
  viewer: User,
  positions: OrgPosition[],
  users: User[]
): Set<string> {
  const active = positions.filter((p) => p.status !== "inactive");

  if (hasAdminAccess(viewer)) {
    return new Set(active.map((p) => p.id));
  }

  const viewerPosition = viewer.assigned_position_id
    ? active.find((p) => p.id === viewer.assigned_position_id)
    : active.find((p) => p.assigned_user_id === viewer.id);

  if (!viewerPosition) {
    const visibleUserIds = new Set<string>([viewer.id]);
    let currentId: string | null = viewer.id;
    const visited = new Set<string>();
    while (currentId) {
      const supervisorId = getPrimarySupervisorId(currentId, users);
      if (!supervisorId || visited.has(supervisorId)) break;
      visited.add(supervisorId);
      visibleUserIds.add(supervisorId);
      currentId = supervisorId;
    }
    return new Set(
      active
        .filter((p) => p.assigned_user_id && visibleUserIds.has(p.assigned_user_id))
        .map((p) => p.id)
    );
  }

  const scopeRole = viewer.organizational_position ?? "employee";
  if (scopeRole === "employee") {
    return new Set([viewerPosition.id]);
  }

  if (scopeRole === "senior_manager" && viewerPosition.department_id) {
    const inDept = active
      .filter((p) => p.department_id === viewerPosition.department_id)
      .map((p) => p.id);
    return new Set([viewerPosition.id, ...inDept]);
  }

  if (scopeRole === "manager" && viewerPosition.team_id) {
    const inTeam = active
      .filter((p) => p.team_id === viewerPosition.team_id)
      .map((p) => p.id);
    return new Set([viewerPosition.id, ...inTeam]);
  }

  if (scopeRole === "team_lead") {
    const directChildren = getChildPositionIds(viewerPosition.id, active);
    return new Set([viewerPosition.id, ...directChildren]);
  }

  const descendants = getPositionDescendantIds(viewerPosition.id, active);
  return new Set([viewerPosition.id, ...descendants]);
}

function buildPositionNode(
  positionId: string,
  positions: OrgPosition[],
  users: User[],
  departments: { id: string; name: string }[],
  teams: { id: string; name: string }[]
): OrgChartNode | null {
  const position = positions.find((p) => p.id === positionId);
  if (!position || position.status === "inactive") return null;

  const assignedUser = position.assigned_user_id
    ? users.find((u) => u.id === position.assigned_user_id && u.is_active) ?? null
    : null;

  const dept = departments.find((d) => d.id === position.department_id);
  const team = teams.find((t) => t.id === position.team_id);
  const childIds = getChildPositionIds(positionId, positions);

  return {
    position,
    user: assignedUser,
    department_name: dept?.name ?? null,
    team_name: team?.name ?? null,
    children: childIds
      .map((id) => buildPositionNode(id, positions, users, departments, teams))
      .filter((n): n is OrgChartNode => n !== null)
      .sort((a, b) => {
        const titleA = a.position?.title ?? a.user?.full_name ?? "";
        const titleB = b.position?.title ?? b.user?.full_name ?? "";
        return titleA.localeCompare(titleB);
      }),
  };
}

export function buildPositionOrgChart(
  users: User[],
  departments: { id: string; name: string }[],
  teams: { id: string; name: string }[],
  positions: OrgPosition[],
  rootPositionId?: string | null
): OrgChartNode[] {
  const active = positions.filter((p) => p.status !== "inactive");
  if (!active.length) return [];

  let roots: string[];
  if (rootPositionId) {
    roots = [rootPositionId];
  } else {
    const positionIds = new Set(active.map((p) => p.id));
    roots = active
      .filter(
        (p) =>
          !p.reports_to_position_id || !positionIds.has(p.reports_to_position_id)
      )
      .sort(comparePositions)
      .map((p) => p.id);
  }

  return roots
    .map((id) => buildPositionNode(id, active, users, departments, teams))
    .filter((n): n is OrgChartNode => n !== null)
    .sort((a, b) => {
      if (a.position && b.position) return comparePositions(a.position, b.position);
      const titleA = a.position?.title ?? a.user?.full_name ?? "";
      const titleB = b.position?.title ?? b.user?.full_name ?? "";
      return titleA.localeCompare(titleB);
    });
}

export function buildLegacyUserOrgChart(
  users: User[],
  departments: { id: string; name: string }[],
  teams: { id: string; name: string }[],
  buildUserChart: (
    users: User[],
    departments: { id: string; name: string }[],
    teams: { id: string; name: string }[],
    rootUserId?: string | null
  ) => OrgChartNode[],
  rootUserId?: string | null
): OrgChartNode[] {
  const assignedIds = new Set(
    users.filter((u) => u.assigned_position_id).map((u) => u.id)
  );
  const legacyUsers = users.map((u) =>
    assignedIds.has(u.id) ? { ...u, manager_id: null } : u
  );
  return buildUserChart(legacyUsers, departments, teams, rootUserId);
}

export function buildHybridOrgChart(
  users: User[],
  departments: { id: string; name: string }[],
  teams: Team[],
  positions: OrgPosition[],
  buildUserChart: (
    users: User[],
    departments: { id: string; name: string }[],
    teams: { id: string; name: string }[],
    rootUserId?: string | null
  ) => OrgChartNode[],
  rootUserId?: string | null
): OrgChartNode[] {
  const active = positions.filter((p) => p.status !== "inactive");
  if (!active.length) {
    return buildUserChart(users, departments, teams, rootUserId);
  }

  const teamList = teams.map((t) => ({ id: t.id, name: t.name }));

  if (rootUserId) {
    const rootUser = users.find((u) => u.id === rootUserId);
    const rootPositionId =
      rootUser?.assigned_position_id ??
      active.find((p) => p.assigned_user_id === rootUserId)?.id;
    if (rootPositionId) {
      return buildPositionOrgChart(
        users,
        departments,
        teamList,
        active,
        rootPositionId
      );
    }
    return buildUserChart(users, departments, teamList, rootUserId);
  }

  return buildPositionOrgChart(users, departments, teamList, active);
}

export function prunePositionOrgChartNodes(
  nodes: OrgChartNode[],
  visiblePositionIds: Set<string>
): OrgChartNode[] {
  function prune(node: OrgChartNode): OrgChartNode | null {
    const children = node.children
      .map(prune)
      .filter((n): n is OrgChartNode => n !== null);

    const positionId = node.position?.id;
    const visible =
      (positionId && visiblePositionIds.has(positionId)) ||
      children.length > 0;

    if (visible) return { ...node, children };
    return null;
  }

  return nodes.map(prune).filter((n): n is OrgChartNode => n !== null);
}

export function listUnassignedUsers(
  users: User[],
  positions: OrgPosition[] = []
): User[] {
  const seatAssigned = new Set(
    positions
      .filter((p) => p.status !== "inactive" && p.assigned_user_id)
      .map((p) => p.assigned_user_id as string)
  );

  return users
    .filter(
      (u) =>
        u.is_active &&
        !u.assigned_position_id &&
        !seatAssigned.has(u.id)
    )
    .sort(
      (a, b) =>
        a.full_name.localeCompare(b.full_name) ||
        a.email.localeCompare(b.email) ||
        a.id.localeCompare(b.id)
    );
}

export function suggestPositionForUser(
  user: User,
  positions: OrgPosition[]
): OrgPosition | null {
  const vacant = positions.filter(
    (p) =>
      p.status !== "inactive" &&
      !p.assigned_user_id &&
      (p.status === "vacant" || p.status === "planned")
  );

  if (user.team_id) {
    const teamMatch = vacant.find((p) => p.team_id === user.team_id);
    if (teamMatch) return teamMatch;
  }

  const level = user.organizational_position ?? "employee";
  const levelMatch = vacant.find((p) => p.position_level === level);
  if (levelMatch) return levelMatch;

  return vacant[0] ?? null;
}

export function countVacantPositions(positions: OrgPosition[]): number {
  return positions.filter(
    (p) =>
      p.status !== "inactive" &&
      !p.assigned_user_id &&
      (p.status === "vacant" || p.status === "planned")
  ).length;
}
