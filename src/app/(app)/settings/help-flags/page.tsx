import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { HelpFlagSettingsAdmin } from "@/components/help-flags/help-flag-settings-admin";
import { requirePageAccess } from "@/lib/auth/guard";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";

export default async function HelpFlagsSettingsPage() {
  const user = await requirePageAccess("/settings/help-flags");
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect("/unauthorized");
  }

  const settings = await hydrateHelpFlagSettings();

  return (
    <>
      <PageHeader
        title="Help flags"
        description="Configure escalation timing for employee help requests."
      />
      <HelpFlagSettingsAdmin settings={settings} />
    </>
  );
}
