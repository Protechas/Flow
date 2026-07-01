import type { ValidationNavItem } from "@/lib/validation-center/types";

export const VALIDATION_BASE = "/qa-center/validation";

export function validationPath(suffix = ""): string {
  if (!suffix) return VALIDATION_BASE;
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${VALIDATION_BASE}${normalized}`;
}

export const VALIDATION_CENTER_NAV: ValidationNavItem[] = [
  {
    href: validationPath(),
    label: "Dashboard",
    description: "Validation KPIs and quick actions",
  },
  {
    href: validationPath("/new"),
    label: "New Audit",
    description: "Start a validation run",
  },
  {
    href: validationPath("/runs"),
    label: "Audit Runs",
    description: "Past and in-progress runs",
  },
  {
    href: validationPath("/findings"),
    label: "Findings",
    description: "Search and review validation findings",
  },
  {
    href: validationPath("/corrections"),
    label: "Corrections",
    description: "Track correction progress",
  },
  {
    href: validationPath("/history"),
    label: "Validation History",
    description: "Revalidation and comparisons",
  },
  {
    href: "/qa-center/reports",
    label: "Reports",
    description: "Exports and trend reports",
  },
  {
    href: "/qa-center/analytics",
    label: "Analytics",
    description: "Root cause and accuracy analytics",
  },
  {
    href: "/qa-center/settings",
    label: "Settings",
    description: "Engine rules and configuration",
  },
];

export function isValidationNavActive(href: string, pathname: string): boolean {
  if (href === VALIDATION_BASE) return pathname === VALIDATION_BASE;
  return pathname === href || pathname.startsWith(`${href}/`);
}
