import type { OrgPosition, User, WorkPackage } from "@/types/flow";

export type SystemHealthRepairKey =
  | "clear-missing-org-parents"
  | "clear-invalid-task-assignees"
  | "clear-invalid-manager-links";

export interface SystemHealthRepairItem {
  repairKey: SystemHealthRepairKey;
  entityType: "org_position" | "work_package" | "user";
  entityId: string;
  label: string;
  field: string;
  previousValue: string | null;
  nextValue: string | null;
}

export function planClearMissingOrgParents(
  positions: OrgPosition[]
): SystemHealthRepairItem[] {
  const active = positions.filter((p) => p.status !== "inactive");
  const byId = new Set(active.map((p) => p.id));
  const items: SystemHealthRepairItem[] = [];

  for (const position of active) {
    const parentId = position.reports_to_position_id;
    if (!parentId || byId.has(parentId)) continue;
    items.push({
      repairKey: "clear-missing-org-parents",
      entityType: "org_position",
      entityId: position.id,
      label: position.title,
      field: "reports_to_position_id",
      previousValue: parentId,
      nextValue: null,
    });
  }

  return items;
}

export function planClearInvalidTaskAssignees(
  packages: WorkPackage[],
  activeUserIds: Set<string>
): SystemHealthRepairItem[] {
  return packages
    .filter((p) => p.assigned_to && !activeUserIds.has(p.assigned_to))
    .map((p) => ({
      repairKey: "clear-invalid-task-assignees" as const,
      entityType: "work_package" as const,
      entityId: p.id,
      label: p.title,
      field: "assigned_to",
      previousValue: p.assigned_to ?? null,
      nextValue: null,
    }));
}

export function planClearInvalidManagerLinks(
  users: User[],
  activeUserIds: Set<string>
): SystemHealthRepairItem[] {
  return users
    .filter((u) => u.manager_id && !activeUserIds.has(u.manager_id))
    .map((u) => ({
      repairKey: "clear-invalid-manager-links" as const,
      entityType: "user" as const,
      entityId: u.id,
      label: u.full_name,
      field: "manager_id",
      previousValue: u.manager_id ?? null,
      nextValue: null,
    }));
}

export function planSystemHealthRepairs(input: {
  positions: OrgPosition[];
  packages: WorkPackage[];
  users: User[];
}): SystemHealthRepairItem[] {
  const activeUserIds = new Set(
    input.users.filter((u) => u.is_active).map((u) => u.id)
  );
  return [
    ...planClearMissingOrgParents(input.positions),
    ...planClearInvalidTaskAssignees(input.packages, activeUserIds),
    ...planClearInvalidManagerLinks(input.users, activeUserIds),
  ];
}

export function itemsForRepairKey(
  items: SystemHealthRepairItem[],
  repairKey: SystemHealthRepairKey
): SystemHealthRepairItem[] {
  return items.filter((item) => item.repairKey === repairKey);
}
