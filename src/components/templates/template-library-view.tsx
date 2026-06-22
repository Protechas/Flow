"use client";

import { useMemo, useState, useTransition } from "react";
import {
  archiveTemplateAction,
  duplicateTemplateAction,
  saveCustomTemplateAction,
} from "@/app/actions/templates";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplatePreviewPanel } from "@/components/templates/template-preview-panel";
import { CustomTemplateWizard } from "@/components/templates/custom-template-wizard";
import { CreateProjectFromTemplateDialog } from "@/components/templates/create-project-from-template-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WizardDialogBody,
  WizardDialogContent,
  WizardDialogHeader,
} from "@/components/ui/wizard-dialog";
import { buildEnterpriseTemplatePreview } from "@/lib/templates/preview";
import type { EnterpriseProjectTemplate } from "@/lib/templates/enterprise-types";
import { normalizeRole } from "@/lib/auth/permissions";
import type { Department, Project, Team, User } from "@/types/flow";
import { Archive, LayoutTemplate, Plus, Search } from "lucide-react";

function departmentCompatLabel(
  template: EnterpriseProjectTemplate,
  departments: Department[]
): string {
  if (template.departmentIds.length === 0) return "All departments";
  const names = template.departmentIds
    .map((id) => departments.find((d) => d.id === id)?.name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "Selected departments";
}

export function TemplateLibraryView({
  user,
  templates,
  usageByTemplate,
  departments,
  teams,
  projects,
  managers,
}: {
  user: User;
  templates: EnterpriseProjectTemplate[];
  usageByTemplate: Record<string, number>;
  departments: Department[];
  teams: Team[];
  projects: Project[];
  managers: User[];
}) {
  const role = normalizeRole(user.role);
  const canManage = ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(role);
  const canArchive = ["admin", "super_admin"].includes(role);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [previewId, setPreviewId] = useState<string | null>(templates[0]?.id ?? null);
  const [createTemplateId, setCreateTemplateId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const set = new Set(templates.map((t) => t.category));
    return ["all", ...Array.from(set).sort()];
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.useCases.some((u) => u.toLowerCase().includes(q))
      );
    });
  }, [templates, query, category]);

  const previewTemplate = previewId ? templates.find((t) => t.id === previewId) ?? null : null;
  const preview = previewTemplate
    ? buildEnterpriseTemplatePreview(
        previewTemplate,
        departmentCompatLabel(previewTemplate, departments)
      )
    : null;

  const totalUsage = Object.values(usageByTemplate).reduce((s, n) => s + n, 0);

  function handleDuplicate(templateId: string) {
    startTransition(async () => {
      const result = await duplicateTemplateAction(templateId);
      if (result.ok) setPreviewId(result.templateId);
    });
  }

  function handleArchive(templateId: string) {
    if (!confirm("Archive this custom template? It will no longer appear in the library.")) return;
    startTransition(async () => {
      await archiveTemplateAction(templateId);
      if (previewId === templateId) setPreviewId(filtered[0]?.id ?? null);
    });
  }

  return (
    <div className="space-y-6">
      <section className="flow-executive-command-strip enterprise-panel-elevated p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="flow-hero-eyebrow text-[10px]">Operations · Templates</p>
            <h2 className="text-xl font-semibold tracking-tight">Project Templates Library</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Launch enterprise-ready projects in seconds. Select a template, name your project, and
              Flow generates tasks, forecasting, QA, and reporting automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button type="button" size="sm" onClick={() => setWizardOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create custom template
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <Metric label="Templates" value={String(templates.length)} />
          <Metric label="Projects from templates" value={String(totalUsage)} />
          <Metric label="Built-in" value={String(templates.filter((t) => t.builtin).length)} />
          <Metric label="Custom" value={String(templates.filter((t) => !t.builtin).length)} />
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={category === c ? "default" : "outline"}
                  className="h-8 text-xs capitalize"
                  onClick={() => setCategory(c)}
                >
                  {c === "all" ? "All" : c}
                </Button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="enterprise-panel rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              <LayoutTemplate className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No templates match your search.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  departmentLabel={departmentCompatLabel(template, departments)}
                  selected={previewId === template.id}
                  usageCount={usageByTemplate[template.id] ?? 0}
                  onSelect={() => setPreviewId(template.id)}
                  onPreview={() => setPreviewId(template.id)}
                  onCreate={() => setCreateTemplateId(template.id)}
                  onDuplicate={canManage ? () => handleDuplicate(template.id) : undefined}
                  canManage={canManage}
                />
              ))}
            </div>
          )}

          {canArchive && previewTemplate && !previewTemplate.builtin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={pending}
              onClick={() => handleArchive(previewTemplate.id)}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archive template
            </Button>
          )}
        </div>

        <aside className="w-full lg:w-[320px] shrink-0 space-y-3">
          {preview ? (
            <>
              <TemplatePreviewPanel preview={preview} />
              <Button
                type="button"
                className="w-full"
                onClick={() => previewTemplate && setCreateTemplateId(previewTemplate.id)}
              >
                Create project from template
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground p-4 border rounded-lg">
              Select a template to preview what Flow will create.
            </p>
          )}
        </aside>
      </div>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <WizardDialogContent size="lg">
          <WizardDialogHeader>
            <DialogTitle>Create custom template</DialogTitle>
          </WizardDialogHeader>
          <WizardDialogBody>
            <CustomTemplateWizard
              departments={departments}
              onCancel={() => setWizardOpen(false)}
              onSaved={(id) => {
                setWizardOpen(false);
                setPreviewId(id);
              }}
              saveAction={saveCustomTemplateAction}
            />
          </WizardDialogBody>
        </WizardDialogContent>
      </Dialog>

      {createTemplateId && (
        <CreateProjectFromTemplateDialog
          open={Boolean(createTemplateId)}
          onOpenChange={(open) => !open && setCreateTemplateId(null)}
          template={templates.find((t) => t.id === createTemplateId)!}
          departments={departments}
          teams={teams}
          projects={projects}
          managers={managers}
          user={user}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
