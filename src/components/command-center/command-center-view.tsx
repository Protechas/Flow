import Link from "next/link";
import { MetricExplainer } from "@/components/command-center/metric-explainer";
import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTd, EnterpriseTh } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { CommandCenterMetrics } from "@/types/flow";
import { ArrowRight, ExternalLink } from "lucide-react";

export function CommandCenterView({ data }: { data: CommandCenterMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetricExplainer explanation={data.teamHealth.scoreExplanations.flow}>
          <EnterpriseKpi
            label="Operational Health"
            value={data.teamHealth.flowScore}
            sublabel="Flow Score"
          />
        </MetricExplainer>
        <EnterpriseKpi
          label="Projects At Risk"
          value={data.projectHealth.atRisk}
          href="/project-health"
          warn={data.projectHealth.atRisk > 0}
        />
        <EnterpriseKpi
          label="QA Queue"
          value={data.qaHealth.queueSize}
          href="/qa-center"
          warn={data.qaHealth.queueSize > 0}
        />
        <EnterpriseKpi
          label="Overdue Work"
          value={data.workload.overdue}
          href="/operations"
          warn={data.workload.overdue > 0}
        />
        <MetricExplainer explanation={data.teamHealth.scoreExplanations.productivity}>
          <EnterpriseKpi
            label="Team Productivity"
            value={data.teamHealth.productivityScore}
          />
        </MetricExplainer>
        <MetricExplainer explanation={data.teamHealth.scoreExplanations.quality}>
          <EnterpriseKpi
            label="Team Quality"
            value={data.teamHealth.qualityScore}
          />
        </MetricExplainer>
        <EnterpriseKpi
          label="Top Performer"
          value={data.teamHealth.topPerformer?.name ?? "—"}
          sublabel={
            data.teamHealth.topPerformer
              ? `Score ${data.teamHealth.topPerformer.flowScore}`
              : undefined
          }
          href={
            data.teamHealth.topPerformer
              ? `/people/${data.teamHealth.topPerformer.userId}`
              : undefined
          }
        />
        <EnterpriseKpi
          label="Needs Attention"
          value={data.teamHealth.needsAttention?.name ?? "—"}
          sublabel={data.teamHealth.needsAttention?.reason}
          href={
            data.teamHealth.needsAttention
              ? `/people/${data.teamHealth.needsAttention.userId}`
              : undefined
          }
          warn={!!data.teamHealth.needsAttention}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" render={<Link href="/operations" />}>
          Operations Board <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
        <Button size="sm" variant="outline" render={<Link href="/qa-center" />}>
          QA Queue <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
        <Button size="sm" variant="outline" render={<Link href="/people" />}>
          People <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
        <Button size="sm" variant="outline" render={<Link href="/reports" />}>
          Reports <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EnterpriseSection
          title="Workload Summary"
          description={`${data.workload.avgActivePerEmployee} avg active packages per analyst`}
        >
          <EnterpriseDataTable>
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTh>Metric</EnterpriseTh>
                <EnterpriseTh align="right">Count</EnterpriseTh>
                <EnterpriseTh align="right">Action</EnterpriseTh>
              </tr>
            </EnterpriseTableHead>
            <tbody>
              <WorkloadRow label="Active" value={data.workload.active} href="/operations" />
              <WorkloadRow label="In Progress" value={data.workload.inProgress} href="/operations" />
              <WorkloadRow label="Ready For QA" value={data.workload.readyForQa} href="/qa-center" warn={data.workload.readyForQa > 0} />
              <WorkloadRow label="Correction Required" value={data.workload.correctionNeeded} href="/operations" warn={data.workload.correctionNeeded > 0} />
              <WorkloadRow label="Overdue" value={data.workload.overdue} href="/operations" warn={data.workload.overdue > 0} />
              <WorkloadRow label="Blocked" value={data.workload.stuck} href="/operations" warn={data.workload.stuck > 0} />
            </tbody>
          </EnterpriseDataTable>
        </EnterpriseSection>

        <EnterpriseSection title="QA Operations" description="Queue health and correction trends">
          <EnterpriseDataTable>
            <EnterpriseTableHead>
              <tr>
                <EnterpriseTh>Metric</EnterpriseTh>
                <EnterpriseTh align="right">Value</EnterpriseTh>
              </tr>
            </EnterpriseTableHead>
            <tbody>
              <MetricRow label="Queue Size" value={data.qaHealth.queueSize} />
              <MetricRow label="Avg Turnaround" value={`${data.qaHealth.avgTurnaroundHours}h`} />
              <MetricRow label="Pass Rate" value={`${data.qaHealth.passRate}%`} />
              <MetricRow label="Corrections Today" value={data.qaHealth.correctionsToday} />
              <MetricRow label="Corrections This Week" value={data.qaHealth.correctionsThisWeek} />
            </tbody>
          </EnterpriseDataTable>
        </EnterpriseSection>
      </div>

      <EnterpriseSection
        title="Workload by Employee"
        actions={
          <Button size="sm" variant="ghost" render={<Link href="/people" />}>
            View all <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Button>
        }
      >
        <EnterpriseDataTable maxHeight="280px">
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh align="right">Active</EnterpriseTh>
              <EnterpriseTh align="right">In Progress</EnterpriseTh>
              <EnterpriseTh align="right">Overdue</EnterpriseTh>
              <EnterpriseTh align="right">Blocked</EnterpriseTh>
              <EnterpriseTh>Status</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {data.workload.byEmployee.map((e) => (
              <tr key={e.userId} className="enterprise-row-hover">
                <EnterpriseTd>
                  <Link href={`/people/${e.userId}`} className="font-medium text-primary hover:underline">
                    {e.name}
                  </Link>
                </EnterpriseTd>
                <EnterpriseTd align="right">{e.active}</EnterpriseTd>
                <EnterpriseTd align="right">{e.inProgress}</EnterpriseTd>
                <EnterpriseTd align="right">
                  <span className={cn(e.overdue > 0 && "text-red-400 font-medium")}>{e.overdue}</span>
                </EnterpriseTd>
                <EnterpriseTd align="right">
                  <span className={cn(e.stuck > 0 && "text-amber-400 font-medium")}>{e.stuck}</span>
                </EnterpriseTd>
                <EnterpriseTd>
                  {e.flag === "overloaded" && (
                    <span className="text-[10px] font-semibold uppercase text-amber-400">Overloaded</span>
                  )}
                  {e.flag === "underutilized" && (
                    <span className="text-[10px] font-semibold uppercase text-blue-400">Low load</span>
                  )}
                </EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>

      <EnterpriseSection title="Project Health">
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Project</EnterpriseTh>
              <EnterpriseTh>Status</EnterpriseTh>
              <EnterpriseTh align="right">Complete</EnterpriseTh>
              <EnterpriseTh align="right">Overdue</EnterpriseTh>
              <EnterpriseTh align="right">QA Pass</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {data.projectHealth.projects.map((p) => (
              <tr key={p.id} className="enterprise-row-hover">
                <EnterpriseTd>
                  <Link href="/project-health" className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <Progress value={p.completedPct} className="h-1 mt-1.5 max-w-[200px]" />
                </EnterpriseTd>
                <EnterpriseTd>
                  <span
                    className={cn(
                      "text-xs font-medium capitalize",
                      p.status === "at_risk" ? "text-amber-400" : "text-muted-foreground"
                    )}
                  >
                    {p.status.replace("_", " ")}
                  </span>
                </EnterpriseTd>
                <EnterpriseTd align="right">{p.completedPct}%</EnterpriseTd>
                <EnterpriseTd align="right">
                  <span className={cn(p.overdue > 0 && "text-red-400 font-medium")}>{p.overdue}</span>
                </EnterpriseTd>
                <EnterpriseTd align="right">{p.qaRate}%</EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttentionTable
          title="Manager Attention List"
          description="Coaching, support, and recognition priorities"
          items={data.accountability.attentionList.map((item) => ({
            name: item.name,
            detail: item.reason,
            value: String(item.flowScore),
            href: `/people/${item.userId}`,
            category: item.category,
          }))}
        />
        <AttentionTable
          title="Operational Insights"
          description="Generated from live work data"
          items={data.insights.map((insight) => ({
            name: insight.text,
            detail: insight.metric,
            href: insight.drilldownHref,
            priority: insight.priority,
          }))}
        />
      </div>

      {data.trends30.length > 0 && (
        <PerformanceTrendChart
          data={data.trends30}
          title="30-Day Performance Trend"
          description="Team Flow Score, productivity, and quality"
        />
      )}
    </div>
  );
}

function WorkloadRow({
  label,
  value,
  href,
  warn,
}: {
  label: string;
  value: number;
  href: string;
  warn?: boolean;
}) {
  return (
    <tr className="enterprise-row-hover">
      <EnterpriseTd>{label}</EnterpriseTd>
      <EnterpriseTd align="right">
        <span className={cn(warn && value > 0 && "text-amber-400 font-medium")}>{value}</span>
      </EnterpriseTd>
      <EnterpriseTd align="right">
        <Link href={href} className="text-xs text-primary hover:underline">
          View
        </Link>
      </EnterpriseTd>
    </tr>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr className="enterprise-row-hover">
      <EnterpriseTd>{label}</EnterpriseTd>
      <EnterpriseTd align="right">{value}</EnterpriseTd>
    </tr>
  );
}

function AttentionTable({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: {
    name: string;
    detail?: string;
    value?: string;
    href?: string;
    category?: string;
    priority?: string;
  }[];
}) {
  return (
    <EnterpriseSection title={title} description={description}>
      <EnterpriseDataTable maxHeight="260px">
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTh>Item</EnterpriseTh>
            <EnterpriseTh align="right">Detail</EnterpriseTh>
          </tr>
        </EnterpriseTableHead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={2} className="px-3 py-6 text-center text-sm text-muted-foreground border-t border-border">
                No items to display.
              </td>
            </tr>
          )}
          {items.map((item, i) => (
            <tr key={`${item.name}-${i}`} className="enterprise-row-hover">
              <EnterpriseTd>
                {item.href ? (
                  <Link href={item.href} className="text-sm hover:underline">
                    {item.name}
                  </Link>
                ) : (
                  <span className="text-sm">{item.name}</span>
                )}
                {item.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                )}
                {item.category && (
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {item.category}
                  </span>
                )}
              </EnterpriseTd>
              <EnterpriseTd align="right">
                {item.value && <span className="font-medium tabular-nums">{item.value}</span>}
                {item.priority === "high" && (
                  <span className="text-[10px] font-semibold uppercase text-amber-400">High</span>
                )}
              </EnterpriseTd>
            </tr>
          ))}
        </tbody>
      </EnterpriseDataTable>
    </EnterpriseSection>
  );
}
