import type { User, UserRole } from "@/types/flow";



export type Permission =

  | "users:manage"

  | "users:view"

  | "projects:create"

  | "projects:edit"

  | "projects:delete"

  | "work:view_all"

  | "work:view_team"

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

  | "company_documents:view"

  | "company_documents:manage"

  | "qa:review"

  | "qa:view"

  | "corrections:create"

  | "reports:view_all"

  | "reports:view_team"

  | "reports:view_qa"

  | "reports:view_own"

  | "people:view_all"

  | "people:view_team"

  | "people:view_own"

  | "settings:manage"

  | "departments:manage"

  | "departments:view"

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

    "company_documents:view",

    "company_documents:manage",

    "qa:review",

    "qa:view",

    "corrections:create",

    "reports:view_all",

    "reports:view_qa",

    "people:view_all",

    "settings:manage",

    "departments:manage",

    "departments:view",

    "dashboard:view",

  ],

  super_admin: [

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

    "company_documents:view",

    "company_documents:manage",

    "qa:review",

    "qa:view",

    "corrections:create",

    "reports:view_all",

    "reports:view_qa",

    "people:view_all",

    "settings:manage",

    "departments:manage",

    "departments:view",

    "dashboard:view",

  ],

  senior_manager: [

    "users:view",

    "projects:create",

    "projects:edit",

    "work:view_all",

    "work:assign",

    "work:edit",

    "work:submit_qa",

    "time:log",

    "comments:create",

    "files:create",

    "company_documents:view",

    "company_documents:manage",

    "qa:review",

    "qa:view",

    "corrections:create",

    "reports:view_all",

    "people:view_all",

    "departments:view",

    "dashboard:view",

  ],

  manager: [

    "users:view",

    "projects:create",

    "projects:edit",

    "projects:delete",

    "work:view_team",

    "work:assign",

    "work:edit",

    "work:delete",

    "work:submit_qa",

    "time:log",

    "comments:create",

    "files:create",

    "company_documents:view",

    "company_documents:manage",

    "qa:review",

    "qa:view",

    "corrections:create",

    "reports:view_team",

    "people:view_team",

    "departments:view",

    "dashboard:view",

  ],

  teamlead: [

    "work:view_team",

    "work:assign",

    "work:edit",

    "work:submit_qa",

    "projects:create",

    "projects:edit",

    "time:log",

    "comments:create",

    "files:create",

    "company_documents:view",

    "qa:review",

    "qa:view",

    "corrections:create",

    "reports:view_team",

    "reports:view_qa",

    "people:view_team",

  ],

  employee: [

    "work:view_own",

    "work:edit_own",

    "work:submit_qa",

    "time:log_own",

    "comments:create",

    "files:create",

    "company_documents:view",

    "people:view_own",

    "reports:view_own",

  ],

  viewer: ["dashboard:view", "reports:view_all", "work:view_all", "qa:view", "people:view_all", "departments:view", "company_documents:view"],

};



export const ROUTE_PERMISSIONS: Record<string, Permission | Permission[]> = {

  "/work": "work:view_own",

  "/executive": "dashboard:view",

  "/operations": ["work:view_all", "work:view_team", "work:assign"],

  "/operations/templates": ["projects:create", "projects:edit"],

  "/projects": ["projects:create", "projects:edit"],

  "/people": ["people:view_all", "people:view_team", "people:view_own"],

  "/qa-center": ["qa:review", "qa:view"],

  "/reports": ["reports:view_all", "reports:view_team", "reports:view_qa", "reports:view_own"],

  "/analytics": ["reports:view_all", "reports:view_team", "people:view_all", "people:view_team"],

  "/performance": ["people:view_all", "reports:view_all"],

  "/project-health": "dashboard:view",

  "/files": "company_documents:view",

  "/work-tracker": ["work:view_all", "work:assign"],

  "/production": ["reports:view_all", "reports:view_team", "people:view_all", "people:view_team"],

  "/time-clock": ["work:view_all", "work:view_team", "people:view_all", "people:view_team"],

  "/wrap-ups": ["work:view_all", "work:view_team", "people:view_all", "people:view_team"],

  "/dashboard": "dashboard:view",

  "/settings": "settings:manage",

  "/settings/users": "users:manage",
  "/settings/departments": "departments:manage",

  "/settings/forecasting": "settings:manage",

  "/settings/workload-alerts": "settings:manage",

  "/org-chart": ["people:view_all", "people:view_team", "dashboard:view"],

  "/alert-center": ["dashboard:view", "work:view_all", "work:view_team"],

  "/notifications": ["dashboard:view", "work:view_own", "work:view_team", "people:view_own"],

  "/scorecard": "people:view_own",

  "/unauthorized": "dashboard:view",

};



