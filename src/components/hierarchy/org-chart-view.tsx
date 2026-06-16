"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { OrgChartProfilePanel } from "@/components/hierarchy/org-chart-profile-panel";
import { OrgChartUserCard } from "@/components/hierarchy/org-chart-user-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { alertCenterHref, operationsHref, wrapUpsHref } from "@/lib/navigation/deep-links";
import { POSITION_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { cn } from "@/lib/utils";
import type {
  OrgChartNode,
  OrgChartProfileDetail,
  OrgChartViewerPermissions,
  User,
  UserRole,
} from "@/types/flow";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Moon,
  Network,
  Search,
} from "lucide-react";

function findNode(nodes: OrgChartNode[], userId: string): OrgChartNode | null {
  for (const node of nodes) {
    if (node.user.id === userId) return node;
    const found = findNode(node.children, userId);
    if (found) return found;
  }
  return null;
}

function nodeMatchesFilters(
  node: OrgChartNode,
  search: string,
  departmentId: string,
  teamId: string,
  roleFilter: string,
  departments: { id: string; name: string }[]
): boolean {
  const q = search.trim().toLowerCase();
  const deptName = departmentId
    ? departments.find((d) => d.id === departmentId)?.name
    : null;

  const selfMatch =
    (!q ||
      node.user.full_name.toLowerCase().includes(q) ||
      node.user.email.toLowerCase().includes(q)) &&
    (!deptName || node.department_name === deptName) &&
    (!teamId || node.user.team_id === teamId) &&
    (!roleFilter || getOrganizationalPosition(node.user) === roleFilter);

  return (
    selfMatch ||
    node.children.some((c) =>
      nodeMatchesFilters(c, search, departmentId, teamId, roleFilter, departments)
    )
  );
}

function filterTree(
  node: OrgChartNode,
  search: string,
  departmentId: string,
  teamId: string,
  roleFilter: string,
  departments: { id: string; name: string }[]
): OrgChartNode | null {
  if (!nodeMatchesFilters(node, search, departmentId, teamId, roleFilter, departments)) {
    return null;
  }
  const children = node.children
    .map((c) => filterTree(c, search, departmentId, teamId, roleFilter, departments))
    .filter((n): n is OrgChartNode => n !== null);
  return { ...node, children };
}

