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

  | "settings:metrics"

  | "departments:manage"

  | "departments:view"

  | "dashboard:view"

  | "innovation_hub:submit"

  | "innovation_hub:manage"

  | "validation:view"

  | "validation:create"

  | "validation:run"

  | "validation:review"

  | "validation:create_tasks"

  | "validation:manage_settings"

  | "validation:export"

  | "validation:admin";



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

    "settings:metrics",

    "departments:manage",

    "departments:view",

    "dashboard:view",

    "innovation_hub:submit",

    "innovation_hub:manage",

    "validation:view",

    "validation:create",

    "validation:run",

    "validation:review",

    "validation:create_tasks",

    "validation:manage_settings",

    "validation:export",

    "validation:admin",

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

    "settings:metrics",

    "departments:manage",

    "departments:view",

    "dashboard:view",

    "innovation_hub:submit",

    "innovation_hub:manage",

    "validation:view",

    "validation:create",

    "validation:run",

    "validation:review",

    "validation:create_tasks",

    "validation:manage_settings",

    "validation:export",

    "validation:admin",

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

    "settings:metrics",

    "innovation_hub:submit",

    "innovation_hub:manage",

    "validation:view",

    "validation:create",

    "validation:run",

    "validation:review",

    "validation:create_tasks",

    "validation:export",

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

    "settings:metrics",

    "innovation_hub:submit",

    "innovation_hub:manage",

    "validation:view",

    "validation:create",

    "validation:run",

    "validation:review",

    "validation:create_tasks",

    "validation:export",

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

    "dashboard:view",

    "settings:metrics",

    "innovation_hub:submit",

    "validation:view",

    "validation:review",

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

    "innovation_hub:submit",

  ],

  viewer: ["dashboard:view", "reports:view_all", "work:view_all", "qa:view", "people:view_all", "departments:view", "company_documents:view", "innovation_hub:submit"],

};



