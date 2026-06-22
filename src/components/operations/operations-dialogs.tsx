"use client";

import { useState, useTransition } from "react";
import {
  bulkCreateYearsAction,
  createManufacturerAction,
  createYearAction,
} from "@/app/actions/crud";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  WizardDialogBody,
  WizardDialogContent,
  WizardDialogFooter,
  WizardDialogHeader,
  WizardDialogScroll,
} from "@/components/ui/wizard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORK_PRIORITIES, WORK_STATUSES } from "@/lib/constants";
import { YEAR_RANGE } from "@/lib/templates/project-templates";
import type { Manufacturer, User, WorkPriority, WorkStatus } from "@/types/flow";
import { Plus } from "lucide-react";

export function BulkYearsDialog({
  mfr,
  trigger,
}: {
  mfr: Manufacturer;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number[]>([...YEAR_RANGE]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Bulk years
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk years — {mfr.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Select a year range to create year work items under this manufacturer.
        </p>
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

export function AddManufacturerDialog({
  projectId,
  analysts,
  trigger,
}: {
  projectId: string;
  analysts: User[];
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedYears, setSelectedYears] = useState<number[]>([...YEAR_RANGE]);

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
          priority: fd.get("priority") as WorkPriority,
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
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Manufacturer
            </Button>
          )
        }
      />
      <WizardDialogContent size="md">
        <WizardDialogHeader>
          <DialogTitle>Add Manufacturer</DialogTitle>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll>
            <form id="add-manufacturer-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfr-name">Manufacturer name *</Label>
            <Input id="mfr-name" name="name" required placeholder="Toyota" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select name="assigned_to" defaultValue="__none__">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Initial years (optional)</Label>
            <div className="grid grid-cols-5 gap-2">
              {YEAR_RANGE.map((y) => (
                <label key={y} className="flex items-center gap-1 text-xs">
                  <Checkbox checked={selectedYears.includes(y)} onCheckedChange={() => toggleYear(y)} />
                  {y}
                </label>
              ))}
            </div>
            </div>
            </form>
          </WizardDialogScroll>
          <WizardDialogFooter>
            <Button type="submit" form="add-manufacturer-form" disabled={pending}>
              Add manufacturer
            </Button>
          </WizardDialogFooter>
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}

export function AddYearDialog({
  projectId,
  manufacturerId,
  trigger,
}: {
  projectId: string;
  manufacturerId: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Add year
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add year work item</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              await createYearAction({
                project_id: projectId,
                manufacturer_id: manufacturerId,
                year: Number(fd.get("year")),
                status: "not_started",
                priority: "medium",
                estimated_hours: 8,
              });
              setOpen(false);
            });
          }}
        >
          <div className="space-y-2">
            <Label>Model year</Label>
            <Input name="year" type="number" min={1990} max={2035} required defaultValue={2026} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
