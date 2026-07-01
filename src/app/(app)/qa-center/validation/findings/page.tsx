import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationFindingsHub } from "@/components/validation-center/validation-findings-hub";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnalysts, getProjects } from "@/lib/data/projects";
import { getValidationFindingStats, listValidationFindings } from "@/lib/validation-center/findings";

export default async function QaCenterValidationFindingsPage() {
  await requirePageAccess("/qa-center/validation/findings");
  const [findings, projects, analysts, user] = await Promise.all([
    listValidationFindings(),
    getProjects(),
    getAnalysts(),
    getCurrentUser(),
  ]);
  const stats = getValidationFindingStats(findings);
  const canCreateTasks = user ? hasPermission(user.role, "validation:create_tasks") : false;

  return (
    <FlowPageShell
      title="Findings"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Validation Queue", href: "/qa-center/validation" },
        { label: "Findings" },
      ]}
      description="Search, filter, and review normalized validation findings."
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { label: "Total Findings", value: stats.total },
            { label: "Open", value: stats.open, warn: stats.open > 0 },
            {
              label: "Critical / High Open",
              value: stats.criticalOpen,
              critical: stats.criticalOpen > 0,
            },
            { label: "High Severity", value: stats.bySeverity.high + stats.bySeverity.critical },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationSubnav />
          <ValidationFindingsHub
            initialFindings={findings}
            projects={projects}
            analysts={analysts}
            canCreateTasks={canCreateTasks}
          />
        </WorkspaceContainer>
      }
    />
  );
}