function OrgBranch({
  node,
  depth,
  forceOpen,
  opsMap,
  selectedId,
  onSelect,
}: {
  node: OrgChartNode;
  depth: number;
  forceOpen: boolean;
  opsMap: Record<string, import("@/types/flow").OrgChartUserOps>;
  selectedId: string | null;
  onSelect: (userId: string) => void;
}) {
  const [open, setOpen] = useState(forceOpen || depth < 2);
  const hasChildren = node.children.length > 0;
  const ops = opsMap[node.user.id];

  return (
    <div className={cn(depth > 0 && "flow-org-node-rail")}>
      <div className="flex items-start gap-2 py-2">
        {hasChildren ? (
          <button
            type="button"
            className="mt-3 p-0.5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse branch" : "Expand branch"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5 shrink-0 mt-3" />
        )}
        <div className="flex-1 min-w-0">
          <OrgChartUserCard
            node={node}
            ops={ops}
            selected={selectedId === node.user.id}
            onSelect={() => onSelect(node.user.id)}
          />
        </div>
      </div>

      {open &&
        hasChildren &&
        node.children.map((child) => (
          <OrgBranch
            key={child.user.id}
            node={child}
            depth={depth + 1}
            forceOpen={forceOpen}
            opsMap={opsMap}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

const HIERARCHY_LEGEND: { position: import("@/types/flow").OrganizationalPosition; label: string }[] = [
  { position: "senior_manager", label: "Senior Manager" },
  { position: "manager", label: "Manager" },
  { position: "team_lead", label: "Team Lead" },
  { position: "employee", label: "Employee" },
];

export function OrgChartView({
  roots,
  departments = [],
  teams = [],
  opsMap,
  profiles,
  permissions,
  allUsers,
  viewerId,
  visibleUserIds,
  attention,
  initialUserId,
}: {
  roots: OrgChartNode[];
  departments?: { id: string; name: string }[];
  teams?: { id: string; name: string }[];
  opsMap: Record<string, import("@/types/flow").OrgChartUserOps>;
  profiles: Record<string, OrgChartProfileDetail>;
  permissions: OrgChartViewerPermissions;
  allUsers: User[];
  viewerId: string;
  visibleUserIds: string[];
  attention: { needsHelp: number; needsWork: number; missingWrapUp: number };
  initialUserId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialUserId ?? null);
  const [expandAll, setExpandAll] = useState(true);

  useEffect(() => {
    if (initialUserId) setSelectedId(initialUserId);
  }, [initialUserId]);

  const visibleSet = useMemo(() => new Set(visibleUserIds), [visibleUserIds]);

  const filteredRoots = useMemo(() => {
    const hasFilter = search || departmentId || teamId || roleFilter;
    if (!hasFilter) return roots;
    return roots
      .map((r) => filterTree(r, search, departmentId, teamId, roleFilter, departments))
      .filter((n): n is OrgChartNode => n !== null);
  }, [roots, search, departmentId, teamId, roleFilter, departments]);

  const selectedUser = selectedId ? allUsers.find((u) => u.id === selectedId) ?? null : null;
  const selectedProfile = selectedId ? profiles[selectedId] ?? null : null;
  const selectedNode = selectedId ? findNode(roots, selectedId) : null;

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    function walk(n: OrgChartNode) {
      roles.add(getOrganizationalPosition(n.user));
      n.children.forEach(walk);
    }
    roots.forEach(walk);
    return [...roles];
  }, [roots]);

  return (
    <div className="flow-org-chart space-y-4">
      {(attention.needsHelp > 0 || attention.needsWork > 0 || attention.missingWrapUp > 0) && (
        <div className="flow-alert-strip flex flex-wrap gap-4 text-sm">
          {attention.needsHelp > 0 && (
            <Link
              href={alertCenterHref({ type: "help" })}
              className="text-red-400 hover:underline cursor-pointer"
              title="Open help requests in Alert Center"
            >
              <HelpCircle className="inline h-4 w-4 mr-1" />
              {attention.needsHelp} need help
            </Link>
          )}
          {attention.needsWork > 0 && (
            <Link
              href={alertCenterHref({ type: "workload" })}
              className="text-amber-400 hover:underline cursor-pointer"
              title="Open workload alerts in Alert Center"
            >
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              {attention.needsWork} need work
            </Link>
          )}
          {attention.missingWrapUp > 0 && (
            <Link
              href={wrapUpsHref({ status: "missing" })}
              className="text-violet-400 hover:underline cursor-pointer"
              title="Review missing wrap-ups"
            >
              <Moon className="inline h-4 w-4 mr-1" />
              {attention.missingWrapUp} missing wrap-up
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Network className="h-4 w-4 text-primary" />
        {HIERARCHY_LEGEND.map((item, i) => (
          <span key={item.position} className="flex items-center gap-1">
            {i > 0 && <span className="opacity-40">→</span>}
            <span>{item.label}</span>
          </span>
        ))}
      </div>

      <div className="flow-org-chart-toolbar p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="flex h-9 w-full rounded-md border border-border/60 bg-background/80 pl-9 pr-3 text-sm"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {departments.length > 0 && (
            <Select
              value={departmentId || "__all__"}
              onValueChange={(v) => setDepartmentId(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-9 min-w-[160px] bg-card text-foreground text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {teams.length > 0 && (
            <Select
              value={teamId || "__all__"}
              onValueChange={(v) => setTeamId(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-9 min-w-[140px] bg-card text-foreground text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={roleFilter || "__all__"}
            onValueChange={(v) => setRoleFilter(!v || v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-9 min-w-[130px] bg-card text-foreground text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All roles</SelectItem>
              {roleOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {POSITION_DISPLAY_LABELS[r as keyof typeof POSITION_DISPLAY_LABELS] ?? r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpandAll((v) => !v)}
          >
            {expandAll ? "Collapse all" : "Expand all"}
          </Button>
        </div>

        <div className="min-h-[360px]">
          {filteredRoots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No people match your filters in this reporting branch.
            </p>
          ) : (
            filteredRoots.map((root) => (
              <OrgBranch
                key={`${root.user.id}-${expandAll}-${search}`}
                node={root}
                depth={0}
                forceOpen={expandAll || !!search.trim()}
                opsMap={opsMap}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))
          )}
        </div>
      </div>

      <OrgChartProfilePanel
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        profile={selectedProfile}
        user={selectedUser}
        node={selectedNode}
        permissions={permissions}
        allUsers={allUsers}
        viewerId={viewerId}
        visibleUserIds={visibleSet}
        onSelectUser={setSelectedId}
      />
    </div>
  );
}
