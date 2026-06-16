"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { submitQaReviewAction } from "@/app/actions/qa";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ERROR_CATEGORIES, QA_RESULTS } from "@/lib/constants";
import { fileViewHref } from "@/lib/files/download";
import { operationsHref } from "@/lib/navigation/deep-links";
import { formatMinutes } from "@/lib/production/metrics";
import type { QaResult, TaskFileUpload, TaskSubmissionRecord, User, WorkPackage } from "@/types/flow";
import { FileText } from "lucide-react";

interface QaReviewPanelProps {
  queue: WorkPackage[];
  reviewer: User;
  canReview: boolean;
  fileMap?: Record<string, TaskFileUpload[]>;
  submissionMap?: Record<string, TaskSubmissionRecord | null>;
  initialPackageId?: string;
}

export function QaReviewPanel({
  queue,
  reviewer,
  canReview,
  fileMap = {},
  submissionMap = {},
  initialPackageId,
}: QaReviewPanelProps) {
  const [selectedId, setSelectedId] = useState(
    initialPackageId && queue.some((q) => q.id === initialPackageId)
      ? initialPackageId
      : (queue[0]?.id ?? "")
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialPackageId && queue.some((q) => q.id === initialPackageId)) {
      setSelectedId(initialPackageId);
    }
  }, [initialPackageId, queue]);
  const selected = queue.find((q) => q.id === selectedId);

  function submit(result: QaResult, form: FormData) {
    if (!selected?.assigned_to) return;
    startTransition(async () => {
      await submitQaReviewAction({
        workPackageId: selected.id,
        reviewerId: reviewer.id,
        analystId: selected.assigned_to!,
        result,
        notes: (form.get("notes") as string) || undefined,
        errorCategory: (form.get("error_category") as string) || undefined,
      });
      setSelectedId(queue.find((q) => q.id !== selectedId)?.id ?? "");
    });
  }

  if (queue.length === 0) {
    return (
      <div className="enterprise-panel py-12 text-center text-muted-foreground text-sm">
        No work items awaiting QA review.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="enterprise-panel lg:col-span-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary">
          <h3 className="enterprise-section-title">Review Queue ({queue.length})</h3>
        </div>
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
          {queue.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                selectedId === item.id
                  ? "bg-primary/15 border-l-2 border-l-primary"
                  : "border-l-2 border-l-transparent hover:bg-accent"
              }`}
            >
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.assignee?.full_name} · {item.manufacturer?.name}
              </p>
              <div className="mt-2">
                <StatusBadge status={item.status} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="enterprise-panel lg:col-span-2">
          <div className="px-4 py-3 border-b border-border bg-secondary flex items-start justify-between gap-3">
            <div>
              <h3 className="enterprise-section-title">{selected.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.project?.name} · {selected.manufacturer?.name} · {selected.year} ·{" "}
                {selected.assignee?.full_name}
              </p>
            </div>
            <Button size="sm" variant="outline" render={<Link href={operationsHref({ package: selected.id })} />}>
              Open task
            </Button>
          </div>
          <div className="p-4">
            {submissionMap[selected.id] && (
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Task time</p>
                  <p className="font-semibold">{formatMinutes(submissionMap[selected.id]!.total_task_minutes)}</p>
                </div>
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Files</p>
                  <p className="font-semibold">{submissionMap[selected.id]!.uploaded_file_count}</p>
                </div>
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Min / doc</p>
                  <p className="font-semibold">{submissionMap[selected.id]!.average_minutes_per_document || "—"}</p>
                </div>
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Docs / hr</p>
                  <p className="font-semibold">{submissionMap[selected.id]!.documents_per_hour || "—"}</p>
                </div>
              </div>
            )}

            {(fileMap[selected.id]?.length ?? 0) > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Submitted files
                </p>
                <ul className="space-y-1 text-sm">
                  {fileMap[selected.id]!.map((f) => (
                    <li key={f.id} className="rounded-md bg-muted/20 px-3 py-2 flex justify-between gap-2">
                      {f.file_data_base64 ? (
                        <Link
                          href={fileViewHref("task", f.id)}
                          className="truncate text-primary hover:underline"
                        >
                          {f.file_name}
                        </Link>
                      ) : (
                        <span className="truncate">{f.file_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(f.file_size / 1024).toFixed(1)} KB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!canReview ? (
              <div className="rounded-md border border-[var(--border-subtle)] bg-muted/30 px-4 py-3 mb-4">
                <p className="text-sm font-medium">Read-only QA access</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can review queue details and download submitted files. QA decisions require review permission.
                </p>
              </div>
            ) : null}
            {canReview && (
            <form id="qa-form" className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label>Error Category</Label>
                <Select name="error_category">
                  <SelectTrigger>
                    <SelectValue placeholder="Select if correction needed" />
                  </SelectTrigger>
                  <SelectContent>
                    {ERROR_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Review Notes</Label>
                <Input id="notes" name="notes" placeholder="Optional feedback for analyst" />
              </div>
            </form>
            )}
            {canReview && (
            <div className="flex flex-wrap gap-2">
              {QA_RESULTS.map((r) => (
                <Button
                  key={r.value}
                  disabled={pending || !canReview}
                  variant={r.value === "pass" ? "default" : "outline"}
                  className={
                    r.value === "rejected"
                      ? "border-red-500/40 text-red-300"
                      : ""
                  }
                  onClick={() => {
                    const form = document.getElementById("qa-form") as HTMLFormElement;
                    submit(r.value, new FormData(form));
                  }}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
