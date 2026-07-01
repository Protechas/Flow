"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateUserDetailsAction } from "@/app/actions/users";
import { OrgChartUserCard } from "@/components/hierarchy/org-chart-user-card";
import { getOrganizationalPosition } from "@/lib/auth/access-level";
import { POSITION_DISPLAY_LABELS, ROLE_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterValidSupervisors } from "@/lib/setup/role-fields";
import { operationsHref } from "@/lib/navigation/deep-links";
import { cn } from "@/lib/utils";
import type {
  OrgChartNode,
  OrgChartProfileDetail,
  OrgChartViewerPermissions,
  User,
} from "@/types/flow";
import {
  ArrowDown,
  Briefcase,
  ExternalLink,
  HelpCircle,
  Moon,
  Target,
  User as UserIcon,
} from "lucide-react";

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "justify-start h-9 w-full no-underline"
      )}
    >
      <Icon className="h-4 w-4 mr-2 shrink-0" />
      {label}
      <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
    </Link>
  );
}

function canActOnUser(userId: string, viewerId: string, visibleUserIds: Set<string>) {
  return userId === viewerId || visibleUserIds.has(userId);
}

export function OrgChartProfilePanel({
  open,
  onOpenChange,
  profile,
  user,
  node,
  permissions,
  allUsers,
  viewerId,
  visibleUserIds,
  onSelectUser,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: OrgChartProfileDetail | null;
  user: User | null;
  node: OrgChartNode | null;
  permissions: OrgChartViewerPermissions;
  allUsers: User[];
  viewerId: string;
  visibleUserIds: Set<string>;
  onSelectUser: (userId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [supervisorId, setSupervisorId] = useState("");
  const [editSupervisor, setEditSupervisor] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flow-org-profile-panel w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Profile unavailable</SheetTitle>
            <SheetDescription>This person could not be loaded.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const inScope = canActOnUser(user.id, viewerId, visibleUserIds);
  const validSupervisors = filterValidSupervisors(user.role, allUsers);
  const isEmployee = user.role === "employee";

  function saveSupervisor() {
    if (!supervisorId || !user) return;
    const userId = user.id;
    setMessage(null);
    startTransition(async () => {
      try {
        await updateUserDetailsAction(userId, { manager_id: supervisorId });
        setMessage("Reporting chain updated");
        setEditSupervisor(false);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  const showAssign = permissions.canAssignTask && isEmployee && inScope;
  const showProfile = permissions.canViewProfile && inScope;
  const showWorkload = permissions.canViewWorkload && isEmployee && inScope;
  const showWrapUps = permissions.canViewWrapUps && isEmployee && inScope;
  const showHelp =
    permissions.canViewHelpFlags && inScope && (profile?.helpFlags.length ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flow-org-profile-panel w-full sm:max-w-lg overflow-y-auto p-0"
      >
        <div className="p-4 border-b border-border/40 space-y-3">
          <SheetHeader className="p-0">
            <SheetTitle>{user.full_name}</SheetTitle>
            <SheetDescription>
              {POSITION_DISPLAY_LABELS[getOrganizationalPosition(user)]}
              {profile ? ` · ${profile.departmentName}` : ""}
            </SheetDescription>
          </SheetHeader>
          {node && (
            <div className="pointer-events-none">
              <OrgChartUserCard node={node} ops={profile?.ops} selected onSelect={() => {}} />
            </div>
          )}
        </div>

        {!profile ? (
          <div className="p-4 text-sm text-muted-foreground">Loading profile details…</div>
        ) : (
          <div className="p-4 space-y-5">
            <PanelSection
              title={
                profile.activeTasks.length > 0
                  ? `Active tasks (${profile.activeTasks.length})`
                  : "Active tasks"
              }
            >
              {profile.activeTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active tasks assigned.</p>
              ) : (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {profile.activeTasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/work/${task.id}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-sm hover:border-primary/30 hover:bg-primary/5"
                      >
                        <span className="font-medium truncate">{task.title}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                          {task.status.replace(/_/g, " ")}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>

            <PanelSection title="Current workload">
              <div className="enterprise-panel p-3 text-sm">
                <p>{profile.workloadSummary ?? profile.ops.workloadStatus ?? "—"}</p>
                {profile.ops.remainingHours != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile.ops.remainingHours}h remaining on active queue
                  </p>
                )}
              </div>
            </PanelSection>

            {profile.ops.flowScore != null && (
              <PanelSection title="Productivity snapshot">
                <div className="enterprise-panel p-3">
                  <p className="text-2xl font-semibold tabular-nums">{profile.ops.flowScore}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Flow score · {profile.ops.engagementLevel ?? "—"} engagement
                    {profile.ops.tasksCompleted != null &&
                      ` · ${profile.ops.tasksCompleted} tasks completed`}
                  </p>
                </div>
              </PanelSection>
            )}

            <PanelSection title="Help flags">
              {profile.helpFlags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open help flags.</p>
              ) : (
                <div className="space-y-2">
                  {profile.helpFlags.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{h.reason}</p>
                      <p className="text-xs text-muted-foreground capitalize">{h.status}</p>
                    </div>
                  ))}
                </div>
              )}
            </PanelSection>

            <PanelSection title="Wrap-up status">
              <div className="enterprise-panel p-3 text-sm capitalize">
                {profile.ops.wrapUpStatus ?? "Not applicable"}
              </div>
            </PanelSection>

            <PanelSection title="Reporting chain">
              <div className="space-y-2">
                {[...profile.reportingChain].reverse().map((entry) => (
                  <div key={entry.user_id} className="flow-org-chain-step px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-left hover:text-primary"
                        onClick={() => onSelectUser(entry.user_id)}
                      >
                        {entry.full_name}
                      </button>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {ROLE_DISPLAY_LABELS[entry.role] ?? entry.role}
                      </Badge>
                    </div>
                  </div>
                ))}
                {profile.reportingChain.length > 0 && (
                  <div className="flex justify-center text-muted-foreground">
                    <ArrowDown className="h-3 w-3" />
                  </div>
                )}
                <div className="flow-org-chain-step px-3 py-2 border-primary/30 bg-primary/5">
                  <p className="text-sm font-semibold">{user.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">Selected</p>
                </div>
                {profile.directReports.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Direct reports
                    </p>
                    {profile.directReports.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onSelectUser(r.id)}
                        className="w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted/40"
                      >
                        {r.name}{" "}
                        <span className="text-muted-foreground text-xs">
                          ({ROLE_DISPLAY_LABELS[r.role] ?? r.role})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {permissions.canEditReportingChain && validSupervisors.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                  {editSupervisor ? (
                    <>
                      <Select
                        value={supervisorId || profile.reportsTo?.id || ""}
                        onValueChange={(v) => v && setSupervisorId(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select supervisor" />
                        </SelectTrigger>
                        <SelectContent>
                          {validSupervisors.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveSupervisor} disabled={pending}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditSupervisor(false)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditSupervisor(true)}>
                      Edit supervisor
                    </Button>
                  )}
                  {message && <p className="text-xs text-emerald-400">{message}</p>}
                </div>
              )}
            </PanelSection>

            {(showAssign || showProfile || showWorkload || showWrapUps || showHelp) && (
              <PanelSection title="Actions">
                <div className="grid gap-2">
                  {showAssign && (
                    <ActionLink
                      href={operationsHref({ search: user.full_name })}
                      icon={Briefcase}
                      label="Assign work"
                    />
                  )}
                  {showProfile && (
                    <ActionLink
                      href={`/people/${user.id}`}
                      icon={UserIcon}
                      label="View profile"
                    />
                  )}
                  {showWorkload && (
                    <ActionLink
                      href={`/people/${user.id}`}
                      icon={Target}
                      label="View workload"
                    />
                  )}
                  {showWrapUps && (
                    <ActionLink href="/wrap-ups" icon={Moon} label="View wrap-ups" />
                  )}
                  {showHelp && (
                    <ActionLink
                      href="/alert-center"
                      icon={HelpCircle}
                      label="View help flags"
                    />
                  )}
                </div>
              </PanelSection>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
