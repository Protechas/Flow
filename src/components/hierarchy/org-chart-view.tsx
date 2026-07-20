"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrgChartProfilePanel } from "@/components/hierarchy/org-chart-profile-panel";
import { OrgChartPositionCard } from "@/components/hierarchy/org-chart-position-card";
import { OrgChartUserCard } from "@/components/hierarchy/org-chart-user-card";
import {
  PositionAssignDialog,
  UnassignedUsersPanel,
} from "@/components/hierarchy/unassigned-users-panel";
import { PositionManageDialog } from "@/components/hierarchy/position-manage-dialog";
import { PositionSetupWizard } from "@/components/setup/position-setup-wizard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { alertCenterHref, wrapUpsHref } from "@/lib/navigation/deep-links";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getOrgChartNodeUserId } from "@/lib/positions/resolver";
import type { DepartmentOrgSection } from "@/lib/positions/grouped-chart";
import { POSITION_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { cn } from "@/lib/utils";
import type {
  Department,
  OrgChartNode,
  OrgChartProfileDetail,
  OrgChartViewerPermissions,
  OrgPosition,
  Team,
  User,
} from "@/types/flow";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Moon,
  Network,
  Plus,
  Search,
} from "lucide-react";

function nodeKey(node: OrgChartNode): string {
  return node.position?.id ?? node.user?.id ?? "unknown";
}

function findNodeByUserId(nodes: OrgChartNode[], userId: string): OrgChartNode | null {
  for (const node of nodes) {
    const uid = getOrgChartNodeUserId(node);
    if (uid === userId) return node;
    const found = findNodeByUserId(node.children, userId);
    if (found) return found;
  }
  return null;
}

/** A node's own team, or the nearest ancestor's team when the seat/user has
 * none set — otherwise reports under a lead with unset team ids silently
 * vanish from the team filter. */
function effectiveTeamId(node: OrgChartNode, inheritedTeamId: string | null): string | null {
  return node.position?.team_id ?? node.user?.team_id ?? inheritedTeamId;
}

function nodeMatchesFilters(
  node: OrgChartNode,
  search: string,
  departmentId: string,
  teamId: string,
  roleFilter: string,
  departments: { id: string; name: string }[],
  inheritedTeamId: string | null = null
): boolean {
  const q = search.trim().toLowerCase();
  const deptName = departmentId
    ? departments.find((d) => d.id === departmentId)?.name
    : null;

  const position = node.position;
  const user = node.user;
  const level = position?.position_level ?? (user ? getOrganizationalPosition(user) : null);
  const teamMatchId = effectiveTeamId(node, inheritedTeamId);

  const selfMatch =
    (!q ||
      (user &&
        (user.full_name.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q))) ||
      (position && position.title.toLowerCase().includes(q))) &&
    (!deptName || node.department_name === deptName) &&
    (!teamId || teamMatchId === teamId) &&
    (!roleFilter || level === roleFilter);

  return (
    selfMatch ||
    node.children.some((c) =>
      nodeMatchesFilters(
        c,
        search,
        departmentId,
        teamId,
        roleFilter,
        departments,
        teamMatchId
      )
    )
  );
}

function filterTree(
  node: OrgChartNode,
  search: string,
  departmentId: string,
  teamId: string,
  roleFilter: string,
  departments: { id: string; name: string }[],
  inheritedTeamId: string | null = null
): OrgChartNode | null {
  if (
    !nodeMatchesFilters(node, search, departmentId, teamId, roleFilter, departments, inheritedTeamId)
  ) {
    return null;
  }
  const childInheritedTeam = effectiveTeamId(node, inheritedTeamId);
  const children = node.children
    .map((c) =>
      filterTree(c, search, departmentId, teamId, roleFilter, departments, childInheritedTeam)
    )
    .filter((n): n is OrgChartNode => n !== null);
  return { ...node, children };
}

