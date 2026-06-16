"use client";

import { Badge } from "@/components/ui/badge";
import type { EnterpriseTemplatePreview } from "@/lib/templates/preview";
import { BarChart3, CheckCircle2, FileUp, ListOrdered, ShieldCheck } from "lucide-react";

export function TemplatePreviewPanel({ preview }: { preview: EnterpriseTemplatePreview }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Template preview</p>
        <p className="text-lg font-semibold mt-1">{preview.templateName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Department: <span className="text-foreground font-medium">{preview.departmentLabel}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {preview.forecastingIncluded && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <BarChart3 className="h-3 w-3" />
            Forecasting
          </Badge>
        )}
        {preview.qaIncluded && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <ShieldCheck className="h-3 w-3" />
            QA included
          </Badge>
        )}
        {preview.fileUploadsRequired && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <FileUp className="h-3 w-3" />
            File uploads
          </Badge>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
          <ListOrdered className="h-3 w-3" />
          Tasks created ({preview.taskTitles.length})
        </p>
        <ol className="space-y-1">
          {preview.taskTitles.map((title, i) => (
            <li key={title} className="text-xs flex items-center gap-2">
              <span className="text-muted-foreground w-4">{i + 1}.</span>
              {title}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          Estimated workflow
        </p>
        <p className="text-xs text-muted-foreground">{preview.workflowSummary}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
          Flow will create
        </p>
        <ul className="space-y-1">
          {preview.enabled.map((item) => (
            <li key={item} className="text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
