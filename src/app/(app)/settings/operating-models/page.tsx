import { OperatingModelsAdmin } from "@/components/operating-models/operating-models-admin";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { hydrateOperatingModels } from "@/lib/operating-models/hydrate";
import { listOperatingModels } from "@/lib/operating-models/store";
import { getActiveDepartments } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getCurrentUser } from "@/lib/auth/session";

export default async function OperatingModelsSettingsPage() {
  await requirePageAccess("/settings/operating-models");
  const user = await getCurrentUser();
  await ensureAppDataLoaded();
  await hydrateOperatingModels();
  initFlowStore();
  const store = getFlowStore();
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user!)
  );
  const models = listOperatingModels();

  return (
    <FlowPageShell
      title="Team operating models"
      eyebrow="Administration"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Operating models" },
      ]}
      description="Configure how each department and team works — labels, tracking, KPIs, and forecasting — without forcing every team into the same workflow."
      workspace={
        <WorkspaceContainer elevated={false}>
          <OperatingModelsAdmin
            models={models}
            teams={store.teams}
            departments={departments}
          />
        </WorkspaceContainer>
      }
    />
  );
}