function filterGroupedSections(
  sections: DepartmentOrgSection[],
  search: string,
  departmentId: string,
  teamId: string,
  roleFilter: string,
  departments: { id: string; name: string }[]
): DepartmentOrgSection[] {
  return sections
    .filter((section) => !departmentId || section.department.id === departmentId)
    .map((section) => ({
      ...section,
      departmentRoots: section.departmentRoots
        .map((r) => filterTree(r, search, departmentId, teamId, roleFilter, departments))
        .filter((n): n is OrgChartNode => n !== null),
      teams: section.teams
        .filter((t) => !teamId || t.team.id === teamId)
        .map((t) => ({
          ...t,
          // Roots grouped under a team section belong to that team — seed the
          // inherited team so members with unset team ids stay visible.
          roots: t.roots
            .map((r) =>
              filterTree(r, search, departmentId, teamId, roleFilter, departments, t.team.id)
            )
            .filter((n): n is OrgChartNode => n !== null),
        }))
        .filter((t) => t.roots.length > 0 || (!search && !roleFilter)),
    }))
    .filter(
      (section) =>
        section.departmentRoots.length > 0 ||
        section.teams.some((t) => t.roots.length > 0) ||
        (!search && !roleFilter && (!departmentId || section.department.id === departmentId))
    );
}

