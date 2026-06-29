import type { ValidationNavItem } from "@/lib/validation-center/types";

export const VALIDATION_CENTER_NAV: ValidationNavItem[] = [
  {
    href: "/validation",
    label: "Dashboard",
    description: "Validation KPIs and quick actions",
  },
  {
    href: "/validation/new",
    label: "New Audit",
    description: "Start a validation run",
  },
  {
    href: "/validation/runs",
    label: "Audit Runs",
    description: "Past and in-progress runs",
  },
  {
    href: "/validation/findings",
    label: "Findings",
    description: "Search and review validation findings",
  },
  {
    href: "/validation/corrections",
    label: "Corrections",
    description: "Track correction progress",
  },
  {
    href: "/validation/history",
    label: "Validation History",
    description: "Revalidation and comparisons",
  },
  {
    href: "/validation/reports",
    label: "Reports",
    description: "Exports and trend reports",
  },
  {
    href: "/validation/analytics",
    label: "Analytics",
    description: "Root cause and accuracy analytics",
  },
  {
    href: "/validation/settings",
    label: "Settings",
    description: "Engine rules and configuration",
  },
];

export function isValidationNavActive(href: string, pathname: string): boolean {
  if (href === "/validation") return pathname === "/validation";
  return pathname === href || pathname.startsWith(`${href}/`);
}
