"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { POSITION_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { peopleHref } from "@/lib/navigation/deep-links";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { cn } from "@/lib/utils";
import type { Department, OrgChartUserOps, Team, User } from "@/types/flow";
import { AlertTriangle, HelpCircle, Moon, Search } from "lucide-react";

type PositionFilter = "all" | "employee" | "team_lead" | "manager" | "senior_manager";
type StatusFilter = "all" | "active" | "inactive";

type OpsFilter = "clocked_in" | "needs_work" | "needs_help" | "missing_wrap_up";

const OPS_FILTERS: { id: OpsFilter; label: string; icon: ReactNode | null }[] = [
  { id: "clocked_in", label: OPS_COPY.employeesClockedIn, icon: null },
  { id: "needs_work", label: OPS_COPY.availableCapacity, icon: <AlertTriangle className="h-3 w-3" /> },
  { id: "needs_help", label: OPS_COPY.openEscalations, icon: <HelpCircle className="h-3 w-3" /> },
  { id: "missing_wrap_up", label: OPS_COPY.outstandingDailyReports, icon: <Moon className="h-3 w-3" /> },
];

function SignalPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "danger" | "muted" | "info";
}) {
  const tones = {
    ok: "text-emerald-400 border-emerald-500/35 bg-emerald-500/10",
    warn: "text-amber-400 border-amber-500/35 bg-amber-500/10",
    danger: "text-red-400 border-red-500/35 bg-red-500/10",
    muted: "text-muted-foreground border-border/50 bg-muted/20",
    info: "text-sky-400 border-sky-500/35 bg-sky-500/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium shrink-0",
        tones[tone]
      )}
    >
      {label}
    </span>
  );
}

function RosterSignals({ ops }: { ops?: OrgChartUserOps }) {
  if (!ops) return null;
  const flags = ops.flags;
  return (
    <div className="flex flex-wrap gap-1 justify-end max-w-[220px]">
      {ops.clockStatus === "in" && (
        <SignalPill label={ops.clockLabel ?? "In"} tone="ok" />
      )}
      {ops.clockStatus === "out" && (
        <SignalPill label={ops.clockLabel ?? "Out"} tone="muted" />
      )}
      {flags.includes("needs_work") && (
        <SignalPill label="Needs work" tone="warn" />
      )}
      {flags.includes("needs_help") && (
        <SignalPill label="Help" tone="danger" />
      )}
      {flags.includes("missing_wrap_up") && (
        <SignalPill label="No wrap-up" tone="info" />
      )}
    </div>
  );
}

export function PeopleScopeRoster({
  users,
  departments,
  teams,
  viewerId,
  opsMap,
  userDepartments,
}: {
  users: User[];
  departments: Department[];
  teams: Team[];
  viewerId: string;
  opsMap: Record<string, OrgChartUserOps>;
  userDepartments: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [teamId, setTeamId] = useState("all");
  const [position, setPosition] = useState<PositionFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [opsFilters, setOpsFilters] = useState<Set<OpsFilter>>(new Set());

  const scopedTeams = useMemo(() => {
    if (departmentId === "all") return teams;
    return teams.filter((t) => t.department_id === departmentId);
  }, [teams, departmentId]);

  const toggleOpsFilter = (id: OpsFilter) => {
    setOpsFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => u.id !== viewerId || users.length === 1)
      .filter((u) => {
        if (departmentId !== "all" && userDepartments[u.id] !== departmentId) {
          return false;
        }
        if (teamId !== "all" && u.team_id !== teamId) return false;
        if (position !== "all" && getOrganizationalPosition(u) !== position) {
          return false;
        }
        if (status === "active" && !u.is_active) return false;
        if (status === "inactive" && u.is_active) return false;
        if (q) {
          const hay = `${u.full_name} ${u.email}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (opsFilters.size > 0) {
          const flags = opsMap[u.id]?.flags ?? [];
          for (const filter of opsFilters) {
            if (!flags.includes(filter)) return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [
    users,
    viewerId,
    departmentId,
    teamId,
    position,
    status,
    search,
    userDepartments,
    opsFilters,
    opsMap,
  ]);

  if (users.length <= 1) return null;

  return (
    <section className="enterprise-panel overflow-hidden space-y-0 mb-6">
      <div className="px-4 py-3 border-b border-border/60">
        <h2 className="text-sm font-semibold">Your organization</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          People in your reporting scope — {roster.length} visible
        </p>
      </div>

      <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-b border-border/60">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
            className="pl-8"
          />
        </div>
        {departments.length > 0 && (
          <Select
            value={departmentId}
            onValueChange={(v) => {
              if (!v) return;
              setDepartmentId(v);
              if (v !== "all" && teamId !== "all") {
                const team = teams.find((t) => t.id === teamId);
                if (team && team.department_id !== v) setTeamId("all");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={teamId} onValueChange={(v) => v && setTeamId(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {scopedTeams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={position} onValueChange={(v) => v && setPosition(v as PositionFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All positions</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="team_lead">Team Lead</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="senior_manager">Senior Manager</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => v && setStatus(v as StatusFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-border/60">
        {OPS_FILTERS.map((filter) => {
          const active = opsFilters.has(filter.id);
          return (
            <Button
              key={filter.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-7 text-xs gap-1.5"
              onClick={() => toggleOpsFilter(filter.id)}
            >
              {filter.icon}
              {filter.label}
            </Button>
          );
        })}
        {opsFilters.size > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setOpsFilters(new Set())}
          >
            Clear signals
          </Button>
        )}
      </div>

      <ul className="divide-y divide-border/60 max-h-[480px] overflow-y-auto">
        {roster.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No people match your filters.
          </li>
        ) : (
          roster.map((u) => {
            const pos = getOrganizationalPosition(u);
            const team = teams.find((t) => t.id === u.team_id);
            const ops = opsMap[u.id];
            return (
              <li key={u.id}>
                <Link
                  href={peopleHref(u.id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium truncate">{u.full_name}</p>
                      {!u.is_active && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {team?.name ?? "No team"} · {u.email}
                    </p>
                  </div>
                  <RosterSignals ops={ops} />
                  <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:inline-flex">
                    {POSITION_DISPLAY_LABELS[pos]}
                  </Badge>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