function GroupedDepartmentChart({
  sections,
  expandAll,
  search,
  opsMap,
  selectedId,
  onSelectUser,
  onAssignPosition,
  onManagePosition,
  canAssignPositions,
  canManagePositions,
}: {
  sections: DepartmentOrgSection[];
  expandAll: boolean;
  search: string;
  opsMap: Record<string, import("@/types/flow").OrgChartUserOps>;
  selectedId: string | null;
  onSelectUser: (userId: string) => void;
  onAssignPosition: (position: OrgPosition) => void;
  onManagePosition: (position: OrgPosition) => void;
  canAssignPositions: boolean;
  canManagePositions: boolean;
}) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.department.id} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <Briefcase className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm">{section.department.name}</h3>
          </div>

          {section.departmentRoots.map((root) => (
            <OrgBranch
              key={`dept-root-${nodeKey(root)}`}
              node={root}
              depth={0}
              forceOpen={expandAll || !!search.trim()}
              opsMap={opsMap}
              selectedId={selectedId}
              onSelectUser={onSelectUser}
              onAssignPosition={onAssignPosition}
              onManagePosition={onManagePosition}
              canAssignPositions={canAssignPositions}
              canManagePositions={canManagePositions}
            />
          ))}

          {section.teams
            .filter((teamSection) => teamSection.roots.length > 0)
            .map((teamSection) => (
            <div key={teamSection.team.id} className="ml-2 sm:ml-4 space-y-2 flow-org-branch">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="text-border">├──</span>
                <span>{teamSection.team.name}</span>
              </div>
              <div className="ml-4 sm:ml-6 flow-org-branch">
                {teamSection.roots.map((root) => (
                  <OrgBranch
                    key={`team-${teamSection.team.id}-${nodeKey(root)}`}
                    node={root}
                    depth={1}
                    forceOpen={expandAll || !!search.trim()}
                    opsMap={opsMap}
                    selectedId={selectedId}
                    onSelectUser={onSelectUser}
                    onAssignPosition={onAssignPosition}
                    onManagePosition={onManagePosition}
                    canAssignPositions={canAssignPositions}
                    canManagePositions={canManagePositions}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function OrgBranch({
  node,
  depth,
  forceOpen,
  opsMap,
  selectedId,
  onSelectUser,
  onAssignPosition,
  onManagePosition,
  canAssignPositions,
  canManagePositions,
}: {
  node: OrgChartNode;
  depth: number;
  forceOpen: boolean;
  opsMap: Record<string, import("@/types/flow").OrgChartUserOps>;
  selectedId: string | null;
  onSelectUser: (userId: string) => void;
  onAssignPosition: (position: OrgPosition) => void;
  onManagePosition: (position: OrgPosition) => void;
  canAssignPositions: boolean;
  canManagePositions: boolean;
}) {
  const [open, setOpen] = useState(() => forceOpen || depth < 2);
  const hasChildren = node.children.length > 0;
  const userId = getOrgChartNodeUserId(node);
  const ops = userId ? opsMap[userId] : undefined;
  const isPosition = !!node.position;

  return (
    <div className={cn("flow-org-branch", depth > 0 && "flow-org-node-rail")}>
      <div className="flex items-start gap-2 py-1.5">
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
        <div className="flex-1 min-w-0 relative">
          {isPosition ? (
            <OrgChartPositionCard
              node={node}
              ops={ops}
              selected={!!userId && selectedId === userId}
              onSelect={() => userId && onSelectUser(userId)}
              onAssign={() => node.position && onAssignPosition(node.position)}
              onManage={() => node.position && onManagePosition(node.position)}
              canAssign={canAssignPositions && !userId}
              canManage={canManagePositions}
            />
          ) : node.user ? (
            <OrgChartUserCard
              node={node}
              ops={ops}
              selected={selectedId === node.user.id}
              onSelect={() => onSelectUser(node.user!.id)}
            />
          ) : null}
        </div>
      </div>

      {open &&
        hasChildren &&
        node.children.map((child) => (
          <OrgBranch
            key={nodeKey(child)}
            node={child}
            depth={depth + 1}
            forceOpen={forceOpen}
            opsMap={opsMap}
            selectedId={selectedId}
            onSelectUser={onSelectUser}
            onAssignPosition={onAssignPosition}
            onManagePosition={onManagePosition}
            canAssignPositions={canAssignPositions}
            canManagePositions={canManagePositions}
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
  positions = [],
  unassignedUsers = [],
  vacantPositionCount = 0,
  usePositionChart = false,
  useGroupedDisplay = false,
  groupedSections = [],
  opsMap,
  profiles,
  permissions,
  allUsers,
  viewerId,
  visibleUserIds,
  attention,
  initialUserId,
  canManageAccounts = false,
}: {
  roots: OrgChartNode[];
  departments?: Department[];
  teams?: Team[];
  positions?: OrgPosition[];
  unassignedUsers?: User[];
  vacantPositionCount?: number;
  usePositionChart?: boolean;
  useGroupedDisplay?: boolean;
  groupedSections?: DepartmentOrgSection[];
  opsMap: Record<string, import("@/types/flow").OrgChartUserOps>;
  profiles: Record<string, OrgChartProfileDetail>;
  permissions: OrgChartViewerPermissions;
  allUsers: User[];
  viewerId: string;
  visibleUserIds: string[];
  attention: { needsHelp: number; needsWork: number; missingWrapUp: number };
  initialUserId?: string | null;
  canManageAccounts?: boolean;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialUserId ?? null);
  const [expandAll, setExpandAll] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [assignPosition, setAssignPosition] = useState<OrgPosition | null>(null);
  const [managePosition, setManagePosition] = useState<OrgPosition | null>(null);

  useEffect(() => {
    if (initialUserId) setSelectedId(initialUserId);
  }, [initialUserId]);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  const visibleSet = useMemo(() => new Set(visibleUserIds), [visibleUserIds]);

  const filteredRoots = useMemo(() => {
    const hasFilter = search || departmentId || teamId || roleFilter;
    if (!hasFilter) return roots;
    return roots
      .map((r) => filterTree(r, search, departmentId, teamId, roleFilter, departments))
      .filter((n): n is OrgChartNode => n !== null);
  }, [roots, search, departmentId, teamId, roleFilter, departments]);

  const filteredGroupedSections = useMemo(() => {
    if (!useGroupedDisplay) return [];
    const hasFilter = search || departmentId || teamId || roleFilter;
    if (!hasFilter) return groupedSections;
    return filterGroupedSections(
      groupedSections,
      search,
      departmentId,
      teamId,
      roleFilter,
      departments
    );
  }, [
    useGroupedDisplay,
    groupedSections,
    search,
    departmentId,
    teamId,
    roleFilter,
    departments,
  ]);

  const hasChartContent = useGroupedDisplay
    ? filteredGroupedSections.length > 0
    : filteredRoots.length > 0;

  const selectedUser = selectedId ? allUsers.find((u) => u.id === selectedId) ?? null : null;
  const selectedProfile = selectedId ? profiles[selectedId] ?? null : null;
  const selectedNode = selectedId ? findNodeByUserId(roots, selectedId) : null;

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    function walk(n: OrgChartNode) {
      if (n.position) roles.add(n.position.position_level);
      else if (n.user) roles.add(getOrganizationalPosition(n.user));
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
              className="text-red-400 hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <HelpCircle className="inline h-4 w-4" />
              {attention.needsHelp} open escalations
              <InfoTooltip helpKey="openEscalations" />
            </Link>
          )}
          {attention.needsWork > 0 && (
            <Link
              href={alertCenterHref({ type: "workload" })}
              className="text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <AlertTriangle className="inline h-4 w-4" />
              {attention.needsWork} available capacity
              <InfoTooltip helpKey="availableCapacity" />
            </Link>
          )}
          {attention.missingWrapUp > 0 && (
            <Link
              href={wrapUpsHref({ status: "missing" })}
              className="text-violet-400 hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <Moon className="inline h-4 w-4" />
              {attention.missingWrapUp} outstanding daily reports
              <InfoTooltip helpKey="outstandingDailyReports" />
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Network className="h-4 w-4 text-primary" />
          {usePositionChart && (
            <span className="text-amber-400/90 flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              Position-based structure
              {vacantPositionCount > 0 && ` · ${vacantPositionCount} open seats`}
            </span>
          )}
          {HIERARCHY_LEGEND.map((item, i) => (
            <span key={item.position} className="flex items-center gap-1">
              {i > 0 && <span className="opacity-40">→</span>}
              <span>{item.label}</span>
            </span>
          ))}
        </div>
        {permissions.canManagePositions && (
          <Button type="button" size="sm" variant="outline" onClick={() => setBuilderOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add position
          </Button>
        )}
      </div>

      <div className="flow-org-chart-toolbar p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="flex h-9 w-full rounded-md border border-border/60 bg-background/80 pl-9 pr-3 text-sm"
              placeholder="Search by name, email, or position…"
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
                <EntitySelectValue
                  value={departmentId || "__all__"}
                  items={departments}
                  getLabel={(d) => d.name}
                  placeholder="All departments"
                  sentinels={[{ value: "__all__", label: "All departments" }]}
                />
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
                <EntitySelectValue
                  value={teamId || "__all__"}
                  items={teams}
                  getLabel={(t) => t.name}
                  placeholder="All teams"
                  sentinels={[{ value: "__all__", label: "All teams" }]}
                />
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
              <SelectValue placeholder="All roles">
                {roleFilter
                  ? POSITION_DISPLAY_LABELS[roleFilter as keyof typeof POSITION_DISPLAY_LABELS] ?? roleFilter
                  : "All roles"}
              </SelectValue>
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

        <div className="min-h-[360px] space-y-4">
          <div className="flow-org-chart-tree">
            {!hasChartContent ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {usePositionChart
                    ? "No positions match your filters."
                    : "No people match your filters in this reporting branch."}
                </p>
                {permissions.canManagePositions && !usePositionChart && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setBuilderOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create first position
                  </Button>
                )}
              </div>
            ) : useGroupedDisplay ? (
              <GroupedDepartmentChart
                sections={filteredGroupedSections}
                expandAll={expandAll}
                search={search}
                opsMap={opsMap}
                selectedId={selectedId}
                onSelectUser={setSelectedId}
                onAssignPosition={setAssignPosition}
                onManagePosition={setManagePosition}
                canAssignPositions={permissions.canAssignPositions}
                canManagePositions={permissions.canManagePositions}
              />
            ) : (
              filteredRoots.map((root) => (
                <OrgBranch
                  key={nodeKey(root)}
                  node={root}
                  depth={0}
                  forceOpen={expandAll || !!search.trim()}
                  opsMap={opsMap}
                  selectedId={selectedId}
                  onSelectUser={setSelectedId}
                  onAssignPosition={setAssignPosition}
                  onManagePosition={setManagePosition}
                  canAssignPositions={permissions.canAssignPositions}
                  canManagePositions={permissions.canManagePositions}
                />
              ))
            )}
          </div>

          {permissions.canManagePositions && unassignedUsers.length > 0 && (
            <div className="flow-org-branch border-t border-border/40 pt-4">
              <UnassignedUsersPanel
                users={unassignedUsers}
                positions={positions}
                departments={departments}
                teams={teams}
                allUsers={allUsers}
                canAssign={permissions.canAssignPositions}
                canManageAccounts={canManageAccounts}
                defaultExpanded={false}
                onAssigned={refresh}
              />
            </div>
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

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Create org position</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <PositionSetupWizard
              departments={departments}
              teams={teams}
              positions={positions}
              users={allUsers}
              onComplete={() => {
                setBuilderOpen(false);
                refresh();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!managePosition} onOpenChange={(open) => !open && setManagePosition(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage position</DialogTitle>
          </DialogHeader>
          {managePosition && (
            <PositionManageDialog
              position={managePosition}
              positions={positions}
              users={allUsers}
              departments={departments}
              teams={teams}
              onClose={() => setManagePosition(null)}
              onUpdated={refresh}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignPosition} onOpenChange={(open) => !open && setAssignPosition(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign user to position</DialogTitle>
          </DialogHeader>
          {assignPosition && (
            <PositionAssignDialog
              position={assignPosition}
              users={allUsers}
              onAssigned={() => {
                setAssignPosition(null);
                refresh();
              }}
              onCancel={() => setAssignPosition(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