export const ROUTE_PERMISSIONS: Record<string, Permission | Permission[]> = {

  "/work": "work:view_own",

  "/work/files": "company_documents:view",

  "/work/leaderboard": "work:view_own",

  "/work/requests": "work:view_own",

  "/work/coaching": "work:view_own",

  "/requests": ["work:view_all", "work:view_team", "work:assign"],

  "/coaching": "work:assign",

  "/executive": "dashboard:view",

  "/operations": ["work:view_all", "work:view_team", "work:assign"],

  "/operations/templates": ["projects:create", "projects:edit"],

  "/projects": ["projects:create", "projects:edit"],

  "/people": ["people:view_all", "people:view_team", "people:view_own"],

  "/qa-center": ["validation:view", "qa:review", "qa:view"],

  "/qa-center/upload": ["validation:create", "validation:view"],

  "/qa-center/id3": ["validation:create", "validation:view"],

  "/qa-center/library": "validation:view",

  "/qa-center/validation": "validation:view",

  "/qa-center/validation/new": "validation:create",

  "/qa-center/validation/runs": "validation:view",

  "/qa-center/validation/findings": "validation:view",

  "/qa-center/validation/corrections": "validation:view",

  "/qa-center/validation/history": "validation:view",

  "/qa-center/review": ["qa:review", "qa:view"],

  "/qa-center/knowledge": "validation:view",

  "/qa-center/rules": "validation:manage_settings",

  "/qa-center/reports": ["validation:export", "validation:view"],

  "/qa-center/analytics": "validation:view",

  "/qa-center/settings": "validation:manage_settings",

  "/reports": ["reports:view_all", "reports:view_team", "reports:view_qa", "reports:view_own"],

  "/reports/work-visibility": ["reports:view_all", "reports:view_team"],

  "/planning": ["dashboard:view", "work:view_all", "work:view_team"],

  "/roi": ["dashboard:view", "reports:view_all"],

  "/tools": ["work:view_all", "work:view_team"],

  "/analytics": ["reports:view_all", "reports:view_team", "people:view_all", "people:view_team"],

  "/performance": ["people:view_all", "reports:view_all", "people:view_team", "reports:view_team"],

  "/project-health": "dashboard:view",

  "/files": "company_documents:view",

  "/work-tracker": ["work:view_all", "work:assign"],

  "/production": ["reports:view_all", "reports:view_team", "people:view_all", "people:view_team"],

  "/time-clock": ["work:view_all", "work:view_team", "people:view_all", "people:view_team"],

  "/wrap-ups": ["work:view_all", "work:view_team", "people:view_all", "people:view_team"],

  "/dashboard": "dashboard:view",

  "/settings": ["settings:manage", "settings:metrics"],

  "/settings/users": "users:manage",
  "/settings/permissions": "users:manage",
  "/settings/departments": "departments:manage",

  "/settings/forecasting": ["settings:manage", "settings:metrics"],

  "/settings/workload-alerts": "settings:manage",

  "/settings/work-visibility": "settings:manage",

  "/settings/team-dashboards": "settings:manage",

  "/settings/operating-models": "settings:manage",

  "/settings/operating-models/new": "settings:manage",

  "/settings/operating-models/[slug]": "settings:manage",

  "/teams": ["dashboard:view", "reports:view_team", "people:view_team"],

  "/system-health": "settings:manage",

  "/org-chart": ["people:view_all", "people:view_team", "dashboard:view"],

  "/alert-center": ["dashboard:view", "work:view_all", "work:view_team"],

  "/notifications": ["dashboard:view", "work:view_own", "work:view_team", "people:view_own"],

  "/scorecard": "people:view_own",

  "/innovation-hub": "innovation_hub:manage",

  "/validation": "validation:view",

  "/validation/new": "validation:create",

  "/validation/runs": "validation:view",

  "/validation/runs/[id]": "validation:view",

  "/validation/findings": "validation:view",

  "/validation/corrections": "validation:view",

  "/validation/history": "validation:view",

  "/validation/reports": "validation:export",

  "/validation/analytics": "validation:view",

  "/validation/settings": "validation:manage_settings",

  "/docs": ["dashboard:view", "work:view_own", "work:view_team", "reports:view_team"],

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

  "/projects": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/people": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/qa-center": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/qa-center/upload": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/id3": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/library": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/validation": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/validation/new": ["admin", "super_admin", "senior_manager", "manager"],

  "/qa-center/validation/runs": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/validation/findings": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/validation/corrections": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/validation/history": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/review": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/qa-center/knowledge": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/rules": ["admin", "super_admin"],

  "/qa-center/reports": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/analytics": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/qa-center/settings": ["admin", "super_admin"],

  "/reports": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer", "employee"],

  "/planning": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/roi": ["admin", "super_admin", "senior_manager", "manager"],

  "/tools": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/analytics": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/performance": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/project-health": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/files": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "employee", "viewer"],

  "/work-tracker": ["admin", "super_admin", "senior_manager", "manager"],

  "/production": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/time-clock": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/wrap-ups": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/dashboard": ["admin", "super_admin", "senior_manager", "manager", "viewer"],

  "/settings": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/settings/users": ["admin", "super_admin"],
  "/settings/permissions": ["admin", "super_admin"],
  "/settings/departments": ["admin", "super_admin"],

  "/settings/forecasting": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/settings/workload-alerts": ["admin", "super_admin"],

  "/settings/work-visibility": ["admin", "super_admin"],
  "/settings/help-flags": ["admin", "super_admin"],

  "/settings/team-dashboards": ["admin", "super_admin"],

  "/settings/operating-models": ["admin", "super_admin"],

  "/settings/operating-models/new": ["admin", "super_admin"],

  "/settings/operating-models/[slug]": ["admin", "super_admin"],

  "/teams": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"],

  "/system-health": ["admin", "super_admin"],

  "/reports/work-visibility": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/innovation-hub": ["admin", "super_admin", "senior_manager", "manager"],

  "/validation": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/new": ["admin", "super_admin", "senior_manager", "manager"],

  "/validation/runs": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/runs/[id]": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/findings": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/corrections": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/history": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/reports": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/analytics": ["admin", "super_admin", "senior_manager", "manager", "teamlead"],

  "/validation/settings": ["admin", "super_admin"],

  "/docs": ["admin", "super_admin", "senior_manager", "manager", "teamlead", "employee", "viewer"],

};



export type NavItemId =

  | "command-center"

  | "operations"

  | "requests"

  | "coaching"

  | "templates"

  | "projects"

  | "people"

  | "performance"

  | "org-chart"

  | "alert-center"

  | "user-management"

  | "departments"

  | "qa-center"

  | "team-reports"

  | "team-analytics"

  | "reports"

  | "analytics"

  | "planning"

  | "roi"

  | "tools"

  | "production"

  | "time-clock"

  | "wrap-ups"

  | "project-health"

  | "files"

  | "innovation-hub"

  | "validation-center"

  | "settings"

  | "system-health"

  | "docs";



export type NavGroupId =
  | "dashboard"
  | "attention"
  | "operations"
  | "workforce"
  | "reporting"
  | "administration";



export const NAV_GROUP_ORDER: NavGroupId[] = [
  "dashboard",
  "attention",
  "operations",
  "workforce",
  "reporting",
  "administration",
];



export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {

  dashboard: "Dashboard",

  attention: "Attention",

  operations: "Operations",

  workforce: "Workforce",

  reporting: "Reporting",

  administration: "Administration",

};



