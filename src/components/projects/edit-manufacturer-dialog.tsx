"use client";

import { useState, useTransition } from "react";
import { updateManufacturerAction } from "@/app/actions/crud";
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
import { Textarea } from "@/components/ui/textarea";
import { WORK_PRIORITIES, WORK_STATUSES } from "@/lib/constants";
import type { Manufacturer, User, WorkPriority, WorkStatus } from "@/types/flow";
import { Pencil } from "lucide-react";

export function EditManufacturerDialog({
  manufacturer,
  analysts,
}: {
  manufacturer: Manufacturer;
  analysts: User[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const owner = fd.get("assigned_to") as string;
    startTransition(async () => {
      await updateManufacturerAction(manufacturer.id, {
        name: fd.get("name") as string,
        assigned_to: owner && owner !== "__none__" ? owner : null,
        status: fd.get("status") as WorkStatus,
        priority: fd.get("priority") as WorkPriority,
        due_date: (fd.get("due_date") as string) || null,
        notes: (fd.get("notes") as string) || null,
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7" />}>
        <Pencil className="h-3 w-3 mr-1" />
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {manufacturer.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input name="name" required defaultValue={manufacturer.name} />
          </div>
          <div className="space-y-2">
            <Label>Owner (assigned employee)</Label>
            <Select name="assigned_to" defaultValue={manufacturer.assigned_to ?? "__none__"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {analysts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="status" defaultValue={manufacturer.status}>
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
              <Select name="priority" defaultValue={manufacturer.priority}>
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
            <Label>Due date</Label>
            <Input name="due_date" type="date" defaultValue={manufacturer.due_date ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} defaultValue={manufacturer.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
