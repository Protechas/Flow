"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { uploadTaskFileAction } from "@/app/actions/production";
import { useFlowToast } from "@/components/ui/flow-toast";
import { formatActionError } from "@/lib/errors/action-messages";
import {
  clientTaskFileMaxBytes,
  formatUploadLimitLabel,
} from "@/lib/files/upload-limits-client";
import { collectDroppedFiles, MAX_DROPPED_FILES } from "@/lib/files/drop-entries";
import { fileViewHref, taskFileHasContent } from "@/lib/files/download";
import { cn } from "@/lib/utils";
import type { TaskFileUpload } from "@/types/flow";
import { FileText, Loader2, Upload } from "lucide-react";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskFileUploadZone({
  taskId,
  files,
  disabled,
  onUploaded,
  employeeViewer,
}: {
  taskId: string;
  files: TaskFileUpload[];
  disabled?: boolean;
  onUploaded?: () => void;
  /** Employees can only open the /work viewer — the /files viewer bounces them */
  employeeViewer?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useFlowToast();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = useCallback(
    (fileList: FileList | File[]) => {
      const list = Array.from(fileList);
      if (list.length === 0) return;
      setError(null);
      // Size gate BEFORE sending: an oversized request never reaches the
      // server action, so without this the user sees a raw "Bad Request".
      const oversized = list.find((f) => f.size > clientTaskFileMaxBytes);
      if (oversized) {
        const description =
          `"${oversized.name}" is ${formatFileSize(oversized.size)} — the upload limit is ` +
          `${formatUploadLimitLabel(clientTaskFileMaxBytes)} per file. Split the document ` +
          `into "-Part-N" files per the SOP and drop the parts instead.`;
        setError(description);
        toast({ variant: "error", title: "File too large", description });
        return;
      }
      startTransition(async () => {
        for (const file of list) {
          const fd = new FormData();
          fd.set("task_id", taskId);
          fd.set("file", file);
          const res = await uploadTaskFileAction(fd);
          if (!res.ok) {
            const description = formatActionError(new Error(res.message));
            setError(description);
            toast({ variant: "error", title: "Upload failed", description });
            return;
          }
        }
        toast({ variant: "success", title: "File uploaded", description: `${list.length} file(s) attached to this task.` });
        onUploaded?.();
      });
    },
    [taskId, onUploaded, toast]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          // Folders traverse into their files; plain files pass through.
          const dt = e.dataTransfer;
          void collectDroppedFiles(dt).then((collected) => {
            if (collected.length >= MAX_DROPPED_FILES) {
              const description = `That drop has ${MAX_DROPPED_FILES}+ files — upload in smaller batches.`;
              setError(description);
              toast({ variant: "error", title: "Too many files at once", description });
              return;
            }
            if (collected.length) uploadFiles(collected);
          });
        }}
        className={cn(
          "relative flow-upload-zone p-6 text-center",
          dragOver && "flow-upload-zone-active",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {pending ? (
          <Loader2 className="h-6 w-6 mx-auto text-muted-foreground mb-2 animate-spin" />
        ) : (
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        )}
        <p className="text-sm font-medium">Drop completed files — or a whole folder — here</p>
        <p className="flow-helper mt-1">
          Folders upload everything inside them · Required before submitting for QA review · Max{" "}
          {formatUploadLimitLabel(clientTaskFileMaxBytes)} per file
        </p>
        <input
          type="file"
          multiple
          disabled={disabled || pending}
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {files.length > 0 && (
        <div className="enterprise-panel overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/50">
            <p className="enterprise-label normal-case tracking-normal">
              {files.length} file{files.length !== 1 ? "s" : ""} uploaded
            </p>
          </div>
          <ul className="divide-y divide-border">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 text-sm px-3 py-2 enterprise-row-hover"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                {taskFileHasContent(f) ? (
                  <Link
                    href={fileViewHref("task", f.id, { employee: employeeViewer })}
                    className="truncate flex-1 text-primary hover:underline"
                  >
                    {f.file_name}
                  </Link>
                ) : (
                  <span
                    className="truncate flex-1 text-muted-foreground"
                    title="File content unavailable — uploaded before file storage was enabled; please re-upload"
                  >
                    {f.file_name}
                  </span>
                )}
                <span className="flow-meta shrink-0 tabular-nums">
                  {formatFileSize(f.file_size)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
