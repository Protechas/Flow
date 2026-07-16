"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fileViewHref } from "@/lib/files/download";
import { operationsHref } from "@/lib/navigation/deep-links";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
} from "lucide-react";

export interface TaskFileEntry {
  id: string;
  name: string;
  uploadedAt: string;
  uploader: string;
  hasContent: boolean;
}

/** Local calendar day (YYYY-MM-DD) for an ISO timestamp — matches <input type="date">. */
function localDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA");
}

export interface TaskFileGroup {
  taskId: string;
  taskTitle: string;
  projectName: string;
  analystName: string;
  latestUploadAt: string;
  missingContent: number;
  files: TaskFileEntry[];
}

export function TaskFilesBrowser({
  groups,
  initialTaskId,
}: {
  groups: TaskFileGroup[];
  initialTaskId?: string;
}) {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<string>("all");
  const [uploader, setUploader] = useState<string>("all");
  const [day, setDay] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialTaskId ? [initialTaskId] : [])
  );

  const projects = useMemo(
    () => [...new Set(groups.map((g) => g.projectName))].sort(),
    [groups]
  );

  const uploaders = useMemo(
    () => [...new Set(groups.flatMap((g) => g.files.map((f) => f.uploader)))].sort(),
    [groups]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => project === "all" || g.projectName === project)
      .map((g) => {
        let files = g.files;
        if (uploader !== "all") files = files.filter((f) => f.uploader === uploader);
        if (day) files = files.filter((f) => localDay(f.uploadedAt) === day);
        if (q) {
          const groupHit =
            g.taskTitle.toLowerCase().includes(q) ||
            g.projectName.toLowerCase().includes(q) ||
            g.analystName.toLowerCase().includes(q);
          if (!groupHit) {
            files = files.filter(
              (f) =>
                f.name.toLowerCase().includes(q) ||
                f.uploader.toLowerCase().includes(q)
            );
          }
        }
        return files === g.files ? g : { ...g, files };
      })
      .filter((g) => g.files.length > 0)
      .sort((a, b) => b.latestUploadAt.localeCompare(a.latestUploadAt));
  }, [groups, project, query, uploader, day]);

  // Uploads per day for the current filter — answers "how many is she
  // uploading per day" without scrolling the whole list.
  const dailyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of filtered) {
      for (const f of g.files) {
        const d = localDay(f.uploadedAt);
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 21);
  }, [filtered]);

  const totalShown = useMemo(
    () => filtered.reduce((s, g) => s + g.files.length, 0),
    [filtered]
  );

  const searching = query.trim().length > 0;
  const filtersActive = searching || uploader !== "all" || day !== "";

  function toggle(taskId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, tasks, or analysts…"
            className="pl-9"
          />
        </div>
        <Select value={project} onValueChange={(v) => v && setProject(v)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={uploader} onValueChange={(v) => v && setUploader(v)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All uploaders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All uploaders</SelectItem>
            {uploaders.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="sm:w-40"
            aria-label="Filter by upload day"
          />
          {day && (
            <Button size="sm" variant="ghost" onClick={() => setDay("")}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {filtersActive && (
        <p className="text-xs text-muted-foreground px-1">
          {totalShown} file{totalShown === 1 ? "" : "s"} match
          {uploader !== "all" ? ` · ${uploader}` : ""}
          {day ? ` · ${day}` : ""}
        </p>
      )}

      {uploader !== "all" && dailyCounts.length > 0 && (
        <div className="enterprise-panel px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {uploader} — uploads per day{day ? " (clear the day filter to see all days)" : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dailyCounts.map(([d, count]) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(day === d ? "" : d)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors",
                  day === d
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40"
                )}
                title={`Show only ${d}`}
              >
                {new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · <span className="font-semibold">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No files match{query ? ` “${query}”` : " the current filters"}.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => {
            // Only a text search forces groups open (you need to see the hits).
            // Uploader/day filters keep groups closed and collapsible — the
            // per-day counts already answer the question without expanding.
            const open = searching || expanded.has(g.taskId);
            return (
              <div
                key={g.taskId}
                className="enterprise-panel overflow-hidden"
                id={`task-upload-${g.taskId}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(g.taskId)}
                  className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-muted/20"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-semibold">{g.taskTitle}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.projectName} · {g.analystName}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {g.missingContent > 0 && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/40 text-amber-500 text-[10px]"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {g.missingContent} need re-upload
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {g.files.length} file{g.files.length === 1 ? "" : "s"}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(g.latestUploadAt).toLocaleDateString()}
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border/40">
                    <ul className="divide-y divide-border/30">
                      {g.files.map((f) => (
                        <li
                          key={f.id}
                          className="flex flex-wrap items-center gap-2 px-4 py-2 pl-10 text-sm hover:bg-muted/10"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {f.hasContent ? (
                            <Link
                              href={fileViewHref("task", f.id)}
                              className={cn("truncate font-medium text-primary hover:underline")}
                            >
                              {f.name}
                            </Link>
                          ) : (
                            <span
                              className="truncate text-muted-foreground"
                              title="Uploaded before file storage was enabled — ask the analyst to re-upload"
                            >
                              {f.name}
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{f.uploader}</span>
                            <span className="tabular-nums">
                              {new Date(f.uploadedAt).toLocaleString()}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-border/40 px-4 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        render={<Link href={operationsHref({ package: g.taskId })} />}
                      >
                        Open task in Operations
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
