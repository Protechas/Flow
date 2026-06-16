import { PageHeader } from "@/components/layout/page-header";
import { ProductionReportsView } from "@/components/production/production-reports-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getProductionReport } from "@/lib/data/production-tracking";

export default async function ProductionPage() {
  const user = await requirePageAccess("/production");
  initFlowStore();
  const store = getFlowStore();

  const branchIds = getScopeMemberIds(user, store.users, store.teams);

  const report = getProductionReport(
    branchIds?.length ? { userIds: branchIds } : {}
  );

  const visibleUsers = branchIds?.length
    ? store.users.filter((u) => branchIds.includes(u.id))
    : store.users;

  return (
    <>
      <PageHeader
        title={branchIds ? "Team Production" : "Production Tracking"}
        description={
          branchIds
            ? "Team productivity — time per task, documents completed, and QA submission pipeline"
            : "Time per task, documents completed, productivity rates, and QA submission pipeline"
        }
      />
      <ProductionReportsView
        report={report}
        users={visibleUsers}
        projects={store.projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </>
  );
}
