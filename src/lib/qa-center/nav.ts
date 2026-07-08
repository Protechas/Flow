import type { QaCenterNavItem } from "@/lib/qa-center/types";

export const QA_CENTER_BASE = "/qa-center";

export const QA_CENTER_WING_LABELS: Record<"review" | "audit", string> = {
  review: "Review",
  audit: "Audit Engine",
};

export const QA_CENTER_NAV: QaCenterNavItem[] = [
  {
    id: "dashboard",
    href: "/qa-center",
    label: "Dashboard",
    description: "QA KPIs, trends, and quick actions",
    wing: null,
    permissions: ["validation:view", "qa:view"],
  },
  // ——— Review wing: human QA of submitted work ———
  {
    id: "review",
    href: "/qa-center/review",
    label: "Review Queue",
    description: "Human QA review of submitted work and in-progress batches",
    wing: "review",
    permissions: ["qa:review", "qa:view"],
  },
  {
    id: "knowledge",
    href: "/qa-center/knowledge",
    label: "Knowledge Library",
    description: "SOPs, charts, and reference material for reviewers and the engine",
    wing: "review",
    permissions: ["validation:view"],
  },
  {
    id: "reports",
    href: "/qa-center/reports",
    label: "Reports",
    description: "Executive summaries and exportable QA reports",
    wing: "review",
    permissions: ["validation:export", "validation:view"],
  },
  // ——— Audit Engine wing: automated SI Library validation ———
  {
    id: "upload",
    href: "/qa-center/upload",
    label: "Upload Queue",
    description: "Bulk document intake and batch processing",
    wing: "audit",
    permissions: ["validation:create", "validation:view"],
  },
  {
    id: "validation",
    href: "/qa-center/validation",
    label: "Audit Runs",
    description: "Automated validation runs and engine results",
    wing: "audit",
    permissions: ["validation:view"],
  },
  {
    id: "rules",
    href: "/qa-center/rules",
    label: "Rule Engine",
    description: "Configure validation rules without code",
    wing: "audit",
    permissions: ["validation:manage_settings"],
  },
  {
    id: "analytics",
    href: "/qa-center/analytics",
    label: "Analytics",
    description: "Analyst performance, error trends, manufacturer insights",
    wing: "audit",
    permissions: ["validation:view"],
  },
  {
    id: "settings",
    href: "/qa-center/settings",
    label: "Settings",
    description: "Engine configuration and platform preferences",
    wing: "audit",
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
