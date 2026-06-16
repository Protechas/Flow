"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EnterpriseProjectTemplate } from "@/lib/templates/enterprise-types";
import {
  BarChart3,
  Copy,
  FileUp,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function TemplateCard({
  template,
  departmentLabel,
  selected,
  usageCount,
  onSelect,
  onPreview,
  onDuplicate,
  onCreate,
  canManage,
}: {
  template: EnterpriseProjectTemplate;
  departmentLabel: string;
  selected?: boolean;
  usageCount: number;
  onSelect?: () => void;
  onPreview: () => void;
  onDuplicate?: () => void;
  onCreate?: () => void;
  canManage: boolean;
}) {
  const taskCount = template.tasks.length;

  return (
    <article
      className={cn(
        "flow-template-card enterprise-panel-elevated rounded-lg border p-4 flex flex-col gap-3 transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border/60 hover:border-border",
        onSelect && "cursor-pointer"
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{template.label}</h3>
            {template.builtin && (
              <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">
                Built-in
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] h-5">
              {template.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
        </div>
        <Sparkles className="h-4 w-4 text-primary/70 shrink-0" />
      </div>

      <ul className="text-[11px] text-muted-foreground space-y-0.5">
        {template.useCases.slice(0, 2).map((u) => (
          <li key={u} className="truncate">• {u}</li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px] font-normal gap-1">
          <Layers className="h-3 w-3" />
          {taskCount} tasks
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal">
          {departmentLabel}
        </Badge>
        {template.forecastingEnabled && (
          <Badge variant="outline" className="text-[10px] font-normal gap-1">
            <BarChart3 className="h-3 w-3" />
            Forecast
          </Badge>
        )}
        {template.qaEnabled && (
          <Badge variant="outline" className="text-[10px] font-normal gap-1">
            <ShieldCheck className="h-3 w-3" />
            QA
          </Badge>
        )}
        {template.fileUploadsRequired && (
          <Badge variant="outline" className="text-[10px] font-normal gap-1">
            <FileUp className="h-3 w-3" />
            Files
          </Badge>
        )}
      </div>

      {usageCount > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {usageCount} project{usageCount === 1 ? "" : "s"} created
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onPreview}>
          Preview
        </Button>
        {onCreate && (
          <Button type="button" size="sm" className="h-7 text-xs" onClick={onCreate}>
            Create project
          </Button>
        )}
        {canManage && onDuplicate && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onDuplicate}
            title="Duplicate template"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </article>
  );
}
