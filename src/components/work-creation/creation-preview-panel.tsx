import type { CreationPreview } from "@/lib/work-creation/preview";

export function CreationPreviewPanel({ preview }: { preview: CreationPreview }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Summary</p>
        <p className="text-lg font-semibold mt-1">{preview.title}</p>
      </div>
      <dl className="grid gap-2 text-sm">
        {preview.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="font-medium text-right">{line.value}</dd>
          </div>
        ))}
      </dl>
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
