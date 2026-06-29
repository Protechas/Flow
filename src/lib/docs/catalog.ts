import type { UserRole } from "@/types/flow";

export type DocCategory = "index" | "getting-started" | "role-guides" | "reference";

export interface DocEntry {
  slug: string;
  file: string;
  title: string;
  description: string;
  category: DocCategory;
  /** Roles that should prioritize this doc on the index page */
  recommendedRoles?: UserRole[];
}

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  index: "Index",
  "getting-started": "Getting Started",
  "role-guides": "Role Guides",
  reference: "Reference",
};

export const DOC_CATALOG: DocEntry[] = [
  {
    slug: "readme",
    file: "README.md",
    title: "Documentation Index",
    description: "Overview of all Flow documentation and reading paths by role.",
    category: "index",
  },
  {
    slug: "quick-start",
    file: "QUICK_START.md",
    title: "Quick Start Guide",
    description: "Day-one onboarding for every role.",
    category: "getting-started",
    recommendedRoles: ["employee", "teamlead", "manager", "senior_manager", "admin", "super_admin", "viewer"],
  },
  {
    slug: "creating-work",
    file: "CREATING_WORK.md",
    title: "Creating Projects & Tasks",
    description: "New Program, New Work hub, boards, tasks, and team-scoped creation.",
    category: "getting-started",
    recommendedRoles: ["teamlead", "manager", "senior_manager", "admin", "super_admin"],
  },
  {
    slug: "team-dashboards",
    file: "TEAM_DASHBOARDS.md",
    title: "Team Dashboards",
    description: "Custom team operating views — KPIs, scope, nav, and in-dashboard work creation.",
    category: "getting-started",
    recommendedRoles: ["manager", "senior_manager", "admin", "super_admin", "teamlead"],
  },
  {
    slug: "team-operating-models",
    file: "TEAM_OPERATING_MODELS.md",
    title: "Team Operating Models",
    description: "Configure labels, KPIs, tracking fields, and forecasting per team.",
    category: "getting-started",
    recommendedRoles: ["admin", "super_admin", "senior_manager"],
  },
  {
    slug: "employee-guide",
    file: "EMPLOYEE_GUIDE.md",
    title: "Employee Guide",
    description: "Workspace, clock, tasks, QA, and daily reports.",
    category: "role-guides",
    recommendedRoles: ["employee"],
  },
  {
    slug: "team-lead-guide",
    file: "TEAM_LEAD_GUIDE.md",
    title: "Team Lead Guide",
    description: "Daily operations, alerts, QA, and wrap-up supervision.",
    category: "role-guides",
    recommendedRoles: ["teamlead"],
  },
  {
    slug: "manager-guide",
    file: "MANAGER_GUIDE.md",
    title: "Manager Guide",
    description: "Team-scoped projects, QA, reporting, and assignments.",
    category: "role-guides",
    recommendedRoles: ["manager"],
  },
  {
    slug: "senior-manager-guide",
    file: "SENIOR_MANAGER_GUIDE.md",
    title: "Senior Manager Guide",
    description: "Org-wide visibility, portfolio risk, and executive reporting.",
    category: "role-guides",
    recommendedRoles: ["senior_manager"],
  },
  {
    slug: "administrator-guide",
    file: "ADMINISTRATOR_GUIDE.md",
    title: "Administrator Guide",
    description: "Users, departments, platform settings, and system health.",
    category: "role-guides",
    recommendedRoles: ["admin", "super_admin"],
  },
  {
    slug: "operations-manual",
    file: "OPERATIONS_MANUAL.md",
    title: "Operations Manual",
    description: "Complete master reference — all 20 sections.",
    category: "reference",
    recommendedRoles: ["manager", "senior_manager", "admin", "super_admin"],
  },
  {
    slug: "feature-reference",
    file: "FEATURE_REFERENCE.md",
    title: "Feature Reference",
    description: "Routes, permissions, workflows, and alert inventory.",
    category: "reference",
  },
  {
    slug: "system-architecture",
    file: "SYSTEM_ARCHITECTURE.md",
    title: "System Architecture",
    description: "Data model, layers, persistence, and engines.",
    category: "reference",
    recommendedRoles: ["admin", "super_admin"],
  },
  {
    slug: "troubleshooting",
    file: "TROUBLESHOOTING.md",
    title: "Troubleshooting Guide",
    description: "Common problems, causes, and resolution steps.",
    category: "reference",
  },
  {
    slug: "system-health-audit",
    file: "SYSTEM_HEALTH_AUDIT.md",
    title: "System Health Audit",
    description: "Known gaps, inconsistencies, and recommendations.",
    category: "reference",
    recommendedRoles: ["admin", "super_admin"],
  },
  {
    slug: "library-audit-center-proposal",
    file: "LIBRARY_AUDIT_CENTER_INTEGRATION_PROPOSAL.md",
    title: "Library Audit Center — Integration Proposal",
    description: "Discovery-phase architecture (superseded by Validation Center plan).",
    category: "reference",
    recommendedRoles: ["admin", "super_admin", "senior_manager"],
  },
  {
    slug: "validation-center-implementation-plan",
    file: "VALIDATION_CENTER_IMPLEMENTATION_PLAN.md",
    title: "Validation Center — Implementation Plan",
    description: "Multi-engine Validation Center platform plan with SI Library Audit as engine #1.",
    category: "reference",
    recommendedRoles: ["admin", "super_admin", "senior_manager"],
  },
];

export function getDocBySlug(slug: string): DocEntry | undefined {
  return DOC_CATALOG.find((d) => d.slug === slug);
}

export function getDocsByCategory(category: DocCategory): DocEntry[] {
  return DOC_CATALOG.filter((d) => d.category === category);
}

export function getRecommendedDocs(role: UserRole): DocEntry[] {
  const normalized = role;
  const recommended = DOC_CATALOG.filter(
    (d) => d.recommendedRoles?.includes(normalized) ?? false
  );
  if (recommended.length > 0) return recommended;
  return DOC_CATALOG.filter((d) => d.slug === "quick-start" || d.slug === "readme");
}

export function docHref(slug: string): string {
  return `/docs/${slug}`;
}
