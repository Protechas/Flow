"use client";

import { hierarchyLevelForPosition, POSITION_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";
import type { OrgChartNode, OrgChartStatusFlag, OrgChartUserOps } from "@/types/flow";
import {
  AlertTriangle,
  Building2,
  Briefcase,
  Clock,
  Settings2,
  UserCircle2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  filled: "Filled",
  vacant: "Vacant",
  planned: "Planned",
  inactive: "Inactive",
};

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
    info: "text-emerald-400/90 border-emerald-500/30 bg-emerald-500/8",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
        tones[tone]
      )}
    >
      {label}
    </span>
  );
}

function clockTone(ops?: OrgChartUserOps): "ok" | "warn" | "muted" {
  if (ops?.clockStatus === "in") return "ok";
  return "muted";
}

function workloadTone(flags: OrgChartStatusFlag[]): "ok" | "warn" | "danger" {
  if (flags.includes("needs_work")) return "warn";
  return "ok";
}

function helpTone(flags: OrgChartStatusFlag[]): "ok" | "danger" {
  return flags.includes("needs_help") ? "danger" : "ok";
}

export function OrgChartPositionCard({
  node,
  ops,
  selected,
  onSelect,
  onAssign,
  onManage,
  canAssign,
  canManage,
}: {
  node: OrgChartNode;
  ops?: OrgChartUserOps;
  selected: boolean;
  onSelect: () => void;
  onAssign?: () => void;
  onManage?: () => void;
  canAssign?: boolean;
  canManage?: boolean;
}) {
  const position = node.position!;
  const user = node.user;
  const isVacant = !user;
  const tier = hierarchyLevelForPosition(position.position_level);
  const flags = ops?.flags ?? (isVacant ? [] : ["active"]);
  const needsAttention = flags.some((f) =>
    ["needs_help", "needs_work", "missing_wrap_up"].includes(f)
  );

  const clockLabel =
    ops?.clockStatus === "in"
      ? ops.clockLabel ?? "Clocked in"
      : ops?.clockStatus === "out"
        ? ops.clockLabel ?? "Clocked out"
        : "—";

  const statusTone =
    position.status === "vacant" || isVacant
      ? "warn"
      : position.status === "planned"
        ? "info"
        : "ok";

  const cardClass = cn(
    "flow-org-user-card w-full text-left p-3",
    isVacant && "border-dashed border-amber-500/30 bg-amber-500/5"
  );

  const inner = (
    <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isVacant && "bg-muted/40 text-muted-foreground",
            !isVacant && tier >= 4 && "bg-amber-500/15 text-amber-300",
            !isVacant && tier === 3 && "bg-emerald-500/15 text-emerald-300",
            !isVacant && tier === 2 && "bg-green-600/15 text-green-400",
            !isVacant && tier <= 1 && "bg-primary/15 text-primary"
          )}
        >
          {isVacant ? (
            <Briefcase className="h-4 w-4" />
          ) : (
            <>
              {user!.first_name?.[0]}
              {user!.last_name?.[0]}
            </>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            {user ? (
              <>
                <p className="font-semibold text-sm leading-tight truncate">{user.full_name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{position.title}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-sm leading-tight truncate">{position.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {POSITION_DISPLAY_LABELS[position.position_level]}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div className="flex items-center gap-1 text-muted-foreground min-w-0">
              <Building2 className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{node.department_name ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground min-w-0">
              <Users className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{node.team_name ?? "—"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <SignalPill
              label={STATUS_LABELS[position.status] ?? position.status}
              tone={statusTone}
            />
            {user && (
              <SignalPill
                label={flags.includes("inactive") ? "Inactive" : "Active"}
                tone={flags.includes("inactive") ? "muted" : "ok"}
              />
            )}
            {user && ops?.clockStatus !== "na" && (
              <SignalPill label={clockLabel} tone={clockTone(ops)} />
            )}
            {user && ops?.workloadStatus && (
              <span className="inline-flex items-center gap-0.5">
                <SignalPill label={ops.workloadStatus} tone={workloadTone(flags)} />
                <InfoTooltip
                  helpKey={
                    flags.includes("needs_work")
                      ? "workloadNeedsWork"
                      : ops.workloadStatus.includes("Healthy")
                        ? "workloadHealthy"
                        : undefined
                  }
                />
              </span>
            )}
            {user && ops?.helpFlagStatus ? (
              <span className="inline-flex items-center gap-0.5">
                <SignalPill label={ops.helpFlagStatus} tone={helpTone(flags)} />
                {flags.includes("needs_help") && <InfoTooltip helpKey="helpFlagActive" />}
              </span>
            ) : user ? (
              <SignalPill label="No help flags" tone="ok" />
            ) : null}
            {flags.includes("missing_wrap_up") && (
              <span className="inline-flex items-center gap-0.5">
                <SignalPill label={OPS_COPY.outstandingDailyReports} tone="warn" />
                <InfoTooltip helpKey="missingWrapUpFlag" />
              </span>
            )}
          </div>

          {user && ops?.activeTaskTitle && (
            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {ops.activeTaskTitle}
            </p>
          )}
          {needsAttention && (
            <p className="text-[10px] text-amber-400/90 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Needs management attention
            </p>
          )}

          {isVacant && canAssign && onAssign && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-1"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onAssign();
              }}
            >
              <UserCircle2 className="h-3.5 w-3.5 mr-1" />
              Assign user
            </Button>
          )}
          {canManage && onManage && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs mt-1"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onManage();
              }}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              Manage
            </Button>
          )}
        </div>
        {node.children.length > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {node.children.length}
          </span>
        )}
      </div>
  );

  if (isVacant) {
    return (
      <div
        data-tier={tier}
        data-vacant
        className={cardClass}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      data-tier={tier}
      data-selected={selected}
      data-attention={needsAttention}
      className={cn(cardClass, "cursor-pointer")}
    >
      {inner}
    </div>
  );
}
