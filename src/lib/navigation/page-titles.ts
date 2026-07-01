const PAGE_TITLES: Record<string, string> = {
  "/operations": "Operations",
  "/operations/templates": "Project Templates",
  "/projects": "Projects",
  "/people": "People",
  "/executive": "Executive Dashboard",
  "/qa-center": "QA Center",
  "/reports": "Reports",
  "/analytics": "Analytics",
  "/performance": "Performance",
  "/production": "Production",
  "/time-clock": "Time Clock",
  "/project-health": "Project Health",
  "/files": "Files",
  "/alert-center": "Alert Center",
  "/notifications": "Notifications",
  "/org-chart": "Org Chart",
  "/wrap-ups": "Daily Reports",
  "/settings": "Settings",
  "/settings/users": "Users",
  "/settings/departments": "Departments",
  "/settings/forecasting": "Forecasting",
  "/settings/workload-alerts": "Workload Alerts",
  "/work": "Workspace",
  "/work/files": "Files & SOPs",
  "/innovation-hub": "Innovation Hub",
  "/docs": "Help & Docs",
  "/scorecard": "Scorecard",
};

export function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/people/")) return "Employee Profile";
  if (pathname.startsWith("/docs/")) return "Help & Docs";
  if (pathname.startsWith("/work/")) return "Task Workspace";
  const match = Object.entries(PAGE_TITLES)
    .filter(([path]) => path !== "/")
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(path));
  return match?.[1] ?? "Flow";
}
