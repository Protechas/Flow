import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { NewWorkWizard } from "@/components/work-creation/new-work-wizard";
import { DepartmentFilterBar } from "@/components/departments/department-filter-bar";
import {
  FilterToolbar,
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { canDeleteProjects, hasPermission } from "@/lib/auth/permissions";
import { enrichPackages, getFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { isActiveProject } from "@/lib/data/entity-filters";
import { parseDepartmentFilter } from "@/lib/departments/filters";
import { filterDepartmentsForViewer, getViewerDepartmentIds } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";
import {
  getAnalysts,
  getManagers,
  getManufacturers,
  getProjectsWithStats,
  getYearWorkItems,
} from "@/lib/data/projects";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { ensureProjectMetricsHydrated } from "@/lib/data/project-metrics-db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import { projectOwnerCandidates } from "@/lib/work-creation/client-defaults";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; projectId?: string; highlight?: string }>;
}) {
  await requirePageAccess("/projects");
  const user = await getCurrentUser();
  if (!user) return null;
  const { department: deptParam, projectId, highlight } = await searchParams;
  const initialProjectId = (projectId ?? highlight)?.trim() || undefined;
  const departmentFilter = parseDepartmentFilter({ department: deptParam });

  await hydrateForecastSettings();
  await ensureProjectMetricsHydrated();
  const store = getFlowStore();
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user)
  );
  const branchIds = getScopeMemberIds(user, store.users, store.teams);
  const viewerDeptIds = getViewerDepartmentIds(user);

  const [allProjects, manufacturers, yearItems, managers, allAnalysts] = await Promise.all([
    getProjectsWithStats(true),
    getManufacturers(undefined, true),
    getYearWorkItems(),
    getManagers(),
    getAnalysts(),
  ]);

  let scopedProjects = allProjects;
  if (branchIds?.length) {
    const branchProjectIds = new Set(
      store.workPackages
        .filter((p) => p.assigned_to && branchIds.includes(p.assigned_to))
        .map((p) => p.project_id)
    );
    if (user.team_id) {
      allProjects
        .filter((p) => p.team_id === user.team_id)
        .forEach((p) => branchProjectIds.add(p.id));
    }
    scopedProjects = allProjects.filter(
      (p) =>
        branchProjectIds.has(p.id) ||
        p.project_owner_id === user.id ||
        p.created_by === user.id ||
        (viewerDeptIds != null &&
          p.department_id != null &&
          viewerDeptIds.includes(p.department_id))
    );
  }

  if (departmentFilter) {
    scopedProjects = scopedProjects.filter((p) => p.department_id === departmentFilter);
  }

  const projects = scopedProjects.filter(isActiveProject);
  const archivedProjects = scopedProjects.filter((p) => p.status === "archived");

  const projectIds = new Set(scopedProjects.map((p) => p.id));
  const scopedManufacturers = manufacturers.filter((m) => projectIds.has(m.project_id));
  const scopedYearItems = yearItems.filter((y) => projectIds.has(y.project_id));
  const scopedPackages = store.workPackages.filter((p) => projectIds.has(p.project_id));

  const analysts = branchIds?.length
    ? allAnalysts.filter((a) => branchIds.includes(a.id))
    : allAnalysts;

  const workPackages = enrichPackages(scopedPackages);

  const isBranchScoped = Boolean(branchIds?.length);

  const projectOwners = isBranchScoped
    ? projectOwnerCandidates(managers, user).filter(
        (m) =>
          m.id === user.id ||
          m.role === "manager" ||
          m.role === "senior_manager" ||
          m.role === "admin" ||
          m.role === "super_admin"
      )
    : projectOwnerCandidates(managers, user);

  const allowedModes = getAllowedCreationModes(user.role);

  return (
    <FlowPageShell
      title={isBranchScoped ? "Team Projects" : "Project Portfolio"}
      eyebrow={PLATFORM_EYEBROWS.projects}
      breadcrumbs={[{ label: isBranchScoped ? "Team Projects" : "Projects" }]}
      description={
        isBranchScoped
          ? "Build and monitor projects, manufacturers, years, and tasks for your branch"
          : "Scan project health, forecast risk, and work structure — then drill into manufacturers, years, and tasks"
      }
      headerActions={
        <FilterToolbar>
          {allowedModes.length > 0 && (
            <NewWorkWizard
              user={user}
              departments={departments}
              teams={listTeamsStore()}
              projects={projects}
              analysts={analysts}
              managers={projectOwners}
              forecastSettings={store.forecastSettings}
              workPackages={store.workPackages}
            />
          )}
          <DepartmentFilterBar departments={departments} />
        </FilterToolbar>
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <ProjectWorkspace
            projects={projects}
            archivedProjects={archivedProjects}
            manufacturers={scopedManufacturers}
            yearItems={scopedYearItems}
            workPackages={workPackages}
            managers={projectOwners}
            analysts={analysts}
            forecastSettings={store.forecastSettings}
            canEdit={hasPermission(user.role, "projects:edit")}
            canDelete={canDeleteProjects(user.role)}
            user={user}
            departments={departments}
            teams={listTeamsStore()}
            qaReviews={store.qaReviews}
            activity={store.activity}
            initialProjectId={initialProjectId}
            highlightProjectId={highlight?.trim() || undefined}
          />
        </WorkspaceContainer>
      }
    />
  );
}
