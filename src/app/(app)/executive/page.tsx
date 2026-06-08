import { CommandCenterView } from "@/components/command-center/command-center-view";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { getCommandCenterMetrics } from "@/lib/data/command-center";

export default async function ExecutivePage() {
  await requirePageAccess("/executive");
  const data = await getCommandCenterMetrics();

  return (
    <>
      <PageHeader
        title="Command Center"
        description="Executive operations overview — health, workload, project risk, and team performance"
      />
      <CommandCenterView data={data} />
    </>
  );
}
