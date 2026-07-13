import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QaResult, QaReview, User, WorkPackage } from "@/types/flow";

const RESULT_STYLES: Record<QaResult, string> = {
  pass: "border-emerald-500/30 text-emerald-500",
  minor_correction: "border-amber-500/30 text-amber-500",
  major_correction: "border-amber-500/40 text-amber-600",
  rejected: "border-red-500/40 text-red-500",
};

const RESULT_LABELS: Record<QaResult, string> = {
  pass: "Passed",
  minor_correction: "Minor correction",
  major_correction: "Major correction",
  rejected: "Rejected",
};

/**
 * The archive: completed QA checks live here, out of the working queue.
 * Server component — collapsed by default so the review area stays about
 * what still needs doing.
 */
export function CompletedReviewsPanel({
  reviews,
  packages,
  users,
  limit = 50,
}: {
  reviews: QaReview[];
  packages: WorkPackage[];
  users: User[];
  limit?: number;
}) {
  if (reviews.length === 0) return null;

  const packageById = new Map(packages.map((p) => [p.id, p]));
  const nameById = new Map(users.map((u) => [u.id, u.full_name]));
  const recent = [...reviews]
    .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
    .slice(0, limit);

  return (
    <details className="enterprise-panel">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
        Completed QA checks ({reviews.length}) — archive
      </summary>
      <div className="border-t border-border/50 max-h-96 overflow-y-auto">
        {recent.map((review) => {
          const pkg = packageById.get(review.work_package_id);
          return (
            <div
              key={review.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-border/30 text-sm"
            >
              <Badge
                variant="outline"
                className={cn("shrink-0", RESULT_STYLES[review.result])}
              >
                {RESULT_LABELS[review.result]}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {pkg?.title ?? "Task removed"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {nameById.get(review.analyst_id) ?? "—"} · reviewed by{" "}
                  {nameById.get(review.reviewer_id) ?? "—"}
                  {review.notes ? ` — ${review.notes}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {new Date(review.reviewed_at).toLocaleDateString()}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
