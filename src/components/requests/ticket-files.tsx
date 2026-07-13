"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteRequestTicketFileAction,
  uploadRequestTicketFileAction,
} from "@/app/actions/request-tickets";
import { useFlowToast } from "@/components/ui/flow-toast";
import { cn } from "@/lib/utils";
import type { RequestTicketFileView } from "@/types/flow";
import { FileText, Loader2, Paperclip, X } from "lucide-react";

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The handoff surface on a ticket: drop the finished doc in, and on the other
 * side click to download — or drag the chip straight into an email (Chromium
 * exposes drags as real file downloads via DownloadURL).
 */
export function TicketFiles({
  ticketId,
  files,
  canUpload,
  currentUserId,
}: {
  ticketId: string;
  files: RequestTicketFileView[];
  canUpload: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (picked: FileList | File[]) => {
    const list = [...picked];
    if (list.length === 0) return;
    startTransition(async () => {
      for (const file of list) {
        const formData = new FormData();
        formData.set("ticketId", ticketId);
        formData.set("file", file);
        const res = await uploadRequestTicketFileAction(formData);
        if (!res.ok) {
          toast({ variant: "error", title: `Couldn't attach ${file.name}`, description: res.message });
        }
      }
      router.refresh();
    });
  };

  const remove = (fileId: string) =>
    startTransition(async () => {
      const res = await deleteRequestTicketFileAction(fileId);
      if (!res.ok) toast({ variant: "error", title: res.message ?? "Could not remove file" });
      router.refresh();
    });

  if (!canUpload && files.length === 0) return null;

  return (
    <div className="w-full space-y-1.5">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file) => {
            const href = `/api/request-files/${file.id}?download=1`;
            return (
              <span
                key={file.id}
                draggable
                onDragStart={(e) => {
                  // Chromium: dragging the chip out of the browser carries the
                  // real file — straight into an email or folder.
                  const absolute = `${window.location.origin}${href}`;
                  e.dataTransfer.setData(
                    "DownloadURL",
                    `${file.mime_type || "application/octet-stream"}:${file.file_name}:${absolute}`
                  );
                  e.dataTransfer.setData("text/uri-list", absolute);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs cursor-grab active:cursor-grabbing"
                title={`${file.file_name} · ${sizeLabel(file.file_size)} · from ${file.uploaded_by_name} — click to download or drag into your email`}
              >
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href={href} download={file.file_name} className="hover:underline max-w-[180px] truncate">
                  {file.file_name}
                </a>
                <span className="text-muted-foreground">{sizeLabel(file.file_size)}</span>
                {(canUpload || file.user_id === currentUserId) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(file.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-foreground transition-colors",
            dragOver && "border-primary bg-primary/10 text-foreground"
          )}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          {pending ? "Attaching…" : "Drop the doc here (or click)"}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
