"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteTeamDashboardPackAction,
  saveTeamDashboardPackAction,
  suggestTeamDashboardSlugAction,
} from "@/app/actions/team-dashboard-packs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_TYPES, USER_ROLES } from "@/lib/constants";
import { formatActionError } from "@/lib/errors/action-messages";
import { TEAM_DASHBOARD_KPI_CATALOG } from "@/lib/team-dashboards/kpi-catalog";
import {
  EMPTY_TEAM_DASHBOARD_INPUT,
  type TeamDashboardPackInput,
} from "@/lib/team-dashboards/form";
import type { TeamDashboardKpiId } from "@/lib/team-dashboards/types";
import type { Project, Team } from "@/types/flow";
import { ArrowLeft, ExternalLink, Save, Trash2 } from "lucide-react";

const NAV_GROUPS = [
  { value: "operations", label: "Operations" },
  { value: "reporting", label: "Reporting" },
] as const;

export function TeamDashboardBuilder({
  initial,
  teams,
  projects,
  mode,
}: {
  initial: TeamDashboardPackInput;
  teams: Team[];
  projects: Project[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [form, setForm] = useState<TeamDashboardPackInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const slugLocked = mode === "edit";

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "archived"),
    [projects]
  );

  function update<K extends keyof TeamDashboardPackInput>(key: K, value: TeamDashboardPackInput[K]) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleKpi(id: TeamDashboardKpiId) {
    setSaved(false);
    setForm((prev) => {
      const has = prev.kpiIds.includes(id);
      return {
        ...prev,
        kpiIds: has ? prev.kpiIds.filter((k) => k !== id) : [...prev.kpiIds, id],
      };
    });
  }

  function toggleProjectType(value: string) {
    setSaved(false);
    setForm((prev) => {
      const has = prev.projectTypes.includes(value);
      return {
        ...prev,
        projectTypes: has
          ? prev.projectTypes.filter((t) => t !== value)
          : [...prev.projectTypes, value],
      };
    });
  }

  function toggleProjectId(id: string) {
    setSaved(false);
    setForm((prev) => {
      const has = prev.projectIds.includes(id);
      return {
        ...prev,
        projectIds: has ? prev.projectIds.filter((p) => p !== id) : [...prev.projectIds, id],
      };
    });
  }

  function toggleAccessRole(role: TeamDashboardPackInput["accessRoles"][number]) {
    setSaved(false);
    setForm((prev) => {
      const has = prev.accessRoles.includes(role);
      return {
        ...prev,
        accessRoles: has
          ? prev.accessRoles.filter((r) => r !== role)
          : [...prev.accessRoles, role],
      };
    });
  }

  function onTeamChange(teamId: string) {
    const team = teams.find((t) => t.id === teamId);
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      teamId: teamId || undefined,
      teamName: team?.name,
    }));
  }

  function onLabelBlur() {
    if (slugLocked || form.slug.trim()) return;
    void suggestTeamDashboardSlugAction(form.label).then((slug) => {
      if (slug) update("slug", slug);
      if (!form.navLabel.trim()) update("navLabel", form.label.trim());
    });
  }

  function handleSave() {
    setError(null);
    startTransition(() => {
      void saveTeamDashboardPackAction({
        ...form,
        navLabel: form.navLabel.trim() || form.label.trim(),
      })
        .then(() => {
          setSaved(true);
          router.push(`/settings/team-dashboards/${form.slug}`);
          router.refresh();
        })
        .catch((e) => setError(formatActionError(e)));
    });
  }

  function handleDelete() {
    if (!confirm(`Delete dashboard "${form.label}"?`)) return;
    setError(null);
    startTransition(() => {
      void deleteTeamDashboardPackAction(form.slug)
        .then(() => {
          router.push("/settings/team-dashboards");
          router.refresh();
        })
        .catch((e) => setError(formatActionError(e)));
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/settings/team-dashboards" />}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        {mode === "edit" && form.slug && (
          <Button variant="outline" size="sm" render={<Link href={`/teams/${form.slug}`} />}>
            <ExternalLink className="h-3.5 w-3.5" />
            Preview dashboard
          </Button>
        )}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="label">Dashboard name</Label>
              <Input
                id="label"
                value={form.label}
                onChange={(e) => update("label", e.target.value)}
                onBlur={onLabelBlur}
                placeholder="Advanced Projects"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <Input
                id="slug"
                value={form.slug}
                disabled={slugLocked}
                onChange={(e) => update("slug", e.target.value)}
                placeholder="advanced-projects"
              />
              <p className="text-[11px] text-muted-foreground">/teams/{form.slug || "your-slug"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="What this team tracks and why."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="navLabel">Sidebar label</Label>
              <Input
                id="navLabel"
                value={form.navLabel}
                onChange={(e) => update("navLabel", e.target.value)}
                placeholder={form.label || "Team name"}
              />
            </div>
            <div className="space-y-2">
              <Label>Sidebar section</Label>
              <Select
                value={form.navGroup}
                onValueChange={(v) => update("navGroup", v as TeamDashboardPackInput["navGroup"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NAV_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Project scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Linked team</Label>
            <Select
              value={form.teamId ?? "_none"}
              onValueChange={(v) => onTeamChange(!v || v === "_none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No team link</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeTeamProjects"
              checked={form.includeTeamProjects}
              onCheckedChange={(v) => update("includeTeamProjects", Boolean(v))}
            />
            <Label htmlFor="includeTeamProjects">Include projects assigned to this team</Label>
          </div>
          <div className="space-y-2">
            <Label>Project types in scope</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROJECT_TYPES.filter((t) => t.value !== "board").map((type) => (
                <label key={type.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.projectTypes.includes(type.value)}
                    onCheckedChange={() => toggleProjectType(type.value)}
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Specific programs (optional)</Label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 p-3 space-y-2">
              {activeProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active projects.</p>
              ) : (
                activeProjects.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.projectIds.includes(project.id)}
                      onCheckedChange={() => toggleProjectId(project.id)}
                    />
                    <span>{project.name}</span>
                    <span className="text-xs text-muted-foreground">({project.project_type})</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">KPI cards</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {TEAM_DASHBOARD_KPI_CATALOG.map((kpi) => (
            <label
              key={kpi.id}
              className="flex items-start gap-2 rounded-md border border-border/50 p-3 text-sm cursor-pointer hover:bg-muted/30"
            >
              <Checkbox
                className="mt-0.5"
                checked={form.kpiIds.includes(kpi.id)}
                onCheckedChange={() => toggleKpi(kpi.id)}
              />
              <span>
                <span className="font-medium block">{kpi.label}</span>
                <span className="text-xs text-muted-foreground">{kpi.description}</span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Access & display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="showProjectPortfolio"
              checked={form.showProjectPortfolio}
              onCheckedChange={(v) => update("showProjectPortfolio", Boolean(v))}
            />
            <Label htmlFor="showProjectPortfolio">Show program portfolio cards</Label>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.teamMembers}
                onCheckedChange={(v) => update("teamMembers", Boolean(v))}
              />
              Team members can view
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.teamLeads}
                onCheckedChange={(v) => update("teamLeads", Boolean(v))}
              />
              Team leads / managers can view
            </label>
          </div>
          <div className="space-y-2">
            <Label>Roles with org-wide access</Label>
            <div className="flex flex-wrap gap-2">
              {USER_ROLES.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-1.5 text-xs border border-border/50 rounded-full px-2.5 py-1"
                >
                  <Checkbox
                    checked={form.accessRoles.includes(role.value)}
                    onCheckedChange={() => toggleAccessRole(role.value)}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Dashboard saved.</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving…" : mode === "create" ? "Create dashboard" : "Save changes"}
        </Button>
        {mode === "edit" && (
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
