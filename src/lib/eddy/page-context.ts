import { capText } from "@/lib/ai/allowlist";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { canAccessRoute } from "@/lib/auth/permissions";
import { getFlowStore } from "@/lib/data/flow-store";
import { stripWorkspaceConfig } from "@/lib/projects/workspace-config";
import type { User } from "@/types/flow";

/**
 * Page awareness for Eddy (AI security rule #2 and #6): each route has a
 * hand-built context builder that sends an allowlisted SUMMARY of what that
 * page already shows, and only after the same route-permission check the page
 * itself enforces. No builder for a route = Eddy sees nothing about it.
 */

const CONTEXT_CHAR_CAP = 6_000;

interface EddyPageContext {
  label: string;
  data: string;
}

function projectHealthContext(user: User): EddyPageContext {
  const store = getFlowStore();
  const projects = store.projects
    .filter((p) => p.status === "active")
    .map((project) => {
      const pkgs = store.workPackages.filter((p) => p.project_id === project.id);
      const done = pkgs.filter((p) => p.status === "done").length;
      const names = (ids: (string | null | undefined)[]) =>
        [...new Set(ids.filter(Boolean) as string[])].map(
          (id) => store.users.find((u) => u.id === id)?.full_name ?? id
        );
      return {
        name: project.name,
        description: capText(stripWorkspaceConfig(project.description), 120) || undefined,
        tasks_done: done,
        tasks_total: pkgs.length,
        overdue: pkgs.filter((p) => p.status !== "done" && p.due_date && p.due_date < new Date().toISOString().slice(0, 10)).length,
        stuck: pkgs.filter((p) => p.status === "stuck").map((p) => p.title),
        assigned: names(pkgs.map((p) => p.assigned_to)),
      };
    });
  return { label: "Project health", data: JSON.stringify(projects) };
}

function operationsContext(user: User): EddyPageContext {
  const store = getFlowStore();
  const byStatus: Record<string, number> = {};
  for (const pkg of store.workPackages) {
    byStatus[pkg.status] = (byStatus[pkg.status] ?? 0) + 1;
  }
  return {
    label: "Operations board",
    data: JSON.stringify({
      tasks_by_status: byStatus,
      active_projects: store.projects.filter((p) => p.status === "active").length,
    }),
  };
}

function myWorkContext(user: User): EddyPageContext {
  const store = getFlowStore();
  const mine = store.workPackages.filter((p) => p.assigned_to === user.id);
  return {
    label: "Your workspace",
    data: JSON.stringify(
      mine.map((p) => ({
        title: p.title,
        status: p.status,
        due: p.due_date,
        qa: p.qa_status,
        estimated_hours: p.estimated_hours,
        actual_hours: p.actual_hours,
      }))
    ),
  };
}

/** Route prefix → { the route whose permission gates it, builder }. */
const CONTEXT_BUILDERS: {
  prefix: string;
  route: string;
  build: (user: User) => EddyPageContext;
}[] = [
  { prefix: "/project-health", route: "/project-health", build: projectHealthContext },
  { prefix: "/projects", route: "/projects", build: projectHealthContext },
  { prefix: "/operations", route: "/operations", build: operationsContext },
  { prefix: "/work", route: "/work", build: myWorkContext },
];

export function buildEddyPageContext(user: User, pathname: string | null): EddyPageContext | null {
  if (!pathname) return null;
  const entry = CONTEXT_BUILDERS.find(
    (b) => pathname === b.prefix || pathname.startsWith(`${b.prefix}/`) || pathname.startsWith(`${b.prefix}?`)
  );
  if (!entry) return null;
  // Authorization parity: only build what this user's role could open itself.
  if (!canAccessRoute(getEffectivePermissionRole(user), entry.route)) return null;
  try {
    const context = entry.build(user);
    return { label: context.label, data: capText(context.data, CONTEXT_CHAR_CAP) };
  } catch {
    return null;
  }
}
