import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { LibraryScoreboard } from "@/components/validation-center/library-scoreboard";
import { LibraryJourneyPanel } from "@/components/validation-center/library-journey";
import { RoiPanel } from "@/components/validation-center/roi-panel";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getLibraryIntelligence } from "@/lib/validation-center/library-intelligence";
import { computeRoiSummary } from "@/lib/validation-center/roi";
import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function LibraryIntelligencePage() {
  const user = await requirePageAccess("/qa-center/library");
  const intel = await getLibraryIntelligence();
  const roi = await computeRoiSummary();

  return (
    <FlowPageShell
      title="Library Intelligence"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Library Intelligence" },
      ]}
      description="The SI Library scoreboard — compliance per manufacturer, what changed since the last audits, and where the review workload lives."
      kpis={
        <KpiStrip
          columns={4}
          items={[
            {
              id: "score",
              label: "Library score",
              value: `${intel.overallCompliance}%`,
              warn: intel.overallCompliance < 85,
              critical: intel.overallCompliance < 70,
            },
            { id: "mfrs", label: "Manufacturers audited", value: intel.totalManufacturers },
            { id: "expected", label: "Expected deliverables", value: intel.totalExpected },
            { id: "passing", label: "Passing", value: intel.totalPassing },
            {
              id: "review",
              label: "Needs review",
              value: intel.totalReview,
              warn: intel.totalReview > 0,
            },
            {
              id: "missing",
              label: "True missing",
              value: intel.trueMissing,
              warn: intel.trueMissing > 0,
              critical: intel.trueMissing > 200,
            },
            { id: "pcs", label: "PCS / naming review", value: intel.pcsReview },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
          <QaCenterSubnav />

          <LibraryJourneyPanel journey={intel.journey} />

          <RoiPanel
            summary={roi}
            canEdit={hasPermission(user.role, "validation:manage_settings")}
          />

          {intel.insights.length > 0 && (
            <section className="enterprise-panel p-4">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" />
                Smart insights
              </h2>
              <ul className="space-y-1.5 text-sm">
                {intel.insights.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {intel.changed.length > 0 && (
            <section className="enterprise-panel p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What changed
              </h2>
              <div className="flex flex-wrap gap-2">
                {intel.changed.map((c) => (
                  <span
                    key={c.manufacturer}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                      c.delta > 0
                        ? "border-emerald-500/40 text-emerald-400"
                        : "border-destructive/40 text-destructive"
                    )}
                  >
                    {c.delta > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {c.manufacturer} {c.delta > 0 ? "+" : ""}
                    {c.delta}% → {c.compliance}%
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Manufacturer scoreboard — click a row for audit history
            </h2>
            <LibraryScoreboard rows={intel.scoreboard} />
          </section>
        </WorkspaceContainer>
      }
    />
  );
}