/** Primary destinations — slightly stronger sidebar emphasis. */
export const NAV_PRIMARY_ITEM_IDS: NavItemId[] = [
  "command-center",
  "alert-center",
  "operations",
];



export const NAV_ITEM_ORDER: Record<NavGroupId, NavItemId[]> = {

  dashboard: ["command-center"],

  attention: ["alert-center", "qa-center", "wrap-ups"],

  operations: ["operations", "projects", "production", "project-health", "files"],

  workforce: ["people", "performance", "time-clock", "org-chart"],

  reporting: ["reports", "analytics", "planning", "team-reports", "team-analytics", "docs"],

  administration: ["departments", "templates", "user-management", "system-health", "innovation-hub", "settings"],

};



/**

 * Sidebar navigation config.

 * New pages must be assigned to one of: dashboard, attention, operations,

 * workforce, reporting, administration — see NAV_GROUP_ORDER / NAV_ITEM_ORDER.

 */

export const NAV_CONFIG: {

  id: NavItemId;

  href: string;

  label: string;

  icon: string;

  group: NavGroupId;

  permissions: Permission | Permission[];

  roles: UserRole[];

}[] = [

  { id: "command-center", href: "/executive", label: "Executive Dashboard", icon: "LayoutDashboard", group: "dashboard", permissions: "dashboard:view", roles: ["admin", "super_admin", "senior_manager", "manager", "viewer"] },

  { id: "alert-center", href: "/alert-center", label: "Alert Center", icon: "BellRing", group: "attention", permissions: ["dashboard:view", "work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "qa-center", href: "/qa-center", label: "QA Center", icon: "Brain", group: "attention", permissions: ["validation:view", "qa:review", "qa:view"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "wrap-ups", href: "/wrap-ups", label: "Daily Reports", icon: "ClipboardList", group: "attention", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "operations", href: "/operations", label: "Operations", icon: "Kanban", group: "operations", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "requests", href: "/requests", label: "Requests", icon: "Inbox", group: "operations", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "projects", href: "/projects", label: "Projects", icon: "FolderKanban", group: "operations", permissions: ["projects:create", "projects:edit"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "production", href: "/production", label: "Production", icon: "Factory", group: "operations", permissions: ["reports:view_all", "reports:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "project-health", href: "/project-health", label: "Project Health", icon: "HeartPulse", group: "operations", permissions: "dashboard:view", roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "files", href: "/files", label: "Files", icon: "FileStack", group: "operations", permissions: "company_documents:view", roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "employee", "viewer"] },

  { id: "people", href: "/people", label: "People", icon: "Users", group: "workforce", permissions: ["people:view_all", "people:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "performance", href: "/performance", label: "Performance", icon: "Trophy", group: "workforce", permissions: ["people:view_all", "reports:view_all", "people:view_team", "reports:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "time-clock", href: "/time-clock", label: "Time Clock", icon: "Clock", group: "workforce", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "coaching", href: "/coaching", label: "Coaching", icon: "ClipboardList", group: "workforce", permissions: "work:assign", roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "org-chart", href: "/org-chart", label: "Org Chart", icon: "Network", group: "workforce", permissions: ["people:view_all", "people:view_team", "dashboard:view"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "reports", href: "/reports", label: "Reports", icon: "BarChart3", group: "reporting", permissions: "reports:view_all", roles: ["admin", "super_admin", "senior_manager", "manager", "viewer"] },

  { id: "analytics", href: "/analytics", label: "Analytics", icon: "LineChart", group: "reporting", permissions: ["people:view_all", "reports:view_all"], roles: ["admin", "super_admin", "senior_manager", "manager", "viewer"] },

  { id: "planning", href: "/planning", label: "Planning & Forecasting", icon: "TrendingUp", group: "reporting", permissions: ["dashboard:view", "work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "viewer"] },

  { id: "roi", href: "/roi", label: "Flow ROI", icon: "CircleDollarSign", group: "reporting", permissions: ["dashboard:view", "reports:view_all"], roles: ["admin", "super_admin", "senior_manager", "manager"] },

  { id: "tools", href: "/tools", label: "Tools", icon: "Wrench", group: "operations", permissions: ["work:view_all", "work:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "team-reports", href: "/reports", label: "Team Reports", icon: "BarChart3", group: "reporting", permissions: ["reports:view_team", "reports:view_qa"], roles: ["teamlead"] },

  { id: "team-analytics", href: "/analytics", label: "Analytics", icon: "LineChart", group: "reporting", permissions: ["reports:view_team", "people:view_team"], roles: ["teamlead"] },

  { id: "departments", href: "/settings/departments", label: "Departments", icon: "Building2", group: "administration", permissions: "departments:manage", roles: ["admin", "super_admin"] },

  { id: "templates", href: "/operations/templates", label: "Templates", icon: "LayoutTemplate", group: "administration", permissions: ["projects:create", "projects:edit"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "user-management", href: "/settings/users", label: "Users", icon: "UserCog", group: "administration", permissions: "users:manage", roles: ["admin", "super_admin"] },

  { id: "system-health", href: "/system-health", label: "System Health", icon: "HeartPulse", group: "administration", permissions: "settings:manage", roles: ["admin", "super_admin"] },

  { id: "innovation-hub", href: "/innovation-hub", label: "Innovation Hub", icon: "Lightbulb", group: "administration", permissions: "innovation_hub:manage", roles: ["admin", "super_admin", "senior_manager", "manager"] },

  { id: "settings", href: "/settings", label: "Settings", icon: "Settings", group: "administration", permissions: ["settings:manage", "settings:metrics"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead"] },

  { id: "docs", href: "/docs", label: "Help & Docs", icon: "BookOpen", group: "reporting", permissions: ["dashboard:view", "work:view_own", "work:view_team", "reports:view_team"], roles: ["admin", "super_admin", "senior_manager", "manager", "teamlead", "employee", "viewer"] },

];



export const EMPLOYEE_NAV = [

  { href: "/work", label: "Workspace", icon: "Briefcase" },

  { href: "/work/requests", label: "Requests", icon: "Inbox" },

  { href: "/work/coaching", label: "Coaching", icon: "ClipboardList" },

  { href: "/work/files", label: "Files & SOPs", icon: "FileStack" },

  { href: "/work/leaderboard", label: "Leaderboard", icon: "Trophy" },

  { href: "/scorecard", label: "My Scorecard", icon: "Award" },

  { href: "/docs", label: "Help & Docs", icon: "BookOpen" },

] as const;



export function isEmployeeNavActive(href: string, pathname: string): boolean {
  if (href === "/work") {
    return (
      pathname === "/work" ||
      (pathname.startsWith("/work/") &&
        !pathname.startsWith("/work/files") &&
        !pathname.startsWith("/work/leaderboard") &&
        !pathname.startsWith("/work/requests") &&
        !pathname.startsWith("/work/coaching"))
    );
  }
  if (href === "/work/files") {
    return pathname === "/work/files" || pathname.startsWith("/work/files/");
  }
  if (href === "/docs") {
    return pathname === "/docs" || pathname.startsWith("/docs/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}



export const VIEWER_NAV = [

  { href: "/executive", label: "Executive Dashboard", icon: "LayoutDashboard" },

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

  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return true;
  }

  if (pathname.startsWith("/teams/")) {
    return (
      hasPermission(r, "dashboard:view") ||
      hasPermission(r, "reports:view_team") ||
      hasPermission(r, "people:view_team") ||
      hasPermission(r, "work:view_own")
    );
  }



  if (r === "employee") {

    if (pathname === "/work" || pathname.startsWith("/work/")) return true;

    if (pathname === "/scorecard") return true;

    if (pathname === "/notifications") return true;

    if (pathname === "/files" || pathname.startsWith("/files/")) return true;

    if (pathname.startsWith("/people/") && pathname.split("/").length >= 3) return true;

    // Auth routes must stay reachable or employees can never clear a stale session
    if (pathname === "/login" || pathname === "/unauthorized") return true;

    if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;

    return false;

  }



  if (r === "teamlead") {

    const allowed = [

      "/operations",

      "/operations/templates",

      "/projects",

      "/project-health",

      "/files",

      "/performance",

      "/people",

      "/qa-center",

      "/reports",

      "/reports/work-visibility",

      "/analytics",

      "/planning",

      "/org-chart",

      "/alert-center",

      "/production",

      "/time-clock",

      "/tools",

      "/wrap-ups",

      "/teams",

      "/settings",

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

      "/reports/work-visibility",

      "/analytics",

      "/planning",

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

  const byGroup = new Map<NavGroupId, typeof items>();



  for (const item of items) {

    const list = byGroup.get(item.group) ?? [];

    list.push(item);

    byGroup.set(item.group, list);

  }



  return NAV_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => {

    const groupItems = byGroup.get(group)!;

    const order = NAV_ITEM_ORDER[group];

    const sorted = [...groupItems].sort((a, b) => {

      const ai = order.indexOf(a.id);

      const bi = order.indexOf(b.id);

      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);

    });



    return {

      group,

      label: NAV_GROUP_LABELS[group],

      items: sorted,

    };

  });

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

