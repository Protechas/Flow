"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeInflation,
  documentKey,
  type FileLike,
} from "@/lib/files/effective-docs";
import { cn } from "@/lib/utils";
import { FileUp, Type } from "lucide-react";

/** Names + sizes only — nothing is uploaded anywhere. */
export function FileCheckTool() {
  const [text, setText] = useState("");
  const [dropped, setDropped] = useState<FileLike[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const files: FileLike[] = useMemo(() => {
    if (dropped.length > 0) return dropped;
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((file_name) => ({ file_name, file_size: 0 }));
  }, [text, dropped]);

  const analysis = files.length > 0 ? analyzeInflation(files) : null;

  const groups = useMemo(() => {
    const byDoc = new Map<string, string[]>();
    for (const f of files) {
      const k = documentKey(f.file_name);
      const list = byDoc.get(k) ?? [];
      list.push(f.file_name);
      byDoc.set(k, list);
    }
    return [...byDoc.entries()]
      .filter(([, names]) => names.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
  }, [files]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const list = [...e.dataTransfer.files].map((f) => ({
      file_name: f.name,
      file_size: f.size,
    }));
    if (list.length > 0) setDropped(list);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Type className="h-3.5 w-3.5" />
            Paste file names — one per line
          </p>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDropped([]);
            }}
            placeholder={"Camry 2023 ADAS-Part-1.pdf\nCamry 2023 ADAS-Part-2.pdf\nCamry 2023 Front Radar.pdf"}
            className="min-h-44 font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileUp className="h-3.5 w-3.5" />
            …or drop files here
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground",
              dragOver && "border-primary bg-primary/5"
            )}
          >
            {dropped.length > 0 ? (
              <>
                <p className="font-medium text-foreground">
                  {dropped.length} files read
                </p>
                <p className="mt-1 text-xs">Names and sizes only — nothing was uploaded.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setDropped([])}
                >
                  Clear
                </Button>
              </>
            ) : (
              <p>
                Drag files from a folder to check them.
                <br />
                <span className="text-xs">
                  Only names and sizes are read — nothing leaves your machine.
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {analysis && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Raw files" value={analysis.raw} />
            <Stat
              label="Effective documents"
              value={analysis.effective}
              highlight
            />
            <Stat
              label="Duplicate copies"
              value={analysis.duplicateCopies}
              warn={analysis.duplicateCopies > 0}
            />
            <Stat
              label="Split parts collapsed"
              value={analysis.splitParts}
              warn={analysis.splitParts > 0}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Scores, forecasts, and the leaderboard all count <strong>effective</strong>{" "}
            documents — split &quot;-Part-N&quot; files count as one document and exact
            duplicate re-uploads count once.
          </p>

          {groups.length > 0 && (
            <div className="enterprise-panel p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What gets collapsed
              </h3>
              <ul className="space-y-2 text-sm">
                {groups.map(([key, names]) => (
                  <li key={key}>
                    <p className="font-medium">
                      {names.length} files → 1 document
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {names.join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        highlight && "border-primary/40 bg-primary/5",
        warn && "border-amber-500/40 bg-amber-500/5"
      )}
    >
      <p className={cn("text-2xl font-semibold tabular-nums", highlight && "text-primary")}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
