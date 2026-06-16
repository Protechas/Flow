"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  createCommentAction,
  createTimeLogAction,
  updateWorkPackageAction,
} from "@/app/actions/crud";
import { TaskFileUploadZone } from "@/components/employee/task-file-upload-zone";
import { TaskLiveForecastPanel } from "@/components/forecast/task-live-forecast-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Comment, TaskFileUpload, TimeLog, User, WorkPackage } from "@/types/flow";

interface PackageDetailSheetProps {
  pkg: WorkPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: Comment[];
  taskFiles: TaskFileUpload[];
  timeLogs: TimeLog[];
  currentUserId: string;
  analysts: User[];
  canAssign: boolean;
  canEdit: boolean;
}

export function PackageDetailSheet({
  pkg,
  open,
  onOpenChange,
  comments,
  taskFiles,
  timeLogs,
  currentUserId,
  analysts,
  canAssign,
  canEdit,
}: PackageDetailSheetProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!pkg) return null;

  const pkgComments = comments.filter((c) => c.work_package_id === pkg.id);
  const pkgFiles = taskFiles.filter((f) => f.task_id === pkg.id);
  const pkgLogs = timeLogs.filter((t) => t.work_package_id === pkg.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left pr-8">{pkg.title}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {pkg.manufacturer?.name} · {pkg.year}
          </p>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <TaskLiveForecastPanel task={pkg} allowManualProgress={canEdit} />

          {canAssign && (
            <section className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Assigned to</p>
              <Select
                value={pkg.assigned_to ?? "__unassigned__"}
                onValueChange={(value) => {
                  const assigned_to = value === "__unassigned__" ? null : value;
                  startTransition(async () => {
                    await updateWorkPackageAction(pkg.id, { assigned_to });
                    router.refresh();
                  });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Notes</p>
            <Textarea
              defaultValue={pkg.notes ?? ""}
              rows={3}
              placeholder="Add a note…"
              disabled={!canEdit || pending}
              onBlur={(e) => {
                if (!canEdit) return;
                const v = e.target.value;
                if (v !== (pkg.notes ?? "")) {
                  startTransition(async () => {
                    await updateWorkPackageAction(pkg.id, { notes: v || null });
                    router.refresh();
                  });
                }
              }}
            />
          </div>

          {canEdit && (
            <section className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Log time</p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  startTransition(async () => {
                    await createTimeLogAction({
                      work_package_id: pkg.id,
                      user_id: currentUserId,
                      hours: Number(fd.get("hours")),
                      log_date: (fd.get("log_date") as string) || new Date().toISOString().split("T")[0],
                      notes: (fd.get("tl_notes") as string) || undefined,
                    });
                    (e.target as HTMLFormElement).reset();
                    router.refresh();
                  });
                }}
              >
                <Input name="hours" type="number" step="0.5" placeholder="Hrs" className="w-20" required />
                <Input name="log_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="flex-1" />
                <Button type="submit" size="sm" disabled={pending}>Log</Button>
              </form>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {pkgLogs.map((t) => (
                  <li key={t.id}>{t.log_date}: {t.hours}h {t.notes && `— ${t.notes}`}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Comments</p>
            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const body = fd.get("body") as string;
                  if (!body.trim()) return;
                  startTransition(async () => {
                    await createCommentAction(pkg.id, currentUserId, body);
                    (e.target as HTMLFormElement).reset();
                    router.refresh();
                  });
                }}
              >
                <Textarea name="body" rows={2} placeholder="Add a comment…" />
                <Button type="submit" size="sm" className="mt-2" disabled={pending}>Post</Button>
              </form>
            )}
            <ul className="space-y-2">
              {pkgComments.map((c) => (
                <li key={c.id} className="text-sm rounded-md bg-muted/30 p-2">{c.body}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Files</p>
            {canEdit ? (
              <TaskFileUploadZone
                taskId={pkg.id}
                files={pkgFiles}
                disabled={pending}
                onUploaded={() => router.refresh()}
              />
            ) : pkgFiles.length > 0 ? (
              <TaskFileUploadZone taskId={pkg.id} files={pkgFiles} disabled />
            ) : (
              <p className="text-xs text-muted-foreground">No files attached to this task.</p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
