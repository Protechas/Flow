import type { BulkMatrixPreview } from "@/lib/work-creation/bulk-matrix-preview";
import type { BulkMatrixOrder } from "@/lib/work-creation/bulk-matrix-types";

const CAPACITY_LABELS: Record<BulkMatrixPreview["capacityImpact"], string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical — review capacity",
};

export function BulkMatrixPreviewPanel({
  preview,
  matrixOrder,
}: {
  preview: BulkMatrixPreview;
  matrixOrder: BulkMatrixOrder;
}) {
  const topLabel =
    matrixOrder === "year_make_model" ? "Year groups" : "Makes / workstreams";

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-5 space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Approve before create
        </p>
        <p className="text-xl font-semibold mt-1">{preview.title}</p>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          ["Projects", preview.counts.projects],
          [topLabel, preview.counts.makes],
          ["Year / phase groups", preview.counts.yearGroups],
          ["Model / task items", preview.counts.tasks],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-md border border-border/40 bg-background/60 px-3 py-2"
          >
            <dt className="text-[10px] uppercase text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Est. documents", preview.totalDocuments.toLocaleString()],
          ["Est. hours", preview.estimatedHours.toLocaleString()],
          ["Est. work days", preview.estimatedWorkDays.toLocaleString()],
          ["Forecast completion", preview.suggestedCompletion ?? "—"],
          ["Capacity impact", CAPACITY_LABELS[preview.capacityImpact]],
          ["Project risk", preview.riskStatus.replace(/_/g, " ")],
          ["QA tasks", String(preview.qaTaskCount)],
          ["File-required tasks", String(preview.fileTaskCount)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-border/30 pb-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium text-right">{value}</dd>
          </div>
        ))}
      </dl>

      {preview.treeSample.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Structure sample
          </p>
          <ul className="rounded-md border border-border/40 divide-y divide-border/30 max-h-48 overflow-y-auto font-mono text-xs">
            {preview.treeSample.map((line, i) => (
              <li key={`${line}-${i}`} className="px-3 py-1.5 text-muted-foreground">
                {line}
              </li>
            ))}
          </ul>
          {preview.counts.tasks > preview.treeSample.length && (
            <p className="text-[10px] text-muted-foreground mt-1">
              + {preview.counts.tasks - preview.treeSample.length} more items
            </p>
          )}
        </div>
      )}

      <ul className="space-y-1">
        {preview.enabled.map((item) => (
          <li key={item} className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
