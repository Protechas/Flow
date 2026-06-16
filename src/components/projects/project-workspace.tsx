"use client";

import { useState, useTransition } from "react";
import {
  archiveManufacturerAction,
  archiveProjectAction,
  bulkCreateYearsAction,
  createManufacturerAction,
  createYearAction,
  deleteManufacturerAction,
  deleteProjectAction,
  deleteYearAction,
  unarchiveProjectAction,
  updateYearAction,
} from "@/app/actions/crud";
import { ProjectForecastPanel } from "@/components/forecast/project-forecast-panel";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { AddWorkPackageDialog } from "@/components/projects/add-work-package-dialog";
import { EditManufacturerDialog } from "@/components/projects/edit-manufacturer-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { NewWorkWizard } from "@/components/work-creation/new-work-wizard";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { WORK_PRIORITIES, WORK_STATUSES } from "@/lib/constants";
import { YEAR_RANGE } from "@/lib/templates/project-templates";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import type { Department, ForecastSettings, Manufacturer, Project, Team, User, WorkPackage, WorkStatus, YearWorkItem } from "@/types/flow";
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Factory, Plus, Trash2 } from "lucide-react";

type ProjectWithStats = Project & {
  manufacturerCount: number;
  yearCount: number;
  completedPct: number;
};

