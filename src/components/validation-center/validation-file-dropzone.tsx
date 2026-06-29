"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CheckCircle2, FileSpreadsheet, Replace, Upload, X } from "lucide-react";

export type DropzoneUploadStatus = "empty" | "ready" | "uploading";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ValidationFileDropzone({
  id,
  name,
  label,
  description,
  accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
  file,
  onFileChange,
  disabled,
  required,
  status = "empty",
}: {
  id: string;
  name: string;
  label: string;
  description?: string;
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  required?: boolean;
  status?: DropzoneUploadStatus;
}) {
  const [dragOver, setDragOver] = useState(false);

  const pickFile = useCallback(
    (list: FileList | File[]) => {
      const next = Array.from(list).find((f) => /\.xlsx?$/i.test(f.name));
      if (next) onFileChange(next);
    },
    [onFileChange]
  );

  const displayStatus = status === "uploading" ? "uploading" : file ? "ready" : "empty";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {displayStatus === "ready" && (
          <Badge variant="secondary" className="text-[10px] h-5 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Ready
          </Badge>
        )}
        {displayStatus === "uploading" && (
          <Badge variant="outline" className="text-[10px] h-5">
            Uploading…
          </Badge>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && e.dataTransfer.files.length) pickFile(e.dataTransfer.files);
        }}
        className={cn(
          "relative flow-upload-zone p-5 text-center min-h-[128px] flex flex-col items-center justify-center transition-all",
          dragOver && "flow-upload-zone-active",
          disabled && "opacity-50 pointer-events-none",
          file && "border-primary/40 bg-primary/5"
        )}
      >
        {file ? (
          <>
            <FileSpreadsheet className="h-6 w-6 text-primary mb-2" />
            <p className="text-sm font-medium truncate max-w-full px-4">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatFileSize(file.size)}</p>
            {!disabled && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Replace className="h-3 w-3" />
                  Drop to replace
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileChange(null);
                  }}
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop Excel file here</p>
            <p className="flow-helper mt-1">or click to browse · .xlsx / .xls</p>
          </>
        )}
        <input
          id={id}
          name={file ? name : undefined}
          type="file"
          accept={accept}
          required={required && !file}
          disabled={disabled}
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            if (e.target.files) pickFile(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
