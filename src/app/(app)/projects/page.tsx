import { PageHeader } from "@/components/layout/page-header";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { requirePageAccess } from "@/lib/auth/guard";
import { canDeleteProjects, hasPermission } from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { isActiveProject } from "@/lib/data/entity-filters";
import {
  getAnalysts,
  getManagers,
  getManufacturers,
  getProjectsWithStats,
  getYearWorkItems,
} from "@/lib/data/projects";
import { enrichPackages } from "@/lib/data/flow-store";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ProjectsPage() {
  await requirePageAccess("/projects");
  const user = await getCurrentUser();

  initFlowStore();
  const store = getFlowStore();

  const [allProjects, manufacturers, yearItems, managers, analysts] = await Promise.all([
    getProjectsWithStats(true),
    getManufacturers(undefined, true),
    getYearWorkItems(),
    getManagers(),
    getAnalysts(),
  ]);

  const projects = allProjects.filter(isActiveProject);
  const archivedProjects = allProjects.filter((p) => p.status === "archived");
  const workPackages = enrichPackages(store.workPackages);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Create projects, manufacturers, and year work items"
      />
      <ProjectWorkspace
        projects={projects}
        archivedProjects={archivedProjects}
        manufacturers={manufacturers}
        yearItems={yearItems}
        workPackages={workPackages}
        managers={managers}
        analysts={analysts}
        canEdit={user ? hasPermission(user.role, "projects:edit") : false}
        canDelete={user ? canDeleteProjects(user.role) : false}
      />
    </>
  );
}
