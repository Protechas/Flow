"use client";

import { useMemo, useState } from "react";
import { OrgChartProfilePanel } from "@/components/hierarchy/org-chart-profile-panel";
import { OrgChartUserCard, ROLE_LABELS } from "@/components/hierarchy/org-chart-user-card";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/constants";
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
    (!roleFilter || node.user.role === roleFilter);

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

const HIERARCHY_LEGEND: { role: UserRole; label: string }[] = [
  { role: "senior_manager", label: "Senior Manager" },
  { role: "manager", label: "Manager" },
  { role: "teamlead", label: "Team Lead" },
  { role: "employee", label: "Employee" },
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
}) {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(true);

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
      roles.add(n.user.role);
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
            <span className="text-red-400">
              <HelpCircle className="inline h-4 w-4 mr-1" />
              {attention.needsHelp} need help
            </span>
          )}
          {attention.needsWork > 0 && (
            <span className="text-amber-400">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              {attention.needsWork} need work
            </span>
          )}
          {attention.missingWrapUp > 0 && (
            <span className="text-violet-400">
              <Moon className="inline h-4 w-4 mr-1" />
              {attention.missingWrapUp} missing wrap-up
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Network className="h-4 w-4 text-primary" />
        {HIERARCHY_LEGEND.map((item, i) => (
          <span key={item.role} className="flex items-center gap-1">
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
            <select
              className="h-9 rounded-md border border-border/60 bg-background/80 px-3 text-sm"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {teams.length > 0 && (
            <select
              className="h-9 rounded-md border border-border/60 bg-background/80 px-3 text-sm"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="h-9 rounded-md border border-border/60 bg-background/80 px-3 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r as UserRole] ?? roleLabel(r)}
              </option>
            ))}
          </select>
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
