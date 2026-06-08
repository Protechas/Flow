import type { User, UserRole } from "@/types/flow";

export type Permission =
  | "users:manage"
  | "users:view"
  | "projects:create"
  | "projects:edit"
  | "projects:delete"
  | "work:view_all"
  | "work:view_own"
  | "work:assign"
  | "work:edit"
  | "work:edit_own"
  | "work:delete"
  | "work:submit_qa"
  | "time:log"
  | "time:log_own"
  | "comments:create"
  | "files:create"
  | "qa:review"
  | "qa:view"
  | "corrections:create"
  | "reports:view_all"
  | "reports:view_qa"
  | "reports:view_own"
  | "people:view_all"
  | "people:view_own"
  | "settings:manage"
  | "dashboard:view";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "users:manage",
    "users:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "work:view_all",
    "work:assign",
    "work:edit",
    "work:delete",
    "work:submit_qa",
    "time:log",
    "comments:create",
    "files:create",
    "qa:review",
    "qa:view",
    "corrections:create",
    "reports:view_all",
    "reports:view_qa",
    "people:view_all",
    "settings:manage",
    "dashboard:view",
  ],
  manager: [
    "users:view",
    "projects:create",
    "projects:edit",
    "projects:delete",
    "work:view_all",
    "work:assign",
    "work:edit",
    "work:delete",
    "work:submit_qa",
    "time:log",
    "comments:create",
    "files:create",
    "qa:view",
    "reports:view_all",
    "people:view_all",
    "dashboard:view",
  ],
  qa: [
    "qa:review",
    "qa:view",
    "corrections:create",
    "reports:view_qa",
    "reports:view_all",
  ],
  employee: [
    "work:view_own",
    "work:edit_own",
    "work:submit_qa",
    "time:log_own",
    "comments:create",
    "files:create",
    "people:view_own",
    "reports:view_own",
  ],
  viewer: ["dashboard:view", "reports:view_all", "work:view_all"],
};

export const ROUTE_PERMISSIONS: Record<string, Permission | Permission[]> = {
  "/work": "work:view_own",
  "/executive": "dashboard:view",
  "/operations": ["work:view_all", "work:assign"],
  "/projects": ["projects:create", "projects:edit"],
  "/people": ["people:view_all", "people:view_own"],
  "/qa-center": ["qa:review", "qa:view"],
  "/reports": ["reports:view_all", "reports:view_qa", "reports:view_own"],
  "/performance": ["people:view_all", "reports:view_all"],
  "/settings": "settings:manage",
  "/settings/users": "users:manage",
  "/scorecard": "people:view_own",
  "/unauthorized": "dashboard:view",
};

/** Routes limited to specific roles */
export const ROUTE_ROLE_ALLOWLIST: Partial<Record<string, UserRole[]>> = {
  "/executive": ["admin", "manager", "viewer"],
  "/operations": ["admin", "manager"],
  "/projects": ["admin", "manager"],
  "/people": ["admin", "manager"],
  "/qa-center": ["admin", "manager", "qa"],
  "/reports": ["admin", "manager", "qa", "viewer", "employee"],
  "/performance": ["admin", "manager"],
  "/settings": ["admin"],
  "/settings/users": ["admin"],
};

export type NavItemId =
  | "command-center"
  | "operations"
  | "projects"
  | "people"
  | "user-management"
  | "qa-center"
  | "qa-reports"
  | "reports"
  | "analytics"
  | "settings";

export type NavGroupId = "command" | "operations" | "reports" | "administration";

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  command: "Command Center",
  operations: "Operations",
  reports: "Reports",
  administration: "Administration",
};

export const NAV_CONFIG: {
  id: NavItemId;
  href: string;
  label: string;
  icon: string;
  group: NavGroupId;
  permissions: Permission | Permission[];
  roles: UserRole[];
}[] = [
  { id: "command-center", href: "/executive", label: "Command Center", icon: "LayoutDashboard", group: "command", permissions: "dashboard:view", roles: ["admin", "manager"] },
  { id: "operations", href: "/operations", label: "Operations", icon: "Kanban", group: "operations", permissions: ["work:view_all", "work:assign"], roles: ["admin", "manager"] },
  { id: "projects", href: "/projects", label: "Projects", icon: "FolderKanban", group: "operations", permissions: ["projects:create", "projects:edit"], roles: ["admin", "manager"] },
  { id: "people", href: "/people", label: "People", icon: "Users", group: "operations", permissions: "people:view_all", roles: ["admin", "manager"] },
  { id: "qa-center", href: "/qa-center", label: "QA", icon: "ShieldCheck", group: "operations", permissions: ["qa:review", "qa:view"], roles: ["admin", "manager", "qa"] },
  { id: "reports", href: "/reports", label: "Reports", icon: "BarChart3", group: "reports", permissions: "reports:view_all", roles: ["admin", "manager"] },
  { id: "analytics", href: "/performance", label: "Analytics", icon: "Activity", group: "reports", permissions: ["people:view_all", "reports:view_all"], roles: ["admin", "manager"] },
  { id: "qa-reports", href: "/reports", label: "Reports", icon: "BarChart3", group: "reports", permissions: ["reports:view_qa", "reports:view_all"], roles: ["qa"] },
  { id: "user-management", href: "/settings/users", label: "Users", icon: "UserCog", group: "administration", permissions: "users:manage", roles: ["admin"] },
  { id: "settings", href: "/settings", label: "Settings", icon: "Settings", group: "administration", permissions: "settings:manage", roles: ["admin"] },
];

