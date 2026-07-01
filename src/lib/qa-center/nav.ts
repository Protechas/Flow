import type { QaCenterNavItem } from "@/lib/qa-center/types";

export const QA_CENTER_BASE = "/qa-center";

export const QA_CENTER_NAV: QaCenterNavItem[] = [
  {
    id: "dashboard",
    href: "/qa-center",
    label: "Dashboard",
    description: "QA KPIs, trends, and quick actions",
    permissions: ["validation:view", "qa:view"],
  },
  {
    id: "upload",
    href: "/qa-center/upload",
    label: "Upload Queue",
    description: "Bulk document intake and batch processing",
    permissions: ["validation:create", "validation:view"],
  },
  {
    id: "validation",
    href: "/qa-center/validation",
    label: "Validation Queue",
    description: "Automated validation runs and engine results",
    permissions: ["validation:view"],
  },
  {
    id: "review",
    href: "/qa-center/review",
    label: "Review Queue",
    description: "Human QA review of submitted work",
    permissions: ["qa:review", "qa:view"],
  },
  {
    id: "knowledge",
    href: "/qa-center/knowledge",
    label: "Knowledge Library",
    description: "SOPs, charts, and reference material for the QA engine",
    permissions: ["validation:view"],
  },
  {
    id: "rules",
    href: "/qa-center/rules",
    label: "Rule Engine",
    description: "Configure validation rules without code",
    permissions: ["validation:manage_settings"],
  },
  {
    id: "reports",
    href: "/qa-center/reports",
    label: "Reports",
    description: "Executive summaries and exportable QA reports",
    permissions: ["validation:export", "validation:view"],
  },
  {
    id: "analytics",
    href: "/qa-center/analytics",
    label: "Analytics",
    description: "Analyst performance, error trends, manufacturer insights",
    permissions: ["validation:view"],
  },
  {
    id: "settings",
    href: "/qa-center/settings",
    label: "Settings",
    description: "Engine configuration and platform preferences",
    permissions: ["validation:manage_settings"],
  },
];

export function isQaCenterNavActive(href: string, pathname: string): boolean {
  if (href === "/qa-center") return pathname === "/qa-center";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Legacy Validation Center paths mapped to QA Center sections */
export const VALIDATION_TO_QA_CENTER_REDIRECTS: Record<string, string> = {
  "/validation": "/qa-center/validation",
  "/validation/new": "/qa-center/validation/new",
  "/validation/runs": "/qa-center/validation/runs",
  "/validation/findings": "/qa-center/validation/findings",
  "/validation/corrections": "/qa-center/validation/corrections",
  "/validation/history": "/qa-center/validation/history",
  "/validation/reports": "/qa-center/reports",
  "/validation/analytics": "/qa-center/analytics",
  "/validation/settings": "/qa-center/settings",
};
