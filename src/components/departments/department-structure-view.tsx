"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DepartmentManageDialog,
  TeamAssignMemberDialog,
} from "@/components/departments/department-manage-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DepartmentStructureNode, TeamStructureNode } from "@/lib/departments/structure";
import type { Department, Team, User } from "@/types/flow";
import { Building2, ChevronDown, ChevronRight, Settings2, UserCircle2, Users } from "lucide-react";

function VacantPill() {
  return (
    <span className="inline-flex items-center rounded-sm border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
      Vacant
    </span>
  );
}

function TeamRow({
  node,
  departmentId,
  canManage,
  onAssign,
}: {
  node: TeamStructureNode;
  departmentId: string;
  canManage: boolean;
  onAssign: (team: Team) => void;
}) {
  return (
    <div className="ml-6 border-l border-border/40 pl-4 py-2 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{node.team.name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {node.vacantManager ? (
              <VacantPill />
            ) : (
              <span className="text-[10px] text-muted-foreground">Mgr: {node.managerName}</span>
            )}
            {node.vacantLead ? (
              <VacantPill />
            ) : (
              <span className="text-[10px] text-muted-foreground">Lead: {node.leadName}</span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Users className="h-3 w-3" />
              {node.memberCount} members
            </span>
          </div>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            onClick={() => onAssign(node.team)}
          >
            <UserCircle2 className="h-3.5 w-3.5 mr-1" />
            Assign
          </Button>
        )}
      </div>
    </div>
  );
}

function DepartmentBranch({
  node,
  canManage,
  onManage,
  onAssignTeam,
}: {
  node: DepartmentStructureNode;
  canManage: boolean;
  onManage: (dept: Department) => void;
  onAssignTeam: (team: Team, departmentId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          className="mt-1 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <p className="font-semibold text-sm">{node.department.name}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {node.vacantLead ? (
                  <VacantPill />
                ) : (
                  <span className="text-[10px] text-muted-foreground">Lead: {node.leadName}</span>
                )}
                <span className="text-[10px] text-muted-foreground">{node.teams.length} teams</span>
                <span className="text-[10px] text-muted-foreground">{node.memberCount} members</span>
              </div>
            </div>
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs shrink-0"
                onClick={() => onManage(node.department)}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                Manage
              </Button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="pb-2">
          {node.teams.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-2 ml-6">No teams yet — add teams in Manage.</p>
          ) : (
            node.teams.map((team) => (
              <TeamRow
                key={team.team.id}
                node={team}
                departmentId={node.department.id}
                canManage={canManage}
                onAssign={(t) => onAssignTeam(t, node.department.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function DepartmentStructureView({
  structure,
  teams,
  users,
  vacantSlotCount,
  canManage,
}: {
  structure: DepartmentStructureNode[];
  teams: Team[];
  users: User[];
  vacantSlotCount: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [manageDept, setManageDept] = useState<Department | null>(null);
  const [assignTeam, setAssignTeam] = useState<{ team: Team; departmentId: string } | null>(null);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Department structure
          {vacantSlotCount > 0 && (
            <span className="text-amber-400/90 ml-2">· {vacantSlotCount} open slots</span>
          )}
        </p>
      </div>

      {structure.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No departments yet.</p>
          <p className="text-xs text-muted-foreground">Use the builder above to create your first department structure.</p>
        </div>
      ) : (
        <div className={cn("space-y-3", structure.length > 0 && "min-h-[200px]")}>
          {structure.map((node) => (
            <DepartmentBranch
              key={node.department.id}
              node={node}
              canManage={canManage}
              onManage={setManageDept}
              onAssignTeam={(team, departmentId) => setAssignTeam({ team, departmentId })}
            />
          ))}
        </div>
      )}

      <Dialog open={!!manageDept} onOpenChange={(open) => !open && setManageDept(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage department</DialogTitle>
          </DialogHeader>
          {manageDept && (
            <DepartmentManageDialog
              department={manageDept}
              teams={teams}
              users={users}
              onClose={() => setManageDept(null)}
              onUpdated={refresh}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignTeam} onOpenChange={(open) => !open && setAssignTeam(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign team member</DialogTitle>
          </DialogHeader>
          {assignTeam && (
            <TeamAssignMemberDialog
              team={assignTeam.team}
              departmentId={assignTeam.departmentId}
              users={users}
              onAssigned={() => {
                setAssignTeam(null);
                refresh();
              }}
              onCancel={() => setAssignTeam(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
