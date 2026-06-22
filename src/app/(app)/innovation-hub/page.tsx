import { PageHeader } from "@/components/layout/page-header";
import { InnovationHubAdminPanel } from "@/components/innovation-hub/innovation-hub-admin-panel";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { requirePageAccess } from "@/lib/auth/guard";
import { listFeedbackSubmissions } from "@/lib/innovation-hub/feedback";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import type { FeedbackStatus } from "@/types/flow";

function countByStatus(items: { status: FeedbackStatus }[], status: FeedbackStatus) {
  return items.filter((i) => i.status === status).length;
}

export default async function InnovationHubPage() {
  await requirePageAccess("/innovation-hub");
  const items = await listFeedbackSubmissions();
  initFlowStore();
  const store = getFlowStore();

  const assignableUsers = store.users
    .filter(
      (u) =>
        u.is_active &&
        ["admin", "super_admin", "senior_manager", "manager"].includes(u.role)
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <PageHeader
        title="Innovation Hub"
        eyebrow="Continuous Improvement"
        breadcrumbs={[{ label: "Innovation Hub" }]}
        description="Review ideas, bugs, issues, and feature requests submitted by your team."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <EnterpriseKpi label="Total submissions" value={items.length} />
        <EnterpriseKpi
          label="New"
          value={countByStatus(items, "new")}
          warn={countByStatus(items, "new") > 0}
        />
        <EnterpriseKpi label="Investigating" value={countByStatus(items, "investigating")} />
        <EnterpriseKpi label="High priority" value={items.filter((i) => i.priority === "high").length} />
      </div>

      <InnovationHubAdminPanel initialItems={items} assignableUsers={assignableUsers} />
    </>
  );
}
