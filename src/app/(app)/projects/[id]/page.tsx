import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { ProgramBuilder } from "@/components/work-creation/program-builder";
import { CreateTaskComposer } from "@/components/work-creation/create-task-composer";
import { CreateBoardWizard } from "@/components/work-creation/create-board-wizard";
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
import { getAllowedCreationModes, usesManagerWorkHub } from "@/lib/work-creation/permissions";
import { ManagerWorkSetup } from "@/components/work-creation/manager-work-setup";
import { projectOwnerCandidates } from "@/lib/work-creation/client-defaults";
import { getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { ChevronLeft } from "lucide-react";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ department?: string }>;
}) {
  await requirePageAccess("/projects");
  const user = await getCurrentUser();
  if (!user) return null;

  const { id: projectId } = await params;
  const { department: deptParam } = await searchParams;
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

  const project = allProjects.find((p) => p.id === projectId);
  if (!project) notFound();

  if (departmentFilter && project.department_id !== departmentFilter) {
    notFound();
  }

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

  if (!scopedProjects.some((p) => p.id === projectId)) {
    notFound();
  }

  const projectIds = new Set([projectId]);
  const scopedManufacturers = manufacturers.filter((m) => m.project_id === projectId);
  const scopedYearItems = yearItems.filter((y) => y.project_id === projectId);
  const scopedPackages = store.workPackages.filter((p) => p.project_id === projectId);

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
  const managerWorkHub = usesManagerWorkHub(user.role);
  const activeProjects = scopedProjects.filter(isActiveProject);
  const labels = getProjectHierarchyLabels(project);

  return (
    <FlowPageShell
      title={project.name}
      eyebrow={PLATFORM_EYEBROWS.projects}
      breadcrumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name },
      ]}
      description={`Program workspace — ${labels.workPackagePlural.toLowerCase()}, ${labels.phasePlural.toLowerCase()}, and ${labels.taskPlural.toLowerCase()}`}
      headerActions={
        <FilterToolbar>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground h-8 px-2"
          >
            <ChevronLeft className="h-4 w-4" />
            All projects
          </Link>
          {allowedModes.length > 0 && (
            <>
              {allowedModes.includes("project") && (
                <ProgramBuilder
                  user={user}
                  departments={departments}
                  teams={listTeamsStore()}
                  managers={projectOwners}
                  forecastSettings={store.forecastSettings}
                />
              )}
              {managerWorkHub && (
                <ManagerWorkSetup
                  user={user}
                  departments={departments}
                  teams={listTeamsStore()}
                  projects={activeProjects}
                  manufacturers={manufacturers.filter((m) =>
                    activeProjects.some((p) => p.id === m.project_id)
                  )}
                  yearItems={yearItems.filter((y) =>
                    activeProjects.some((p) => p.id === y.project_id)
                  )}
                  analysts={analysts}
                  forecastSettings={store.forecastSettings}
                  defaultProjectId={projectId}
                />
              )}
              {!managerWorkHub && allowedModes.includes("task") && (
                <CreateTaskComposer
                  user={user}
                  projects={activeProjects}
                  manufacturers={manufacturers.filter((m) =>
                    activeProjects.some((p) => p.id === m.project_id)
                  )}
                  yearItems={yearItems.filter((y) =>
                    activeProjects.some((p) => p.id === y.project_id)
                  )}
                  analysts={analysts}
                  forecastSettings={store.forecastSettings}
                  defaultProjectId={projectId}
                />
              )}
              {!managerWorkHub && allowedModes.includes("board") && (
                <CreateBoardWizard
                  user={user}
                  departments={departments}
                  teams={listTeamsStore()}
                />
              )}
            </>
          )}
          <DepartmentFilterBar departments={departments} />
        </FilterToolbar>
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <ProjectWorkspace
            projects={[project]}
            archivedProjects={project.status === "archived" ? [project] : []}
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
            initialProjectId={projectId}
            singleProjectMode
          />
        </WorkspaceContainer>
      }
    />
  );
}
