/**
 * Project visibility contract (P1) — THE single answer to "which projects can
 * this person see". Every project-listing surface (Projects, Files,
 * Performance, Project Health, Leaderboard) goes through here so a scoping
 * change lands everywhere at once and the persona contract tests
 * (project-scope.test.ts) catch leaks at build time.
 *
 * Rules:
 * - Org-wide viewers (admin/super_admin access, viewer position) see all.
 * - Everyone else sees: projects of teams in their branch (their own team +
 *   teams of everyone under them) ∪ projects they own ∪ projects they created
 *   ∪ projects where someone in their branch is assigned work.
 * - NO department fallback — a department is not a visibility grant.
 */

import { isHierarchyOrgWide } from "@/lib/hierarchy/visibility-core";
import { getTeamMemberIds } from "@/lib/auth/team-scope";
import type { Project, Team, User, WorkPackage } from "@/types/flow";

export interface ProjectScopeInput {
  projects: Project[];
  workPackages: WorkPackage[];
  users: User[];
  teams: Team[];
}

/** Branch member ids for a viewer (viewer + downstream), or null for org-wide. */
export function getScopeBranchIds(
  viewer: User,
  users: User[],
  teams: Team[]
): string[] | null {
  if (isHierarchyOrgWide(viewer)) return null;
  return [viewer.id, ...getTeamMemberIds(viewer, users, teams)];
}

/** Team ids covered by a branch: the viewer's team + every branch member's team. */
function branchTeamIds(branchIds: string[], users: User[]): Set<string> {
  const ids = new Set<string>();
  for (const u of users) {
    if (branchIds.includes(u.id) && u.team_id) ids.add(u.team_id);
  }
  return ids;
}

export function getVisibleProjectIds(
  viewer: User,
  input: ProjectScopeInput
): Set<string> {
  const branchIds = getScopeBranchIds(viewer, input.users, input.teams);
  if (branchIds === null) {
    return new Set(input.projects.map((p) => p.id));
  }

  const branch = new Set(branchIds);
  const teamIds = branchTeamIds(branchIds, input.users);
  const visible = new Set<string>();

  for (const p of input.projects) {
    if (
      (p.team_id && teamIds.has(p.team_id)) ||
      (p.project_owner_id && branch.has(p.project_owner_id)) ||
      (p.created_by && branch.has(p.created_by))
    ) {
      visible.add(p.id);
    }
  }
  for (const wp of input.workPackages) {
    if (wp.assigned_to && branch.has(wp.assigned_to)) visible.add(wp.project_id);
  }
  return visible;
}

export function getVisibleProjects(viewer: User, input: ProjectScopeInput): Project[] {
  const ids = getVisibleProjectIds(viewer, input);
  return input.projects.filter((p) => ids.has(p.id));
}

export function canViewProject(
  viewer: User,
  projectId: string,
  input: ProjectScopeInput
): boolean {
  return getVisibleProjectIds(viewer, input).has(projectId);
}
