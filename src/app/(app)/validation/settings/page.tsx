import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { ValidationSettingsForm } from "@/components/validation-center/validation-settings-form";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { getSiLibrarySettings } from "@/lib/validation-center/runs";

export default async function ValidationSettingsPage() {
  await requirePageAccess("/validation/settings");
  const settings = await getSiLibrarySettings();

  return (
    <FlowPageShell
      title="Validation Settings"
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[
        { label: "Validation Center", href: "/validation" },
        { label: "Settings" },
      ]}
      description="Configure SI Library Audit rules, aliases, and engine defaults."
      workspace={
        <WorkspaceContainer elevated={false}>
          <ValidationSubnav />
          <ValidationSettingsForm initialSettings={settings} />
        </WorkspaceContainer>
      }
    />
  );
}
