"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listProjectMetricsAction,
  updateProjectMetricValueAction,
} from "@/app/actions/project-metrics";
import { ProjectMetricDisplay } from "@/components/projects/project-metric-display";
import { ProjectMetricsManager } from "@/components/projects/project-metrics-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatActionError } from "@/lib/errors/action-messages";
import type { Project, ProjectMetricView, User } from "@/types/flow";
import { BarChart3, Settings2 } from "lucide-react";

export function ProjectMetricsPanel({
  project,
  user,
  canManage,
  canUpdateValues,
}: {
  project: Project;
  user?: User;
  canManage?: boolean;
  canUpdateValues?: boolean;
}) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<ProjectMetricView[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function load() {
    startTransition(async () => {
      try {
        const data = await listProjectMetricsAction(project.id);
        setMetrics(data);
        setError(null);
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  useEffect(() => {
    load();
  }, [project.id]);

  function saveValue(metricId: string) {
    startTransition(async () => {
      try {
        await updateProjectMetricValueAction(metricId, editValue);
        setEditingId(null);
        setEditValue("");
        load();
        router.refresh();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  if (!metrics.length && !canManage) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Performance metrics</h3>
        </div>
        {canManage && (
          <Button type="button" size="sm" variant="outline" onClick={() => setManagerOpen(true)}>
            <Settings2 className="h-3.5 w-3.5 mr-1" />
            Manage metrics
          </Button>
        )}
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/60 px-4 py-6 text-center">
          No custom metrics yet. Add metrics to track outcomes specific to this project.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="relative group">
              <ProjectMetricDisplay metric={metric} />
              {canUpdateValues && !metric.is_formula && (
                <div className="mt-1 px-1">
                  {editingId === metric.id ? (
                    <div className="flex gap-1">
                      <Input
                        className="h-7 text-xs"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={pending}
                        onClick={() => saveValue(metric.id)}
                      >
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        setEditingId(metric.id);
                        setEditValue(metric.current_value ?? "");
                      }}
                    >
                      Update value
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canManage && user && (
        <ProjectMetricsManager
          project={project}
          open={managerOpen}
          onOpenChange={setManagerOpen}
          onUpdated={load}
        />
      )}
    </div>
  );
}
