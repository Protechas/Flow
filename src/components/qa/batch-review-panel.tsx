"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewBatchSubmissionAction } from "@/app/actions/qa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFlowToast } from "@/components/ui/flow-toast";
import { fileViewHref, taskFileHasContent } from "@/lib/files/download";
import { formatMinutes } from "@/lib/production/metrics";
import type { TaskFileUpload, TaskSubmissionRecord, User, WorkPackage } from "@/types/flow";
import { FileText, Layers } from "lucide-react";

export interface BatchReviewEntry {
  submission: TaskSubmissionRecord;
  task: WorkPackage;
  files: TaskFileUpload[];
  analyst: User | null;
}

export function BatchReviewPanel({
  items,
  canReview,
}: {
  items: BatchReviewEntry[];
  canReview: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  if (items.length === 0) return null;

  function decide(submissionId: string, result: "pass" | "correction") {
    startTransition(async () => {
      const res = await reviewBatchSubmissionAction({
        submissionId,
        result,
        notes: notesById[submissionId] || undefined,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Batch review failed", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: result === "pass" ? "Batch approved" : "Corrections requested",
        description:
          result === "pass"
            ? "The analyst keeps working — reviewed files are marked approved."
            : "The task is flagged for corrections; the analyst can keep working.",
      });
      router.refresh();
    });
  }

  return (
    <div className="enterprise-panel overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary">
        <Layers className="h-4 w-4 text-primary" />
        <h3 className="enterprise-section-title">In-Progress Batches ({items.length})</h3>
        <span className="text-xs text-muted-foreground">
          File batches from tasks still being worked — reviewing does not hand the task back
        </span>
      </div>
      <div className="divide-y divide-border">
        {items.map(({ submission, task, files, analyst }) => (
          <div key={submission.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/qa-center/review?package=${task.id}`} className="font-medium hover:underline">
                  {task.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {analyst?.full_name ?? "Unknown analyst"} · {submission.uploaded_file_count} files ·{" "}
                  {formatMinutes(submission.total_task_minutes)} this session ·{" "}
                  {new Date(submission.submitted_at).toLocaleString()}
                </p>
              </div>
              {canReview && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => decide(submission.id, "pass")}
                  >
                    Approve batch
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => decide(submission.id, "correction")}
                  >
                    Request corrections
                  </Button>
                </div>
              )}
            </div>
            {submission.notes && (
              <p className="text-sm text-muted-foreground">“{submission.notes}”</p>
            )}
            {files.length > 0 && (
              <ul className="grid gap-1 sm:grid-cols-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {taskFileHasContent(f) ? (
                      <a
                        href={fileViewHref("task", f.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline"
                      >
                        {f.file_name}
                      </a>
                    ) : (
                      <span className="truncate text-muted-foreground">{f.file_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canReview && (
              <Input
                placeholder="Review notes for the analyst (optional)"
                value={notesById[submission.id] ?? ""}
                onChange={(e) =>
                  setNotesById((m) => ({ ...m, [submission.id]: e.target.value }))
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
