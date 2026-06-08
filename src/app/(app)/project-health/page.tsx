import { ProjectHealthDashboard } from "@/components/project-health/project-health-dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { getProjectHealthList } from "@/lib/data/project-health";

export default async function ProjectHealthPage() {
  await requirePageAccess("/project-health");
  const projects = await getProjectHealthList();

  return (
    <>
      <PageHeader
        title="Project Health"
        description="Progress, hours, QA issues, and projections by project"
      />
      <ProjectHealthDashboard projects={projects} />
    </>
  );
}