interface ProjectWorkspaceProps {
  projects: ProjectWithStats[];
  archivedProjects: ProjectWithStats[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  workPackages: WorkPackage[];
  managers: User[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  canEdit: boolean;
  canDelete: boolean;
  user?: User;
  departments?: Department[];
  teams?: Team[];
}

export function ProjectWorkspace({
  projects: activeProjects,
  archivedProjects,
  manufacturers: allMfrs,
  yearItems,
  workPackages,
  managers,
  analysts,
  forecastSettings,
  canEdit,
  canDelete,
  user,
  departments = [],
  teams = [],
}: ProjectWorkspaceProps) {
  const [expandedProject, setExpandedProject] = useState<string | null>(
    activeProjects[0]?.id ?? null
  );
  const [showArchived, setShowArchived] = useState(false);
  const [pending, startTransition] = useTransition();

  const displayProjects = showArchived
    ? [...activeProjects, ...archivedProjects]
    : activeProjects;

  const allowedModes = user ? getAllowedCreationModes(user.role) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox checked={showArchived} onCheckedChange={(c) => setShowArchived(!!c)} />
          Show archived projects
        </label>
        {canEdit && user && allowedModes.length > 0 && (
          <NewWorkWizard
            user={user}
            departments={departments}
            teams={teams}
            projects={activeProjects}
            analysts={analysts}
            managers={managers}
            forecastSettings={forecastSettings}
          />
        )}
      </div>

      {displayProjects.map((project) => {
        const open = expandedProject === project.id;
        const archived = project.status === "archived";
        const mfrs = allMfrs.filter((m) => m.project_id === project.id && !m.is_archived);
        const archivedMfrs = allMfrs.filter((m) => m.project_id === project.id && m.is_archived);

        return (
          <Card
            key={project.id}
            className={archived ? "border-border/40 opacity-80" : "border-border/60"}
          >
            <CardHeader
              className="cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => setExpandedProject(open ? null : project.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <CardTitle className="text-base truncate">{project.name}</CardTitle>
                  {archived && <Badge variant="outline">Archived</Badge>}
                  <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
                    {project.project_type.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-muted-foreground hidden md:inline">
                    {project.completedPct}% · {mfrs.length} mfr
                  </span>
                  <DueDateStatusBadge status={project.project_due_date_status} />
                  {canEdit && (
                    <>
                      <EditProjectDialog project={project} managers={managers} forecastSettings={forecastSettings} />
                      {archived ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Restore project"
                          disabled={pending}
                          onClick={(e) => {
                            e.stopPropagation();
                            startTransition(() => unarchiveProjectAction(project.id));
                          }}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Archive project"
                          disabled={pending}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Archive "${project.name}"?`)) {
                              startTransition(() => archiveProjectAction(project.id));
                            }
                          }}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${project.name}" and all children?`)) {
                          startTransition(() => deleteProjectAction(project.id));
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {open && !archived && (
              <CardContent className="space-y-4 border-t border-border/40 pt-4">
                <ProjectForecastPanel project={project} />
                {canEdit && <AddManufacturerDialog projectId={project.id} analysts={analysts} />}
                {mfrs.map((mfr) => (
                  <ManufacturerPanel
                    key={mfr.id}
                    mfr={mfr}
                    years={yearItems.filter((y) => y.manufacturer_id === mfr.id)}
                    packages={workPackages.filter((p) => p.manufacturer_id === mfr.id)}
                    analysts={analysts}
                    forecastSettings={forecastSettings}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    pending={pending}
                    startTransition={startTransition}
                  />
                ))}
                {archivedMfrs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {archivedMfrs.length} archived manufacturer(s) hidden
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ManufacturerPanel({
  mfr,
  years,
  packages,
  analysts,
  forecastSettings,
  canEdit,
  canDelete,
  pending,
  startTransition,
}: {
  mfr: Manufacturer;
  years: YearWorkItem[];
  packages: WorkPackage[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  canEdit: boolean;
  canDelete: boolean;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
}) {
  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Factory className="h-4 w-4 text-indigo-400" />
          {mfr.name}
          <span className="text-xs text-muted-foreground font-normal">{years.length} years</span>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <EditManufacturerDialog manufacturer={mfr} analysts={analysts} />
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Archive ${mfr.name}?`)) {
                    startTransition(() => archiveManufacturerAction(mfr.id));
                  }
                }}
              >
                <Archive className="h-3 w-3" />
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-7"
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete ${mfr.name}?`)) {
                  startTransition(() => deleteManufacturerAction(mfr.id));
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {canEdit && (
          <div className="flex gap-2">
            <AddYearDialog mfr={mfr} />
            <BulkYearsDialog mfr={mfr} />
          </div>
        )}
        {years
          .sort((a, b) => b.year - a.year)
          .map((y) => (
            <YearRow
              key={y.id}
              yearItem={y}
              manufacturerName={mfr.name}
              packages={packages.filter((p) => p.year_work_item_id === y.id)}
              analysts={analysts}
              forecastSettings={forecastSettings}
              canEdit={canEdit}
              canDelete={canDelete}
              pending={pending}
              startTransition={startTransition}
            />
          ))}
      </div>
    </div>
  );
}

function YearRow({
  yearItem,
  manufacturerName,
  packages,
  analysts,
  forecastSettings,
  canEdit,
  canDelete,
  pending,
  startTransition,
}: {
  yearItem: YearWorkItem;
  manufacturerName: string;
  packages: WorkPackage[];
  analysts: User[];
  forecastSettings: ForecastSettings;
  canEdit: boolean;
  canDelete: boolean;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md bg-muted/20 px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="font-medium text-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {yearItem.year} ({packages.length} tasks)
        </button>
        {canEdit && (
          <>
            <Select
              value={yearItem.assigned_to ?? "__none__"}
              onValueChange={(v) => {
                startTransition(() =>
                  updateYearAction(yearItem.id, {
                    assigned_to: v === "__none__" ? null : v,
                  })
                );
              }}
            >
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue placeholder="Assign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {analysts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={yearItem.status}
              onValueChange={(v) => {
                if (v) startTransition(() => updateYearAction(yearItem.id, { status: v as WorkStatus }));
              }}
            >
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddWorkPackageDialog
              yearItem={yearItem}
              manufacturerName={manufacturerName}
              analysts={analysts}
              forecastSettings={forecastSettings}
            />
          </>
        )}
        {canDelete && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive ml-auto"
            onClick={() => startTransition(() => deleteYearAction(yearItem.id))}
          >
            Remove year
          </button>
        )}
      </div>
      {expanded && packages.length > 0 && (
        <ul className="space-y-1 pl-2 border-l border-border/40">
          {packages.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-xs gap-2">
              <span className="truncate">{p.title}</span>
              <StatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddYearDialog({ mfr }: { mfr: Manufacturer }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs" />}>
        <Plus className="h-3 w-3 mr-1" />
        Add year
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle>Add year — {mfr.name}</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const year = Number((new FormData(e.currentTarget).get("year") as string));
            startTransition(async () => {
              await createYearAction({
                project_id: mfr.project_id,
                manufacturer_id: mfr.id,
                year,
                status: "not_started",
                priority: "medium",
                estimated_hours: 8,
              });
              setOpen(false);
            });
          }}
        >
          <div className="space-y-2 py-2">
            <Label>Model year</Label>
            <Input name="year" type="number" min={1990} max={2035} required defaultValue={2026} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkYearsDialog({ mfr }: { mfr: Manufacturer }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number[]>([...YEAR_RANGE]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 text-xs" />}>
        Bulk years
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Bulk years — {mfr.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-5 gap-2 py-2">
          {YEAR_RANGE.map((y) => (
            <label key={y} className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={selected.includes(y)}
                onCheckedChange={() =>
                  setSelected((prev) =>
                    prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y].sort()
                  )
                }
              />
              {y}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={pending || selected.length === 0}
            onClick={() =>
              startTransition(async () => {
                await bulkCreateYearsAction(mfr.id, mfr.project_id, selected);
                setOpen(false);
              })
            }
          >
            Create {selected.length} years
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddManufacturerDialog({
  projectId,
  analysts,
}: {
  projectId: string;
  analysts: User[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2025, 2026]);

  function toggleYear(year: number) {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort()
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const owner = fd.get("assigned_to") as string;
    startTransition(async () => {
      await createManufacturerAction(
        {
          project_id: projectId,
          name: fd.get("name") as string,
          assigned_to: owner && owner !== "__none__" ? owner : null,
          status: fd.get("status") as WorkStatus,
          priority: fd.get("priority") as import("@/types/flow").WorkPriority,
          due_date: (fd.get("due_date") as string) || null,
          notes: (fd.get("notes") as string) || null,
        },
        selectedYears
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Manufacturer
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Manufacturer</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfr-name">Manufacturer name *</Label>
            <Input id="mfr-name" name="name" required placeholder="Toyota" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select name="assigned_to" defaultValue="__none__">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfr-due">Due date</Label>
              <Input id="mfr-due" name="due_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue="not_started">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Bulk create years</Label>
            <div className="grid grid-cols-5 gap-2">
              {YEAR_RANGE.map((year) => (
                <label key={year} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={selectedYears.includes(year)}
                    onCheckedChange={() => toggleYear(year)}
                  />
                  {year}
                </label>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setSelectedYears([...YEAR_RANGE])}
            >
              Select all 2017–2026
            </Button>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || selectedYears.length === 0}>
              {pending ? "Adding…" : `Add & create ${selectedYears.length} years`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
