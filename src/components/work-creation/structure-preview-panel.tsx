import type { StructurePreview } from "@/lib/work-creation/structure-preview";
import { getHierarchyLabels } from "@/lib/work-packages/smart-labels";

export function StructurePreviewPanel({ preview }: { preview: StructurePreview }) {
  const labels = getHierarchyLabels(preview.projectType, preview.structureMode);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          This will create
        </p>
        <p className="text-lg font-semibold mt-1">{preview.title}</p>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
          <dt className="text-[10px] uppercase text-muted-foreground">Projects</dt>
          <dd className="text-xl font-semibold tabular-nums">{preview.counts.projects}</dd>
        </div>
        <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
          <dt className="text-[10px] uppercase text-muted-foreground">
            {labels.workPackagePlural}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">{preview.counts.workPackages}</dd>
        </div>
        <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
          <dt className="text-[10px] uppercase text-muted-foreground">{labels.phasePlural}</dt>
          <dd className="text-xl font-semibold tabular-nums">{preview.counts.phases}</dd>
        </div>
        <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
          <dt className="text-[10px] uppercase text-muted-foreground">{labels.taskPlural}</dt>
          <dd className="text-xl font-semibold tabular-nums">{preview.counts.tasks}</dd>
        </div>
      </dl>

      <dl className="grid gap-2 text-sm">
        {preview.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="font-medium text-right">{line.value}</dd>
          </div>
        ))}
      </dl>

      {preview.tree.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Structure preview
          </p>
          <ul className="rounded-md border border-border/40 divide-y divide-border/30 max-h-40 overflow-y-auto">
            {preview.tree.map((line, i) => (
              <li key={`${line}-${i}`} className="px-3 py-1.5 text-xs font-mono text-muted-foreground">
                {line}
              </li>
            ))}
          </ul>
          {preview.tree.length >= 24 && (
            <p className="text-[10px] text-muted-foreground mt-1">Showing first 24 rows</p>
          )}
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
          Flow will enable
        </p>
        <ul className="space-y-1">
          {preview.enabled.map((item) => (
            <li key={item} className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
