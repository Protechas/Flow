"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  completeWorkPackageAction,
  createCommentAction,
  createTimeLogAction,
  submitWorkPackageToQaAction,
  updateWorkPackageAction,
} from "@/app/actions/crud";
import { TaskFileUploadZone } from "@/components/employee/task-file-upload-zone";
import { TaskLiveForecastPanel } from "@/components/forecast/task-live-forecast-panel";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { qaStatusLabel } from "@/lib/constants";
import { formatLastActivity } from "@/components/operations/rollup-cells";
import { cn } from "@/lib/utils";
import type { Comment, TaskFileUpload, TimeLog, User, WorkPackage } from "@/types/flow";
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileUp,
  Send,
  UserRound,
} from "lucide-react";

export interface PackageDetailActions {
  canAssign: boolean;
  canEdit: boolean;
  canSubmitQa: boolean;
  canManage: boolean;
}

export function PackageDetailContent({
  pkg,
  comments,
  taskFiles,
  timeLogs,
  currentUserId,
  analysts,
  actions,
  onUpdated,
}: {
  pkg: WorkPackage;
  comments: Comment[];
  taskFiles: TaskFileUpload[];
  timeLogs: TimeLog[];
  currentUserId: string;
  analysts: User[];
  actions: PackageDetailActions;
  onUpdated?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { canAssign, canEdit, canSubmitQa } = actions;

  const pkgComments = comments.filter((c) => c.work_package_id === pkg.id);
  const pkgFiles = taskFiles.filter((f) => f.task_id === pkg.id);
  const pkgLogs = timeLogs.filter((t) => t.work_package_id === pkg.id);
  const assignee = analysts.find((a) => a.id === pkg.assigned_to);

  const refresh = () => {
    onUpdated?.();
    router.refresh();
  };

  const canSubmit =
    canSubmitQa && pkg.status !== "done" && !["ready_for_qa", "in_qa"].includes(pkg.status);
  const canComplete = canEdit && pkg.status !== "done";
  const isEmployeeTask = assignee?.id === currentUserId;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {canAssign && (
          <Select
            value={pkg.assigned_to ?? "__unassigned__"}
            onValueChange={(value) => {
              const assigned_to = value === "__unassigned__" ? null : value;
              startTransition(async () => {
                await updateWorkPackageAction(pkg.id, { assigned_to });
                refresh();
              });
            }}
          >
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <UserRound className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Assign…" />
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
        )}
        {isEmployeeTask && (
          <Link
            href={`/work/${pkg.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Open workspace
          </Link>
        )}
        {canSubmit && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await submitWorkPackageToQaAction(pkg.id);
                refresh();
              })
            }
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Send to QA
          </Button>
        )}
        {canComplete && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await completeWorkPackageAction(pkg.id);
                refresh();
              })
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Mark complete
          </Button>
        )}
        {assignee && (
          <Link
            href={`/people/${assignee.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-xs")}
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            View workload
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-0.5"><StatusBadge status={pkg.status} size="sm" /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Priority</dt>
          <dd className="mt-0.5"><PriorityBadge priority={pkg.priority} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Assigned</dt>
          <dd className="mt-0.5 font-medium">{assignee?.full_name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Due date</dt>
          <dd className="mt-0.5 tabular-nums">{pkg.due_date ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Est / actual hours</dt>
          <dd className="mt-0.5 tabular-nums">{pkg.estimated_hours}h / {pkg.actual_hours}h</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Files</dt>
          <dd className="mt-0.5 tabular-nums">{pkg.file_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">QA status</dt>
          <dd className="mt-0.5">{qaStatusLabel(pkg.qa_status)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Corrections</dt>
          <dd className="mt-0.5 tabular-nums">{pkg.correction_count}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Last activity</dt>
          <dd className="mt-0.5 text-muted-foreground">{formatLastActivity(pkg.updated_at)}</dd>
        </div>
      </dl>

      <TaskLiveForecastPanel task={pkg} allowManualProgress={canEdit} />

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
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
                refresh();
              });
            }
          }}
        />
      </div>

      {canEdit && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Log time</p>
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
                refresh();
              });
            }}
          >
            <Input name="hours" type="number" step="0.5" placeholder="Hrs" className="w-20 h-8 text-xs" required />
            <Input name="log_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="flex-1 h-8 text-xs" />
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={pending}>Log</Button>
          </form>
          <ul className="text-xs space-y-1 text-muted-foreground">
            {pkgLogs.map((t) => (
              <li key={t.id}>{t.log_date}: {t.hours}h {t.notes && `— ${t.notes}`}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comments</p>
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
                refresh();
              });
            }}
          >
            <Textarea name="body" rows={2} placeholder="Add a comment…" className="text-sm" />
            <Button type="submit" size="sm" className="mt-2 h-8 text-xs" disabled={pending}>Post</Button>
          </form>
        )}
        <ul className="space-y-2">
          {pkgComments.map((c) => (
            <li key={c.id} className="text-sm rounded-md bg-muted/30 p-2">{c.body}</li>
          ))}
          {!pkgComments.length && (
            <li className="text-xs text-muted-foreground">No comments yet.</li>
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <FileUp className="h-3.5 w-3.5" />
          Files
        </p>
        {canEdit ? (
          <TaskFileUploadZone
            taskId={pkg.id}
            files={pkgFiles}
            disabled={pending}
            onUploaded={refresh}
          />
        ) : pkgFiles.length > 0 ? (
          <TaskFileUploadZone taskId={pkg.id} files={pkgFiles} disabled />
        ) : (
          <p className="text-xs text-muted-foreground">No files attached to this task.</p>
        )}
      </section>
    </div>
  );
}
