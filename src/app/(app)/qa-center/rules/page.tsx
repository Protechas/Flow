import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { RuleEngineView } from "@/components/qa-center/rule-engine-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationRulesHydrated } from "@/lib/qa-center/rules/engine";

export default async function QaCenterRulesPage() {
  await requirePageAccess("/qa-center/rules");
  const rules = await listValidationRulesHydrated();

  return (
    <FlowPageShell
      title="Rule Engine"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Rule Engine" },
      ]}
      description="Configure validation rules without code — persisted to database and applied on every validation run."
      workspace={
        <WorkspaceContainer elevated={false}>
          <RuleEngineView rules={rules} />
        </WorkspaceContainer>
      }
    />
  );
}
