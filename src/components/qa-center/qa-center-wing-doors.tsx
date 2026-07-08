import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { QaCenterDashboardStats } from "@/lib/qa-center/types";
import type { AuditWorkerStatus } from "@/lib/validation-center/worker-status";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  FlaskConical,
  Layers,
  Upload,
} from "lucide-react";

function WorkerStatusBadge({ status }: { status: AuditWorkerStatus }) {
  const lastSeen = status.lastSeenAt
    ? new Date(status.lastSeenAt).toLocaleTimeString()
    : null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        status.online
          ? "border-emerald-500/40 text-emerald-400"
          : "border-amber-500/40 text-amber-500"
      )}
      title={
        status.online
          ? `Audit worker${status.host ? ` on ${status.host}` : ""} is processing runs${lastSeen ? ` · last tick ${lastSeen}` : ""}`
          : "No audit worker connected — runs will queue until one starts (npm run audit-worker on the engine machine)"
      }
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status.online ? "bg-emerald-400" : "bg-amber-500"
        )}
      />
      {status.online ? "Worker online" : "Worker offline"}
    </span>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "critical";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "rounded-lg border border-border/50 px-3 py-2.5",
        tone === "warn" && "border-amber-500/40",
        tone === "critical" && "border-destructive/50",
        href && "transition-colors hover:bg-muted/20"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xl font-bold tabular-nums",
          tone === "warn" && "text-amber-500",
          tone === "critical" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/**
 * The QA Center's two wings: human review of submitted work on one side,
 * the automated SI audit engine on the other.
 */
export function QaCenterWingDoors({
  stats,
  openBatchCount,
  workerStatus,
}: {
  stats: QaCenterDashboardStats;
  openBatchCount: number;
  workerStatus: AuditWorkerStatus;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="enterprise-panel-elevated space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Review</h2>
            <p className="text-xs text-muted-foreground">
              Human QA of submitted work — final handoffs, in-progress batches, corrections
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="Review queue"
            value={stats.reviewQueueCount}
            tone={stats.reviewQueueCount > 0 ? "warn" : "default"}
            href="/qa-center/review"
          />
          <StatTile
            label="Open batches"
            value={openBatchCount}
            tone={openBatchCount > 0 ? "warn" : "default"}
            href="/qa-center/review"
          />
          <StatTile
            label="Avg review time"
            value={stats.averageReviewMinutes != null ? `${stats.averageReviewMinutes}m` : "—"}
          />
          <StatTile
            label="Knowledge docs"
            value={stats.knowledgeEntries}
            href="/qa-center/knowledge"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/qa-center/review" />}>
            <ClipboardCheck className="h-4 w-4" />
            Open review queue
          </Button>
          <Button variant="outline" render={<Link href="/qa-center/knowledge" />}>
            Knowledge library
          </Button>
          <Button variant="outline" render={<Link href="/qa-center/reports" />}>
            Reports
          </Button>
        </div>
      </section>

      <section className="enterprise-panel-elevated space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Audit Engine</h2>
            <p className="text-xs text-muted-foreground">
              Automated SI Library validation — runs, findings, rules, and analytics
            </p>
          </div>
          <WorkerStatusBadge status={workerStatus} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="Audit runs"
            value={stats.auditRunsSubmitted}
            href="/qa-center/validation"
          />
          <StatTile
            label="In queue"
            value={stats.validationQueueCount}
            tone={stats.validationQueueCount > 0 ? "warn" : "default"}
            href="/qa-center/validation"
          />
          <StatTile
            label="Open findings"
            value={stats.openFindings}
            tone={stats.openFindings > 0 ? "warn" : "default"}
            href="/qa-center/validation/findings"
          />
          <StatTile
            label="Critical / high"
            value={stats.critical}
            tone={stats.critical > 0 ? "critical" : "default"}
            href="/qa-center/validation/findings"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/qa-center/validation/new" />}>
            <FlaskConical className="h-4 w-4" />
            New audit run
          </Button>
          <Button variant="outline" render={<Link href="/qa-center/upload" />}>
            <Upload className="h-4 w-4" />
            Upload queue
          </Button>
          <Button variant="outline" render={<Link href="/qa-center/validation/findings" />}>
            <Layers className="h-4 w-4" />
            Findings
          </Button>
        </div>
      </section>
    </div>
  );
}
