"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteOperatingModelAction } from "@/app/actions/operating-models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatActionError } from "@/lib/errors/action-messages";
import type { TeamOperatingModelRecord } from "@/lib/operating-models/types";
import { ArrowRight, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import type { Department, Team } from "@/types/flow";

export function OperatingModelsAdmin({
  models,
  teams,
  departments,
}: {
  models: TeamOperatingModelRecord[];
  teams: Team[];
  departments: Department[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function teamLabel(teamId?: string) {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name ?? teamId;
  }

  function deptLabel(deptId?: string) {
    if (!deptId) return null;
    return departments.find((d) => d.id === deptId)?.name ?? deptId;
  }

  function handleDelete(slug: string, label: string, isGeneral?: boolean) {
    if (isGeneral) {
      alert("The General Operations model cannot be deleted.");
      return;
    }
    if (!confirm(`Delete operating model "${label}"?`)) return;
    startTransition(() => {
      void deleteOperatingModelAction(slug)
        .then(() => router.refresh())
        .catch((e) => alert(formatActionError(e)));
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">
          Configure how each team works — labels, project types, task tracking, KPIs, and
          forecasting. Users see a simplified experience shaped by these models.
        </p>
        <Button render={<Link href="/settings/operating-models/new" />}>
          <Plus className="h-3.5 w-3.5" />
          New model
        </Button>
      </div>

      <div className="space-y-3">
        {models.map((model) => (
          <Card key={model.slug} className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    {model.label}
                    {model.isGeneral && (
                      <Badge variant="outline" className="text-[10px]">
                        Fallback
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/settings/operating-models/${model.slug}`} />}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {model.hierarchyLabels.workPackage} / {model.hierarchyLabels.phase} /{" "}
                  {model.hierarchyLabels.task ?? "Task"}
                </Badge>
                {teamLabel(model.teamId) && (
                  <Badge variant="secondary">Team: {teamLabel(model.teamId)}</Badge>
                )}
                {deptLabel(model.departmentId) && (
                  <Badge variant="secondary">Dept: {deptLabel(model.departmentId)}</Badge>
                )}
                <Badge variant="secondary">{model.kpis.length} KPIs</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {model.kpis.map((k) => k.name).join(" · ")}
              </p>
              {!model.isGeneral && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => handleDelete(model.slug, model.label, model.isGeneral)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed border-border/60 bg-muted/20">
        <CardContent className="py-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How models are applied</p>
          <p>
            When a user creates a project or task, Flow loads the model for the selected team or
            department. Existing projects inherit a model from their project type and team assignment.
          </p>
          <Button variant="link" size="sm" className="h-auto p-0" render={<Link href="/settings/team-dashboards" />}>
            Team dashboards
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
