"use client";

import { useState, useTransition } from "react";
import { createWorkPackageAction } from "@/app/actions/crud";
import { Button } from "@/components/ui/button";
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
import { WORK_PRIORITIES } from "@/lib/constants";
import type { User, WorkPriority, YearWorkItem } from "@/types/flow";
import { Plus } from "lucide-react";

export function AddWorkPackageDialog({
  yearItem,
  analysts,
  trigger,
}: {
  yearItem: YearWorkItem;
  analysts: User[];
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
              <Plus className="h-3 w-3 mr-1" />
              Add task
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add work package — {yearItem.year}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const a = fd.get("assigned_to") as string;
            startTransition(async () => {
              await createWorkPackageAction({
                project_id: yearItem.project_id,
                manufacturer_id: yearItem.manufacturer_id,
                year_work_item_id: yearItem.id,
                year: yearItem.year,
                title: fd.get("title") as string,
                assigned_to: a && a !== "__none__" ? a : null,
                status: "assigned",
                priority: fd.get("priority") as WorkPriority,
                due_date: (fd.get("due_date") as string) || null,
                estimated_hours: Number(fd.get("estimated_hours")) || 8,
                notes: (fd.get("notes") as string) || null,
              });
              setOpen(false);
            });
          }}
        >
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input name="title" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select name="assigned_to" defaultValue={yearItem.assigned_to ?? "__none__"}>
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Due</Label>
              <Input name="due_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Est. hours</Label>
              <Input name="estimated_hours" type="number" step="0.5" defaultValue={8} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending} size="sm">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
