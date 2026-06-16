import { PageHeader } from "@/components/layout/page-header";
import { ForecastSettingsAdmin } from "@/components/forecast/forecast-settings-admin";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { requirePageAccess } from "@/lib/auth/guard";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";

export default async function ForecastingSettingsPage() {
  await requirePageAccess("/settings/forecasting");
  const settings = await hydrateForecastSettings();

  return (
    <>
      <PageHeader
        title="Forecasting Settings"
        description="Configure document-based due date calculations for tasks and projects"
      />
      <EnterpriseSection
        title="Production defaults"
        description="Company-wide rates used when calculating suggested due dates from document estimates and production pace."
      >
        <ForecastSettingsAdmin settings={settings} />
      </EnterpriseSection>
    </>
  );
}
