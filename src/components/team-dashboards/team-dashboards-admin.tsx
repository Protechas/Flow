"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteTeamDashboardPackAction } from "@/app/actions/team-dashboard-packs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatActionError } from "@/lib/errors/action-messages";
import type { TeamDashboardPackRecord } from "@/lib/team-dashboards/store";
import { ArrowRight, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";

export function TeamDashboardsAdmin({
  packs,
  programCounts,
}: {
  packs: TeamDashboardPackRecord[];
  programCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete(slug: string, label: string) {
    if (!confirm(`Delete dashboard "${label}"?`)) return;
    startTransition(() => {
      void deleteTeamDashboardPackAction(slug)
        .then(() => router.refresh())
        .catch((e) => alert(formatActionError(e)));
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">
          Build custom operating dashboards per team — project scope, KPIs, sidebar link, and who
          can view. Changes apply immediately after save.
        </p>
        <Button render={<Link href="/settings/team-dashboards/new" />}>
          <Plus className="h-3.5 w-3.5" />
          New dashboard
        </Button>
      </div>

      <div className="space-y-3">
        {packs.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No team dashboards yet. Create one for Advanced Projects or any other team.
            </CardContent>
          </Card>
        ) : (
          packs.map((pack) => (
            <Card key={pack.slug} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      {pack.label}
                      {pack.is_active === false && (
                        <Badge variant="outline" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{pack.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/settings/team-dashboards/${pack.slug}`} />}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" render={<Link href={`/teams/${pack.slug}`} />}>
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">/teams/{pack.slug}</Badge>
                  <Badge variant="secondary">
                    {programCounts[pack.slug] ?? 0} program
                    {(programCounts[pack.slug] ?? 0) === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="secondary">{pack.kpis.length} KPIs</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pack.kpis.map((k) => k.label).join(" · ")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => handleDelete(pack.slug, pack.label)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
