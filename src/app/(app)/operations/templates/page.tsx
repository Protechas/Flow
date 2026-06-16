import { TemplateLibraryView } from "@/components/templates/template-library-view";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { getManagers } from "@/lib/data/projects";
import { getFlowStore, initFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { getActiveDepartments } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { isActiveProject } from "@/lib/data/entity-filters";
import {
  getAllTemplateUsageRecords,
  getTemplateUsageStats,
  listEnterpriseTemplates,
} from "@/lib/templates/template-registry";

export default async function ProjectTemplatesPage() {
  const user = await requirePageAccess("/operations/templates");
  initFlowStore();
  const store = getFlowStore();
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user)
  );
  const templates = listEnterpriseTemplates();
  const usageRecords = getAllTemplateUsageRecords();
  const usageByTemplate: Record<string, number> = {};
  for (const t of templates) {
    const stats = getTemplateUsageStats(t.id);
    usageByTemplate[t.id] = Math.max(stats.projectsCreated, usageRecords.filter((r) => r.templateId === t.id).length);
  }
  const managers = await getManagers();
  const projects = store.projects.filter(isActiveProject);

  return (
    <>
      <PageHeader
        title="Project Templates"
        eyebrow="Operations"
        breadcrumbs={[
          { label: "Operations", href: "/operations" },
          { label: "Templates" },
        ]}
        description="Browse, preview, and launch enterprise projects from reusable templates."
      />
      <TemplateLibraryView
        user={user}
        templates={templates}
        usageByTemplate={usageByTemplate}
        departments={departments}
        teams={listTeamsStore()}
        projects={projects}
        managers={managers}
      />
    </>
  );
}
