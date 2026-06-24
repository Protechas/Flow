"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  bootstrapDepartmentOrgStructureAction,
  buildInformationSolutionsStructureAction,
} from "@/app/actions/org-structure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatActionError } from "@/lib/errors/action-messages";
import { INFORMATION_SOLUTIONS_TEAMS } from "@/lib/positions/bootstrap";
import { cn } from "@/lib/utils";
import type { Department, User } from "@/types/flow";
import { Building2, ChevronDown, Network, Plus, Trash2 } from "lucide-react";

interface TeamDraft {
  id: string;
  name: string;
}

function newTeamDraft(name = ""): TeamDraft {
  return { id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name };
}

export function OrgStructureBuilder({
  departments,
  users,
  canManage,
  defaultExpanded = false,
}: {
  departments: Department[];
  users: User[];
  canManage: boolean;
  /** Collapsed by default on org chart to save vertical space. */
  defaultExpanded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [departmentName, setDepartmentName] = useState("Information Solutions");
  const [existingDeptId, setExistingDeptId] = useState("");
  const [markUserId, setMarkUserId] = useState("");
  const [employeeSeats, setEmployeeSeats] = useState("1");
  const [teams, setTeams] = useState<TeamDraft[]>(
    INFORMATION_SOLUTIONS_TEAMS.map((t) => newTeamDraft(t.name))
  );

  if (!canManage) return null;

  function refresh() {
    router.refresh();
  }

  function run(action: () => Promise<{ seatCount?: number; departmentId?: string }>) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await action();
        setSuccess(
          `Created ${result.seatCount ?? 0} position seats. Assign users from the org chart when ready.`
        );
        refresh();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <div className="enterprise-panel p-5 space-y-4">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Network className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">Org Structure Builder</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expanded
                ? "Build department → team → manager → team lead → employee seats first. Assign people later."
                : "Build department and team seats — click to expand"}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform mt-1",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={pending}
          onClick={() =>
            run(() =>
              buildInformationSolutionsStructureAction({
                markUserId: markUserId || null,
                employeeSeatsPerTeam: Number(employeeSeats) || 1,
              })
            )
          }
        >
          <Building2 className="h-4 w-4 mr-1.5" />
          Build Information Solutions (preset)
        </Button>
      </div>

      <div className="border-t border-border/50 pt-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Custom department structure
        </p>
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          <div className="space-y-2">
            <Label>Department name</Label>
            <Input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Use existing department (optional)</Label>
            <Select
              value={existingDeptId || "__new__"}
              onValueChange={(v) => setExistingDeptId(!v || v === "__new__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Create new" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">Create new department</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Senior manager (optional)</Label>
            <Select
              value={markUserId || "__none__"}
              onValueChange={(v) => setMarkUserId(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Vacant seat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Vacant seat</SelectItem>
                {users.filter((u) => u.is_active).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Employee seats per team</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={employeeSeats}
              onChange={(e) => setEmployeeSeats(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Teams</Label>
          {teams.map((team, index) => (
            <div key={team.id} className="flex gap-2 items-center">
              <Input
                value={team.name}
                onChange={(e) =>
                  setTeams((prev) =>
                    prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t))
                  )
                }
                placeholder={`Team ${index + 1}`}
              />
              {teams.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTeams((prev) => prev.filter((t) => t.id !== team.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTeams((prev) => [...prev, newTeamDraft()])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add team
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={pending || !departmentName.trim() || !teams.some((t) => t.name.trim())}
          onClick={() =>
            run(() =>
              bootstrapDepartmentOrgStructureAction({
                departmentName: departmentName.trim(),
                departmentId: existingDeptId || undefined,
                seniorManagerUserId: markUserId || null,
                teams: teams.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim() })),
                employeeSeatsPerTeam: Number(employeeSeats) || 1,
              })
            )
          }
        >
          Build structure
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Each team gets vacant Manager, Team Lead, and Employee seats. System access stays separate from org position.
      </p>

      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}

      {!expanded && (success || error) && (
        <div className="pt-1">
          {success && <p className="text-sm text-emerald-400">{success}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
