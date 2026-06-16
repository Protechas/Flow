"use client";

import type { HierarchyPreview } from "@/lib/setup/hierarchy-preview";
import { cn } from "@/lib/utils";

export function HierarchyPreviewCard({
  preview,
  className,
}: {
  preview: HierarchyPreview;
  className?: string;
}) {
  return (
    <div className={cn("enterprise-panel p-4 space-y-3", className)}>
      <p className="enterprise-label">Hierarchy preview</p>
      <p className="text-base font-semibold">{preview.name}</p>
      {preview.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Complete the steps above to preview reporting structure.</p>
      ) : (
        <dl className="space-y-2 text-sm">
          {preview.lines.map((line) => (
            <div key={`${line.label}-${line.value}`} className="flex gap-3">
              <dt className="text-muted-foreground w-32 shrink-0 capitalize">{line.label}</dt>
              <dd className="font-medium">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
