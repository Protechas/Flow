import { notFound } from "next/navigation";
import { OperatingModelBuilder } from "@/components/operating-models/operating-model-builder";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { hydrateOperatingModels } from "@/lib/operating-models/hydrate";
import { modelToFormInput } from "@/lib/operating-models/form";
import { getOperatingModel } from "@/lib/operating-models/store";
import { getActiveDepartments } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getCurrentUser } from "@/lib/auth/session";

export default async function EditOperatingModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePageAccess("/settings/operating-models");
  const { slug } = await params;
  const user = await getCurrentUser();
  await ensureAppDataLoaded();
  await hydrateOperatingModels();
  initFlowStore();
  const model = getOperatingModel(slug);
  if (!model) notFound();

  const store = getFlowStore();
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user!)
  );

  return (
    <FlowPageShell
      title={model.label}
      eyebrow="Administration"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Operating models", href: "/settings/operating-models" },
        { label: model.label },
      ]}
      workspace={
        <WorkspaceContainer elevated={false}>
          <OperatingModelBuilder
            initial={modelToFormInput(model)}
            teams={store.teams}
            departments={departments}
            mode="edit"
          />
        </WorkspaceContainer>
      }
    />
  );
}
