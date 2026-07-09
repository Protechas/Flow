import type { JourneySnapshot, LibraryJourney } from "@/lib/validation-center/library-intelligence";
import { cn } from "@/lib/utils";
import { ArrowRight, Flag, TrendingDown, TrendingUp } from "lucide-react";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SnapshotCard({
  title,
  date,
  snap,
  highlight,
}: {
  title: string;
  date: string | null;
  snap: JourneySnapshot;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-md border p-4",
        highlight && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground">{fmtDate(date)}</p>
      </div>
      <p className={cn("text-3xl font-semibold", highlight && "text-primary")}>
        {snap.compliance}%
      </p>
      <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        Compliance
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Expected</dt>
          <dd className="tabular-nums">{snap.expected.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Passing</dt>
          <dd className="tabular-nums">{snap.passing.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Needs review</dt>
          <dd className="tabular-nums">{snap.review.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Missing</dt>
          <dd className="tabular-nums">{snap.missing.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Where we started vs where we are now — the library's journey. */
export function LibraryJourneyPanel({ journey }: { journey: LibraryJourney }) {
  if (journey.auditsCompleted === 0) return null;

  const delta =
    Math.round((journey.current.compliance - journey.baseline.compliance) * 10) / 10;
  const reviewDelta = journey.current.review - journey.baseline.review;
  const missingDelta = journey.current.missing - journey.baseline.missing;
  const singleAuditEra = journey.movers.length === 0;

  return (
    <section className="enterprise-panel p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Flag className="h-3.5 w-3.5 text-primary" />
        The journey — where we started vs now
      </h2>

      <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
        <SnapshotCard
          title="Where we started"
          date={journey.baselineDate}
          snap={journey.baseline}
        />
        <div className="flex flex-col items-center justify-center gap-1 px-2">
          <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              delta > 0
                ? "border-emerald-500/40 text-emerald-400"
                : delta < 0
                  ? "border-destructive/40 text-destructive"
                  : "border-border text-muted-foreground"
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : delta < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {journey.auditsCompleted} audits
          </span>
        </div>
        <SnapshotCard
          title="Where we are now"
          date={journey.currentDate}
          snap={journey.current}
          highlight
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border px-2.5 py-0.5">
          Review workload {reviewDelta === 0 ? "unchanged" : reviewDelta > 0 ? "up" : "down"}{" "}
          {reviewDelta === 0 ? "" : Math.abs(reviewDelta).toLocaleString()}
        </span>
        <span className="rounded-full border px-2.5 py-0.5">
          Missing files {missingDelta === 0 ? "unchanged" : missingDelta > 0 ? "up" : "down"}{" "}
          {missingDelta === 0 ? "" : Math.abs(missingDelta).toLocaleString()}
        </span>
      </div>

      {singleAuditEra ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Every manufacturer has one completed audit so far — this is the baseline. As
          re-audits land, this panel shows how far the library has come from these numbers.
        </p>
      ) : (
        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Biggest movers since their first audit
          </h3>
          <div className="flex flex-wrap gap-2">
            {journey.movers.slice(0, 10).map((m) => (
              <span
                key={m.manufacturer}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                  m.delta > 0
                    ? "border-emerald-500/40 text-emerald-400"
                    : m.delta < 0
                      ? "border-destructive/40 text-destructive"
                      : "border-border text-muted-foreground"
                )}
              >
                {m.delta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : m.delta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : null}
                {m.manufacturer} {m.firstCompliance}% → {m.latestCompliance}% ({m.audits}{" "}
                audits)
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
