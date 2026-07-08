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
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialTaskId ? [initialTaskId] : [])
  );

  const projects = useMemo(
    () => [...new Set(groups.map((g) => g.projectName))].sort(),
    [groups]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => project === "all" || g.projectName === project)
      .map((g) => {
        if (!q) return g;
        const groupHit =
          g.taskTitle.toLowerCase().includes(q) ||
          g.projectName.toLowerCase().includes(q) ||
          g.analystName.toLowerCase().includes(q);
        const files = groupHit
          ? g.files
          : g.files.filter(
              (f) =>
                f.name.toLowerCase().includes(q) ||
                f.uploader.toLowerCase().includes(q)
            );
        return { ...g, files };
      })
      .filter((g) => g.files.length > 0)
      .sort((a, b) => b.latestUploadAt.localeCompare(a.latestUploadAt));
  }, [groups, project, query]);

  const searching = query.trim().length > 0;

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
          <SelectTrigger className="sm:w-56">
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
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No files match{query ? ` “${query}”` : " the current filters"}.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => {
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
