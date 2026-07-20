import type { Permission, NavItemId } from "@/lib/auth/permissions";

/** Enterprise permission layer — module registry (extensible for future modules). */
export type FeatureVisibility = "visible" | "hidden";

export type PermissionTemplateId =
  | "employee"
  | "manager"
  | "team_lead"
  | "senior_manager"
  | "admin"
  | "super_admin";

export const PERMISSION_TEMPLATE_LABELS: Record<PermissionTemplateId, string> = {
  employee: "Employee",
  manager: "Manager",
  team_lead: "Team Lead",
  senior_manager: "Senior Manager",
  admin: "Admin",
  super_admin: "Super Admin",
};

export interface FeaturePermissionDefinition {
  key: string;
  label: string;
  description?: string;
  /** Legacy RBAC permissions used when no custom override exists (Phase 1 fallback). */
  legacyPermissions: Permission[];
}

export interface FeatureModuleDefinition {
  id: string;
  label: string;
  description: string;
  group: "dashboard" | "attention" | "operations" | "workforce" | "reporting" | "administration" | "employee";
  navItemId?: NavItemId;
  href?: string;
  permissions: FeaturePermissionDefinition[];
}

/**
 * Central module registry. Future modules register here — no duplicated permission logic.
 */
export const FEATURE_MODULE_REGISTRY: FeatureModuleDefinition[] = [
  {
    id: "executive-dashboard",
    label: "Executive Dashboard",
    description: "Leadership KPIs and command center",
    group: "dashboard",
    navItemId: "command-center",
    href: "/executive",
    permissions: [{ key: "view", label: "View", legacyPermissions: ["dashboard:view"] }],
  },
  {
    id: "alert-center",
    label: "Alert Center",
    description: "Workload alerts and attention items",
    group: "attention",
    navItemId: "alert-center",
    href: "/alert-center",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["dashboard:view", "work:view_all", "work:view_team"],
      },
    ],
  },
  {
    id: "qa-center",
    label: "QA Center",
    description: "Validation, review, and knowledge library",
    group: "attention",
    navItemId: "qa-center",
    href: "/qa-center",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["validation:view", "qa:view", "qa:review"] },
      { key: "upload_audit", label: "Upload / Validate", legacyPermissions: ["validation:create"] },
      { key: "review_findings", label: "Review Findings", legacyPermissions: ["validation:review", "qa:review"] },
      { key: "delete_audit", label: "Delete Audit", legacyPermissions: ["validation:admin"] },
      { key: "manage_rules", label: "Manage Rules", legacyPermissions: ["validation:manage_settings"] },
      { key: "export", label: "Export Reports", legacyPermissions: ["validation:export"] },
    ],
  },
  {
    id: "daily-reports",
    label: "Daily Reports",
    description: "Wrap-up and daily reporting",
    group: "attention",
    navItemId: "wrap-ups",
    href: "/wrap-ups",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["work:view_all", "work:view_team"],
      },
      { key: "create", label: "Create", legacyPermissions: ["work:view_team", "work:view_all"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    description: "Work hub and task management",
    group: "operations",
    navItemId: "operations",
    href: "/operations",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["work:view_all", "work:view_team", "work:view_own"] },
      { key: "edit", label: "Edit Tasks", legacyPermissions: ["work:edit", "work:edit_own"] },
      { key: "assign", label: "Assign", legacyPermissions: ["work:assign"] },
      { key: "production", label: "Production Tracking", legacyPermissions: ["reports:view_all", "reports:view_team"] },
      { key: "settings", label: "Settings", legacyPermissions: ["settings:manage"] },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    description: "Project workspace and planning",
    group: "operations",
    navItemId: "projects",
    href: "/projects",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["projects:create", "projects:edit"] },
      { key: "create", label: "Create", legacyPermissions: ["projects:create"] },
      { key: "edit", label: "Edit", legacyPermissions: ["projects:edit"] },
      { key: "assign", label: "Assign", legacyPermissions: ["work:assign"] },
      { key: "complete", label: "Complete Tasks", legacyPermissions: ["work:edit", "work:edit_own"] },
      { key: "delete", label: "Delete", legacyPermissions: ["projects:delete"] },
      { key: "archive", label: "Archive", legacyPermissions: ["projects:delete"] },
    ],
  },
  {
    id: "production",
    label: "Production",
    description: "Production metrics and throughput",
    group: "operations",
    navItemId: "production",
    href: "/production",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["reports:view_all", "reports:view_team"] },
      { key: "edit", label: "Edit", legacyPermissions: ["work:edit", "reports:view_all"] },
    ],
  },
  {
    id: "project-health",
    label: "Project Health",
    description: "Health scores and risk indicators",
    group: "operations",
    navItemId: "project-health",
    href: "/project-health",
    permissions: [{ key: "view", label: "View", legacyPermissions: ["dashboard:view"] }],
  },
  {
    id: "files",
    label: "Files",
    description: "Company documents and SOPs",
    group: "operations",
    navItemId: "files",
    href: "/files",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["company_documents:view"] },
      { key: "upload", label: "Upload", legacyPermissions: ["files:create", "company_documents:manage"] },
      { key: "manage", label: "Manage", legacyPermissions: ["company_documents:manage"] },
    ],
  },
  {
    id: "people",
    label: "People",
    description: "Team directory and employee profiles",
    group: "workforce",
    navItemId: "people",
    href: "/people",
    permissions: [
      { key: "view_team", label: "View Team", legacyPermissions: ["people:view_team"] },
      { key: "view_employee", label: "View Employee", legacyPermissions: ["people:view_all", "people:view_own"] },
      { key: "edit_employee", label: "Edit Employee", legacyPermissions: ["users:manage"] },
      { key: "invite_user", label: "Invite User", legacyPermissions: ["users:manage"] },
      { key: "delete_user", label: "Delete User", legacyPermissions: ["users:manage"] },
    ],
  },
  {
    id: "time-clock",
    label: "Time Clock",
    description: "Clock in / clock out",
    group: "workforce",
    navItemId: "time-clock",
    href: "/time-clock",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["work:view_all", "work:view_team"] },
      { key: "log", label: "Log Time", legacyPermissions: ["time:log", "time:log_own"] },
    ],
  },
  {
    id: "org-chart",
    label: "Org Chart",
    description: "Organizational structure",
    group: "workforce",
    navItemId: "org-chart",
    href: "/org-chart",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["people:view_all", "people:view_team", "dashboard:view"],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    description: "Operational and QA reports",
    group: "reporting",
    navItemId: "reports",
    href: "/reports",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["reports:view_all", "reports:view_team", "reports:view_qa", "reports:view_own"],
      },
      { key: "export", label: "Export", legacyPermissions: ["validation:export", "reports:view_all"] },
      { key: "create", label: "Create", legacyPermissions: ["reports:view_all"] },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Trends and performance analytics",
    group: "reporting",
    navItemId: "analytics",
    href: "/analytics",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["reports:view_all", "reports:view_team", "people:view_all"],
      },
    ],
  },
  {
    id: "planning",
    label: "Planning & Forecasting",
    description: "Capacity planning and forecasts",
    group: "reporting",
    navItemId: "planning",
    href: "/planning",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["dashboard:view", "work:view_all", "work:view_team"],
      },
    ],
  },
  {
    id: "departments",
    label: "Departments",
    description: "Department administration",
    group: "administration",
    navItemId: "departments",
    href: "/settings/departments",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["departments:view", "departments:manage"] },
      { key: "manage", label: "Manage", legacyPermissions: ["departments:manage"] },
    ],
  },
  {
    id: "templates",
    label: "Templates",
    description: "Work and project templates",
    group: "administration",
    navItemId: "templates",
    href: "/operations/templates",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["projects:create", "projects:edit"] },
      { key: "edit", label: "Edit", legacyPermissions: ["projects:create", "projects:edit"] },
    ],
  },
  {
    id: "user-management",
    label: "Users",
    description: "User accounts and invites",
    group: "administration",
    navItemId: "user-management",
    href: "/settings/users",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["users:view", "users:manage"] },
      { key: "manage", label: "Manage", legacyPermissions: ["users:manage"] },
    ],
  },
  {
    id: "permission-management",
    label: "Permission Management",
    description: "Feature visibility and module permissions",
    group: "administration",
    href: "/settings/permissions",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["users:manage", "settings:manage"] },
      { key: "manage", label: "Manage", legacyPermissions: ["users:manage", "settings:manage"] },
    ],
  },
  {
    id: "system-health",
    label: "System Health",
    description: "Platform integrity diagnostics",
    group: "administration",
    navItemId: "system-health",
    href: "/system-health",
    permissions: [{ key: "view", label: "View", legacyPermissions: ["settings:manage"] }],
  },
  {
    id: "innovation-hub",
    label: "Innovation Hub",
    description: "Feedback and improvement submissions",
    group: "administration",
    navItemId: "innovation-hub",
    href: "/innovation-hub",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["innovation_hub:manage", "innovation_hub:submit"] },
      { key: "manage", label: "Manage", legacyPermissions: ["innovation_hub:manage"] },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Platform and account settings",
    group: "administration",
    navItemId: "settings",
    href: "/settings",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["settings:manage", "settings:metrics"] },
      { key: "manage", label: "Manage Platform", legacyPermissions: ["settings:manage"] },
    ],
  },
  {
    id: "docs",
    label: "Help & Docs",
    description: "Documentation and help articles",
    group: "reporting",
    navItemId: "docs",
    href: "/docs",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["dashboard:view", "work:view_own", "work:view_team", "reports:view_team"],
      },
    ],
  },
  {
    id: "employee-workspace",
    label: "Employee Workspace",
    description: "Personal task workspace",
    group: "employee",
    href: "/work",
    permissions: [
      { key: "view", label: "View", legacyPermissions: ["work:view_own"] },
      { key: "edit", label: "Edit Own Work", legacyPermissions: ["work:edit_own"] },
      { key: "submit_qa", label: "Submit for QA", legacyPermissions: ["work:submit_qa"] },
    ],
  },
  {
    id: "scorecard",
    label: "My Scorecard",
    description: "Personal performance scorecard",
    group: "employee",
    href: "/scorecard",
    permissions: [{ key: "view", label: "View", legacyPermissions: ["people:view_own", "reports:view_own"] }],
  },
  {
    id: "performance",
    label: "Performance",
    description: "Team and individual performance views",
    group: "reporting",
    href: "/performance",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["people:view_all", "reports:view_all", "reports:view_team"],
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "In-app notification center",
    group: "attention",
    href: "/notifications",
    permissions: [
      {
        key: "view",
        label: "View",
        legacyPermissions: ["dashboard:view", "work:view_own", "work:view_team", "people:view_own"],
      },
    ],
  },
];

