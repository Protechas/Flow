import type { User, UserRole } from "@/types/flow";

export interface HierarchyPreviewLine {
  label: string;
  value: string;
}

export interface HierarchyPreview {
  name: string;
  lines: HierarchyPreviewLine[];
}

function findInChain(users: User[], startId: string | null, targetRole: UserRole): User | null {
  let current = startId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    const u = users.find((x) => x.id === current);
    if (!u) break;
    if (u.role === targetRole) return u;
    current = u.manager_id ?? null;
  }
  return null;
}

/** Build a human-readable reporting preview from draft form values */
export function buildHierarchyPreview(input: {
  first_name: string;
  last_name: string;
  role: UserRole;
  department_name?: string;
  team_name?: string;
  reports_to_id?: string | null;
  users: User[];
}): HierarchyPreview {
  const name = [input.first_name, input.last_name].filter(Boolean).join(" ").trim() || "New user";
  const lines: HierarchyPreviewLine[] = [];

  if (input.department_name) {
    lines.push({ label: "Department", value: input.department_name });
  }
  if (input.team_name) {
    lines.push({ label: "Team", value: input.team_name });
  }

  const supervisor = input.reports_to_id
    ? input.users.find((u) => u.id === input.reports_to_id)
    : null;

  if (supervisor) {
    lines.push({ label: "Reports to", value: supervisor.full_name });
  }

  const manager =
    supervisor?.role === "manager"
      ? supervisor
      : findInChain(input.users, supervisor?.id ?? null, "manager");
  if (manager && manager.id !== supervisor?.id) {
    lines.push({ label: "Manager", value: manager.full_name });
  } else if (supervisor?.role === "manager") {
    lines.push({ label: "Manager", value: supervisor.full_name });
  }

  const seniorManager = findInChain(
    input.users,
    manager?.id ?? supervisor?.id ?? null,
    "senior_manager"
  );
  if (seniorManager) {
    lines.push({ label: "Senior manager", value: seniorManager.full_name });
  }

  lines.push({ label: "Role", value: input.role.replace("_", " ") });

  return { name, lines };
}

export function buildDepartmentSetupPreview(input: {
  name: string;
  purpose?: string;
  senior_manager_name?: string;
  manager_names: string[];
  teams: { name: string; lead_name: string; employee_count: number }[];
}): HierarchyPreview {
  const lines: HierarchyPreviewLine[] = [];

  if (input.purpose) {
    lines.push({ label: "Purpose", value: input.purpose });
  }
  if (input.senior_manager_name) {
    lines.push({ label: "Senior manager", value: input.senior_manager_name });
  }
  if (input.manager_names.length) {
    lines.push({ label: "Managers", value: input.manager_names.join(", ") });
  }
  for (const team of input.teams) {
    lines.push({
      label: team.name,
      value: `${team.lead_name}${team.employee_count ? ` · ${team.employee_count} employees` : ""}`,
    });
  }

  return { name: input.name, lines };
}
