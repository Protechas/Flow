"use client";

import { useState, useTransition } from "react";
import {
  createCommentAction,
  createFileAction,
  createTimeLogAction,
  updateWorkPackageAction,
} from "@/app/actions/crud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Comment, FlowFile, TimeLog, WorkPackage } from "@/types/flow";

interface PackageDetailSheetProps {
  pkg: WorkPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: Comment[];
  files: FlowFile[];
  timeLogs: TimeLog[];
  currentUserId: string;
}

export function PackageDetailSheet({
  pkg,
  open,
  onOpenChange,
  comments,
  files,
  timeLogs,
  currentUserId,
}: PackageDetailSheetProps) {
  const [pending, startTransition] = useTransition();
  if (!pkg) return null;

  const pkgComments = comments.filter((c) => c.work_package_id === pkg.id);
  const pkgFiles = files.filter((f) => f.work_package_id === pkg.id);
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
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Notes</p>
            <Textarea
              defaultValue={pkg.notes ?? ""}
              rows={3}
              placeholder="Add a note…"
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (pkg.notes ?? "")) {
                  startTransition(async () => {
                    await updateWorkPackageAction(pkg.id, { notes: v || null });
                  });
                }
              }}
            />
          </div>

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

          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Comments</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const body = fd.get("body") as string;
                if (!body.trim()) return;
                startTransition(async () => {
                  await createCommentAction(pkg.id, currentUserId, body);
                  (e.target as HTMLFormElement).reset();
                });
              }}
            >
              <Textarea name="body" rows={2} placeholder="Add a comment…" />
              <Button type="submit" size="sm" className="mt-2" disabled={pending}>Post</Button>
            </form>
            <ul className="space-y-2">
              {pkgComments.map((c) => (
                <li key={c.id} className="text-sm rounded-md bg-muted/30 p-2">{c.body}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Files</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = fd.get("file_name") as string;
                if (!name.trim()) return;
                startTransition(async () => {
                  await createFileAction({
                    work_package_id: pkg.id,
                    uploaded_by: currentUserId,
                    file_name: name,
                  });
                  (e.target as HTMLFormElement).reset();
                });
              }}
            >
              <Input name="file_name" placeholder="filename.xlsx" className="flex-1" required />
              <Button type="submit" size="sm" disabled={pending}>Attach</Button>
            </form>
            <ul className="text-xs space-y-1">
              {pkgFiles.map((f) => (
                <li key={f.id} className="text-muted-foreground">{f.file_name}</li>
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