export function getFeatureModule(moduleId: string): FeatureModuleDefinition | undefined {
  return FEATURE_MODULE_REGISTRY.find((m) => m.id === moduleId);
}

export function getAllFeatureModuleIds(): string[] {
  return FEATURE_MODULE_REGISTRY.map((m) => m.id);
}

const NAV_ITEM_MODULE_ALIASES: Partial<Record<NavItemId, string>> = {
  "team-reports": "reports",
  "team-analytics": "analytics",
};

export function getNavItemModuleId(navItemId: NavItemId): string | undefined {
  const alias = NAV_ITEM_MODULE_ALIASES[navItemId];
  if (alias) return alias;
  return FEATURE_MODULE_REGISTRY.find((m) => m.navItemId === navItemId)?.id;
}

/** Resolve enterprise module for a URL path (longest href match). */
export function getFeatureModuleForPathname(pathname: string): FeatureModuleDefinition | undefined {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/";

  if (path === "/validation" || path.startsWith("/validation/")) {
    return getFeatureModule("qa-center");
  }

  if (path === "/work/files" || path.startsWith("/work/files/")) {
    return getFeatureModule("files");
  }

  if (path === "/work" || (path.startsWith("/work/") && !path.startsWith("/work/files"))) {
    return getFeatureModule("employee-workspace");
  }

  const sorted = [...FEATURE_MODULE_REGISTRY]
    .filter((m): m is FeatureModuleDefinition & { href: string } => Boolean(m.href))
    .sort((a, b) => b.href.length - a.href.length);

  for (const mod of sorted) {
    if (path === mod.href || path.startsWith(`${mod.href}/`)) {
      return mod;
    }
  }

  return undefined;
}
