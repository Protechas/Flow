import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { WorkVisibilitySettingsAdmin } from "@/components/work-visibility/work-visibility-settings-admin";
import { requirePageAccess } from "@/lib/auth/guard";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";

export default async function WorkVisibilitySettingsPage() {
  const user = await requirePageAccess("/settings/work-visibility");
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect("/unauthorized");
  }

  const settings = await hydrateWorkVisibilitySettings();

  return (
    <>
      <PageHeader
        title="Work visibility"
        description="Configure activity gap thresholds, compliance targets, and visibility alerts."
      />
      <WorkVisibilitySettingsAdmin settings={settings} />
    </>
  );
}
