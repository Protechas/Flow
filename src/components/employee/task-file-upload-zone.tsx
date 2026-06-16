"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { uploadTaskFileAction } from "@/app/actions/production";
import { useFlowToast } from "@/components/ui/flow-toast";
import { formatActionError } from "@/lib/errors/action-messages";
import { fileViewHref } from "@/lib/files/download";
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
}: {
  taskId: string;
  files: TaskFileUpload[];
  disabled?: boolean;
  onUploaded?: () => void;
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
    [taskId, onUploaded]
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
          if (!disabled && e.dataTransfer.files.length) {
            uploadFiles(e.dataTransfer.files);
          }
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
        <p className="text-sm font-medium">Drop completed files here</p>
        <p className="flow-helper mt-1">Required before submitting for QA review</p>
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
                {f.file_data_base64 ? (
                  <Link
                    href={fileViewHref("task", f.id)}
                    className="truncate flex-1 text-primary hover:underline"
                  >
                    {f.file_name}
                  </Link>
                ) : (
                  <span className="truncate flex-1">{f.file_name}</span>
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
