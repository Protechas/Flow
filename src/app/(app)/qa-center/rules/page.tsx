import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { RuleEngineView } from "@/components/qa-center/rule-engine-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationRulesHydrated } from "@/lib/qa-center/rules/engine";
import { listKnowledgeEntries } from "@/lib/qa-center/knowledge/store";
import {
  evaluateSopFreshness,
  SOP_DRIVEN_RULE_KEYS,
  SOP_RULE_CATEGORIES,
} from "@/lib/qa-center/rules/sop-freshness";

export default async function QaCenterRulesPage() {
  await requirePageAccess("/qa-center/rules");
  const rules = await listValidationRulesHydrated();

  const sopCategories = new Set<string>(SOP_RULE_CATEGORIES);
  const sopEntries = (await listKnowledgeEntries())
    .filter((e) => !e.is_archived && sopCategories.has(e.category))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const sopDrivenRuleKeys = new Set<string>(SOP_DRIVEN_RULE_KEYS);
  const latestRuleUpdatedAt = rules
    .filter((r) => sopDrivenRuleKeys.has(r.rule_key))
    .map((r) => r.updated_at)
    .sort()
    .at(-1) ?? null;

  const sopNudge = evaluateSopFreshness({
    latestSopUpdatedAt: sopEntries[0]?.updated_at ?? null,
    latestRuleUpdatedAt,
    latestSopTitle: sopEntries[0]?.title ?? null,
  });

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
          <RuleEngineView rules={rules} sopNudge={sopNudge} />
        </WorkspaceContainer>
      }
    />
  );
}
