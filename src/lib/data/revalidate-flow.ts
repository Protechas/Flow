import { revalidatePath } from "next/cache";

const GROUPS = {
  commandCenter: [
    "/executive",
    "/operations",
    "/planning",
    "/project-health",
    "/alert-center",
    "/notifications",
  ],
  people: ["/people", "/org-chart", "/settings/users", "/settings/departments"],
  employee: ["/work", "/wrap-ups"],
} as const;

type FlowRevalidateGroup = keyof typeof GROUPS;

function revalidateGroups(...groups: FlowRevalidateGroup[]): void {
  const paths = new Set<string>();
  for (const group of groups) {
    for (const path of GROUPS[group]) paths.add(path);
  }
  for (const path of paths) revalidatePath(path);
}

/** Sidebar, nav visibility, and session-scoped shell data. */
export function revalidateAppLayout(): void {
  revalidatePath("/", "layout");
}

/** User profile, team, and hierarchy edits that do not change route access. */
export function revalidateUserOrgData(): void {
  revalidateGroups("people", "commandCenter", "employee");
}

/** Department, team, and org-position structure changes. */
export function revalidateOrgStructure(): void {
  revalidateUserOrgData();
  revalidatePath("/teams", "layout");
}

/** Role, access level, or permission visibility changes — refresh sidebar. */
export function revalidateUserAccessChange(): void {
  revalidateUserOrgData();
  revalidateAppLayout();
}