export const EMPLOYEE_NAV = [
  { href: "/work", label: "My Work", icon: "Briefcase" },
  { href: "/scorecard", label: "My Scorecard", icon: "Award" },
] as const;

export const VIEWER_NAV = [
  { href: "/executive", label: "Dashboard", icon: "LayoutDashboard" },
] as const;

export function normalizeRole(role: string): UserRole {
  if (role === "analyst") return "employee";
  return role as UserRole;
}

export function hasPermission(role: UserRole | string, permission: Permission): boolean {
  const r = normalizeRole(role);
  return ROLE_PERMISSIONS[r]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole | string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function isEmployeeRole(role: UserRole | string): boolean {
  return normalizeRole(role) === "employee";
}

export function canAccessRoute(role: UserRole | string, pathname: string): boolean {
  const r = normalizeRole(role);

  if (r === "employee") {
    if (pathname === "/work" || pathname.startsWith("/work/")) return true;
    if (pathname === "/scorecard") return true;
    if (pathname.startsWith("/people/") && pathname.split("/").length >= 3) return true;
    return false;
  }

  if (r === "qa") {
    if (pathname === "/qa-center" || pathname.startsWith("/qa-center/")) return true;
    if (pathname === "/reports" || pathname.startsWith("/reports/")) return true;
    if (pathname === "/login" || pathname.startsWith("/auth")) return true;
    return false;
  }

  if (r === "viewer") {
    if (pathname === "/executive" || pathname.startsWith("/executive/")) return true;
    if (pathname === "/login" || pathname.startsWith("/auth")) return true;
    return false;
  }

  const base = pathname.split("/").slice(0, 3).join("/") || pathname;
  const allowlist = ROUTE_ROLE_ALLOWLIST[pathname] ?? ROUTE_ROLE_ALLOWLIST[base];
  if (allowlist && !allowlist.includes(r)) return false;

  const exact = ROUTE_PERMISSIONS[pathname] ?? ROUTE_PERMISSIONS[base];
  if (!exact) return hasPermission(r, "dashboard:view");

  const perms = Array.isArray(exact) ? exact : [exact];
  if (hasAnyPermission(r, perms)) return true;

  if (pathname.startsWith("/people/") && hasPermission(r, "people:view_own")) {
    return true;
  }

  return false;
}

export function getNavItemsForRole(role: UserRole | string) {
  const r = normalizeRole(role);
  return NAV_CONFIG.filter((item) => {
    if (!item.roles.includes(r)) return false;
    const perms = Array.isArray(item.permissions) ? item.permissions : [item.permissions];
    return hasAnyPermission(r, perms);
  });
}

export function getNavGroupsForRole(role: UserRole | string) {
  const items = getNavItemsForRole(role);
  const groups: NavGroupId[] = [];
  const result: { group: NavGroupId; label: string; items: typeof items }[] = [];

  for (const item of items) {
    if (!groups.includes(item.group)) {
      groups.push(item.group);
      result.push({
        group: item.group,
        label: NAV_GROUP_LABELS[item.group],
        items: [],
      });
    }
    result.find((g) => g.group === item.group)!.items.push(item);
  }

  return result;
}

export function getDefaultRoute(role: UserRole | string): string {
  const r = normalizeRole(role);
  switch (r) {
    case "qa":
      return "/qa-center";
    case "employee":
      return "/work";
    case "viewer":
      return "/executive";
    case "admin":
    case "manager":
      return "/operations";
    default:
      return "/operations";
  }
}

export function isReadOnly(role: UserRole | string): boolean {
  return normalizeRole(role) === "viewer";
}

export function canEditWork(role: UserRole | string): boolean {
  const r = normalizeRole(role);
  return hasPermission(r, "work:edit") || hasPermission(r, "work:edit_own");
}

export function canAssignWork(role: UserRole | string): boolean {
  return hasPermission(role, "work:assign");
}

export function canDeleteProjects(role: UserRole | string): boolean {
  return hasPermission(role, "projects:delete");
}

export function canManageUsers(role: UserRole | string): boolean {
  return hasPermission(role, "users:manage");
}

export function canViewAllPeople(role: UserRole | string): boolean {
  return hasPermission(role, "people:view_all");
}

export function canViewTeamReports(role: UserRole | string): boolean {
  return hasAnyPermission(role, ["reports:view_all", "reports:view_qa"]);
}

export function canReviewQa(role: UserRole | string): boolean {
  return hasPermission(role, "qa:review");
}

export function canSubmitToQa(role: UserRole | string): boolean {
  return hasPermission(role, "work:submit_qa");
}

export function employeeCanAccessPackage(
  userId: string,
  packageAssignedTo: string | null | undefined
): boolean {
  return packageAssignedTo === userId;
}
