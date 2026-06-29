import { OperatingModelBuilder } from "@/components/operating-models/operating-model-builder";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { EMPTY_OPERATING_MODEL_INPUT } from "@/lib/operating-models/form";
import { getActiveDepartments } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NewOperatingModelPage() {
  await requirePageAccess("/settings/operating-models");
  const user = await getCurrentUser();
  await ensureAppDataLoaded();
  initFlowStore();
  const store = getFlowStore();
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user!)
  );

  return (
    <FlowPageShell
      title="New operating model"
      eyebrow="Administration"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Operating models", href: "/settings/operating-models" },
        { label: "New" },
      ]}
      workspace={
        <WorkspaceContainer elevated={false}>
          <OperatingModelBuilder
            initial={EMPTY_OPERATING_MODEL_INPUT}
            teams={store.teams}
            departments={departments}
            mode="create"
          />
        </WorkspaceContainer>
      }
    />
  );
}
