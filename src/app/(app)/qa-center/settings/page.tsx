import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationSettingsForm } from "@/components/validation-center/validation-settings-form";
import { requirePageAccess } from "@/lib/auth/guard";
import { getSiLibrarySettings } from "@/lib/validation-center/runs";

export default async function QaCenterSettingsPage() {
  await requirePageAccess("/qa-center/settings");
  const settings = await getSiLibrarySettings();

  return (
    <FlowPageShell
      title="Settings"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Settings" },
      ]}
      description="SI Library audit engine configuration, aliases, and platform preferences."
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationSettingsForm initialSettings={settings} />
        </WorkspaceContainer>
      }
    />
  );
}