/** Routes limited to specific roles */

export const ROUTE_ROLE_ALLOWLIST: Partial<Record<string, UserRole[]>> = {

  "/executive": ["admin", "super_admin", "senior_manager", "manager", "viewer"],

  "/org-chart": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/alert-center": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/notifications": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "employee", "viewer"],

  "/operations": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/operations/templates": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/projects": ["admin", "manager", "teamlead"],

  "/people": ["admin", "manager", "teamlead", "viewer"],

  "/qa-center": ["admin", "manager", "teamlead", "viewer"],

  "/reports": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer", "employee"],

  "/analytics": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/performance": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/project-health": ["admin", "super_admin", "senior_manager", "manager"],

  "/files": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "employee", "viewer"],

  "/work-tracker": ["admin", "super_admin", "senior_manager", "manager"],

  "/production": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/time-clock": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/wrap-ups": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/dashboard": ["admin", "super_admin", "senior_manager", "manager", "viewer"],

  "/settings": ["admin", "super_admin"],

  "/settings/users": ["admin", "super_admin"],
  "/settings/departments": ["admin", "super_admin"],

  "/settings/forecasting": ["admin", "super_admin"],

  "/settings/workload-alerts": ["admin", "super_admin"],

};



export type NavItemId =

  | "command-center"

  | "operations"

  | "templates"

  | "projects"

  | "people"

  | "org-chart"

  | "alert-center"

  | "user-management"

  | "departments"

  | "qa-center"

  | "team-reports"

  | "team-analytics"

  | "reports"

  | "analytics"

  | "production"

  | "time-clock"

  | "wrap-ups"

  | "project-health"

  | "files"

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

  { id: "command-center", href: "/executive", label: "Command Center", icon: "LayoutDashboard", group: "command", permissions: "dashboard:view", roles: ["admin", "super_admin", "senior_manager", "manager", "viewer"] },

  { id: "operations", href: "/operations", label: "Operations", icon: "Kanban", group: "operations", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "templates", href: "/operations/templates", label: "Templates", icon: "LayoutTemplate", group: "operations", permissions: ["projects:create", "projects:edit"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "projects", href: "/projects", label: "Projects", icon: "FolderKanban", group: "operations", permissions: ["projects:create", "projects:edit"], roles: ["admin", "manager", "teamlead"] },

  { id: "people", href: "/people", label: "People", icon: "Users", group: "operations", permissions: ["people:view_all", "people:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "alert-center", href: "/alert-center", label: "Alert Center", icon: "BellRing", group: "operations", permissions: ["dashboard:view", "work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "qa-center", href: "/qa-center", label: "QA Review", icon: "ShieldCheck", group: "operations", permissions: ["qa:review", "qa:view"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "time-clock", href: "/time-clock", label: "Time Clock", icon: "Clock", group: "operations", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "manager", "teamlead"] },

  { id: "wrap-ups", href: "/wrap-ups", label: "Daily Wrap-Ups", icon: "Moon", group: "operations", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "manager", "teamlead"] },

  { id: "reports", href: "/reports", label: "Reports", icon: "BarChart3", group: "reports", permissions: "reports:view_all", roles: ["admin", "super_admin", "senior_manager", "manager", "viewer"] },

  { id: "analytics", href: "/analytics", label: "Analytics", icon: "Activity", group: "reports", permissions: ["people:view_all", "reports:view_all"], roles: ["admin", "super_admin", "senior_manager", "manager", "viewer"] },

  { id: "project-health", href: "/project-health", label: "Project Health", icon: "FolderKanban", group: "reports", permissions: "dashboard:view", roles: ["admin", "super_admin", "senior_manager", "manager"] },

  { id: "files", href: "/files", label: "Files", icon: "FileStack", group: "reports", permissions: "company_documents:view", roles: ["admin", "manager", "teamlead", "employee", "viewer"] },

  { id: "production", href: "/production", label: "Production", icon: "Activity", group: "reports", permissions: ["reports:view_all", "reports:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "team-reports", href: "/reports", label: "Team Reports", icon: "BarChart3", group: "reports", permissions: ["reports:view_team", "reports:view_qa"], roles: ["teamlead"] },

  { id: "team-analytics", href: "/analytics", label: "Analytics", icon: "Activity", group: "reports", permissions: ["reports:view_team", "people:view_team"], roles: ["teamlead"] },

  { id: "user-management", href: "/settings/users", label: "Users", icon: "UserCog", group: "administration", permissions: "users:manage", roles: ["admin", "super_admin"] },

  { id: "departments", href: "/settings/departments", label: "Departments", icon: "Building2", group: "administration", permissions: "departments:manage", roles: ["admin", "super_admin"] },

  { id: "org-chart", href: "/org-chart", label: "Org Chart", icon: "Network", group: "administration", permissions: ["people:view_all", "people:view_team", "dashboard:view"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "settings", href: "/settings", label: "Settings", icon: "Settings", group: "administration", permissions: "settings:manage", roles: ["admin", "super_admin"] },

];



export const EMPLOYEE_NAV = [

  { href: "/work", label: "Workspace", icon: "Briefcase" },

  { href: "/files", label: "Files & SOPs", icon: "FileStack" },

  { href: "/scorecard", label: "My Scorecard", icon: "Award" },

] as const;



export const VIEWER_NAV = [

  { href: "/executive", label: "Dashboard", icon: "LayoutDashboard" },

] as const;



export function normalizeRole(role: string): UserRole {

  if (role === "analyst") return "employee";

  if (role === "qa") return "teamlead";

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



export function isTeamLeadRole(role: UserRole | string): boolean {

  return normalizeRole(role) === "teamlead";

}



export function canAccessRoute(role: UserRole | string, pathname: string): boolean {

  const r = normalizeRole(role);



  if (r === "employee") {

    if (pathname === "/work" || pathname.startsWith("/work/")) return true;

    if (pathname === "/scorecard") return true;

    if (pathname === "/notifications") return true;

    if (pathname === "/files" || pathname.startsWith("/files/")) return true;

    if (pathname.startsWith("/people/") && pathname.split("/").length >= 3) return true;

    return false;

  }



  if (r === "teamlead") {

    const allowed = [

      "/operations",

      "/operations/templates",

      "/projects",

      "/people",

      "/qa-center",

      "/reports",

      "/analytics",

      "/org-chart",

      "/alert-center",

      "/production",

      "/time-clock",

      "/wrap-ups",

      "/notifications",

      "/login",

      "/auth",

      "/unauthorized",

    ];

    if (allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;

    return false;

  }



  if (r === "viewer") {

    const allowed = [

      "/executive",

      "/reports",

      "/analytics",

      "/operations",

      "/people",

      "/org-chart",

      "/qa-center",

      "/project-health",

      "/files",

      "/performance",

      "/notifications",

      "/login",

      "/auth",

      "/unauthorized",

    ];

    if (allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;

    if (pathname.startsWith("/people/")) {
      return hasPermission(r, "people:view_all") || hasPermission(r, "people:view_team");
    }

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

    case "teamlead":

      return "/operations";

    case "employee":

      return "/work";

    case "viewer":

      return "/executive";

    case "admin":
    case "super_admin":
    case "senior_manager":
    case "manager":
      return "/operations";

    default:

      return "/operations";

  }

}



export function canAccessHref(role: UserRole | string, href: string): boolean {

  const path = href.split("?")[0].split("#")[0];

  return canAccessRoute(role, path);

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



export function canViewTeamPeople(role: UserRole | string): boolean {

  return hasPermission(role, "people:view_team");

}



export function canViewTeamReports(role: UserRole | string): boolean {

  return hasAnyPermission(role, ["reports:view_all", "reports:view_team", "reports:view_qa"]);

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

