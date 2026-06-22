import { resolveLeadersForEmployee } from "@/lib/hierarchy/resolver";
import type { Project, User, WorkPackage } from "@/types/flow";

export function getQaReviewers(users: User[]): User[] {
  return users.filter(
    (u) =>
      u.is_active &&
      (u.role === "teamlead" ||
        u.role === "admin" ||
        u.role === "super_admin" ||
        u.role === "manager" ||
        u.role === "senior_manager")
  );
}

/** @deprecated Use getQaReviewers */
export function getQaUsers(users: User[]): User[] {
  return getQaReviewers(users);
}

export function getManagers(users: User[]): User[] {
  return users.filter(
    (u) =>
      u.is_active &&
      (u.role === "manager" ||
        u.role === "senior_manager" ||
        u.role === "admin" ||
        u.role === "super_admin")
  );
}

export function getTeamLeads(users: User[]): User[] {
  return users.filter((u) => u.is_active && u.role === "teamlead");
}

export function getManagerForEmployee(employeeId: string, users: User[]): User | null {
  const employee = users.find((u) => u.id === employeeId);
  if (!employee?.manager_id) return null;
  return users.find((u) => u.id === employee.manager_id && u.is_active) ?? null;
}

export function getProjectOwner(projectId: string, projects: Project[], users: User[]): User | null {
  const project = projects.find((p) => p.id === projectId);
  if (!project?.project_owner_id) return null;
  return users.find((u) => u.id === project.project_owner_id && u.is_active) ?? null;
}

export function getManagersForPackage(
  pkg: WorkPackage,
  users: User[],
  projects: Project[]
): User[] {
  const out = new Map<string, User>();
  const owner = getProjectOwner(pkg.project_id, projects, users);
  if (owner) out.set(owner.id, owner);
  if (pkg.assigned_to) {
    const employee = users.find((u) => u.id === pkg.assigned_to);
    if (employee) {
      for (const leader of resolveLeadersForEmployee(employee, users)) {
        out.set(leader.id, leader);
      }
    }
  }
  for (const m of getManagers(users)) {
    if (m.role === "admin" || m.role === "super_admin") out.set(m.id, m);
  }
  return [...out.values()];
}

export function parseMentionedUserIds(body: string, users: User[]): string[] {
  const mentioned: string[] = [];
  for (const u of users) {
    const patterns = [
      `@${u.full_name}`,
      `@${u.first_name}`,
      `@${u.email.split("@")[0]}`,
    ];
    if (patterns.some((p) => body.toLowerCase().includes(p.toLowerCase()))) {
      mentioned.push(u.id);
    }
  }
  return mentioned;
}

import { operationsHref, qaCenterHref } from "@/lib/navigation/deep-links";

export function workPackageLink(pkgId: string, role: User["role"]): string {
  if (role === "employee") return `/work/${pkgId}`;
  if (role === "teamlead") return qaCenterHref({ package: pkgId });
  return operationsHref({ package: pkgId });
}
