"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_OPS_FILTERS,
  OPS_SAVED_VIEWS,
  type OpsBoardFilters,
  type OpsSavedViewId,
} from "@/lib/operations/board-filters";
import { QA_STATUSES, WORK_PRIORITIES, WORK_STATUSES } from "@/lib/constants";
import type { Project, User } from "@/types/flow";
import { ChevronDown, ChevronUp, Filter, Search, X } from "lucide-react";
import { useState } from "react";

interface OperationsToolbarProps {
  filters: OpsBoardFilters;
  onFiltersChange: (f: OpsBoardFilters) => void;
  projects: Project[];
  manufacturers: { id: string; name: string; projectId: string }[];
  analysts: User[];
  selectedCount: number;
  onBulkAssign?: (userId: string | null) => void;
  onBulkStatus?: (status: string) => void;
  onBulkPriority?: (priority: string) => void;
  onBulkDueDate?: (date: string) => void;
  onBulkSubmitQa?: () => void;
  onBulkArchive?: () => void;
  onBulkDelete?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  canBulk: boolean;
}

export function OperationsToolbar({
  filters,
  onFiltersChange,
  projects,
  manufacturers,
  analysts,
  selectedCount,
  onBulkAssign,
  onBulkStatus,
  onBulkPriority,
  onBulkDueDate,
  onBulkSubmitQa,
  onBulkArchive,
  onBulkDelete,
  onExpandAll,
  onCollapseAll,
  canBulk,
}: OperationsToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  function setView(viewId: OpsSavedViewId) {
    onFiltersChange({ ...filters, viewId });
  }

  function clearFilters() {
    onFiltersChange({ ...DEFAULT_OPS_FILTERS, viewId: filters.viewId });
  }

  const hasExtraFilters =
    !!filters.projectId ||
    !!filters.manufacturerId ||
    !!filters.assignedTo ||
    !!filters.status ||
    !!filters.priority ||
    !!filters.qaStatus ||
    filters.overdue ||
    filters.stuck ||
    filters.correctionNeeded;

  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search projects, manufacturers, years, tasks…"
            className="pl-8 h-9"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {OPS_SAVED_VIEWS.map((v) => (
            <Button
              key={v.id}
              variant={filters.viewId === v.id ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setView(v.id)}
            >
              {v.label}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setShowFilters((s) => !s)}
        >
          <Filter className="h-3.5 w-3.5 mr-1" />
          Filters
          {hasExtraFilters && <span className="ml-1 text-primary">•</span>}
        </Button>

        {hasExtraFilters && (
          <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}

        <div className="flex gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="h-8" onClick={onExpandAll} title="Expand all">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={onCollapseAll} title="Collapse all">
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border bg-secondary/30">
          <Select
            value={filters.projectId ?? "__all__"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, projectId: v && v !== "__all__" ? v : undefined })
            }
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.manufacturerId ?? "__all__"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, manufacturerId: v && v !== "__all__" ? v : undefined })
            }
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Manufacturer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All manufacturers</SelectItem>
              {manufacturers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.assignedTo ?? "__all__"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, assignedTo: v && v !== "__all__" ? v : undefined })
            }
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Anyone</SelectItem>
              {analysts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status ?? "__all__"}
            onValueChange={(v) =>
              onFiltersChange({
                ...filters,
                status: v && v !== "__all__" ? (v as OpsBoardFilters["status"]) : undefined,
              })
            }
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any status</SelectItem>
              {WORK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.priority ?? "__all__"}
            onValueChange={(v) =>
              onFiltersChange({
                ...filters,
                priority: v && v !== "__all__" ? (v as OpsBoardFilters["priority"]) : undefined,
              })
            }
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any priority</SelectItem>
              {WORK_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.qaStatus ?? "__all__"}
            onValueChange={(v) =>
              onFiltersChange({
                ...filters,
                qaStatus: v && v !== "__all__" ? (v as OpsBoardFilters["qaStatus"]) : undefined,
              })
            }
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="QA status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any QA</SelectItem>
              {QA_STATUSES.map((q) => (
                <SelectItem key={q.value} value={q.value}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={filters.overdue ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onFiltersChange({ ...filters, overdue: !filters.overdue })}
          >
            Overdue
          </Button>
          <Button
            variant={filters.stuck ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onFiltersChange({ ...filters, stuck: !filters.stuck })}
          >
            Stuck
          </Button>
          <Button
            variant={filters.correctionNeeded ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              onFiltersChange({ ...filters, correctionNeeded: !filters.correctionNeeded })
            }
          >
            Correction needed
          </Button>
        </div>
      )}

      {canBulk && selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-primary/25 bg-primary/5">
          <span className="text-xs font-medium text-primary">{selectedCount} selected</span>
          {onBulkAssign && (
            <Select onValueChange={(v) => onBulkAssign(typeof v === "string" && v !== "__none__" ? v : null)}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassign</SelectItem>
                {analysts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onBulkStatus && (
            <Select onValueChange={(v) => typeof v === "string" && onBulkStatus(v)}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue placeholder="Status…" />
              </SelectTrigger>
              <SelectContent>
                {WORK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onBulkPriority && (
            <Select onValueChange={(v) => typeof v === "string" && onBulkPriority(v)}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue placeholder="Priority…" />
              </SelectTrigger>
              <SelectContent>
                {WORK_PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onBulkDueDate && (
            <Input
              type="date"
              className="h-7 w-[130px] text-xs"
              onChange={(e) => e.target.value && onBulkDueDate(e.target.value)}
            />
          )}
          {onBulkSubmitQa && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onBulkSubmitQa}>
              Submit to QA
            </Button>
          )}
          {onBulkArchive && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onBulkArchive}>
              Archive
            </Button>
          )}
          {onBulkDelete && (
            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onBulkDelete}>
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
