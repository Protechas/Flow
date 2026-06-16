"use client";

import { hierarchyLevelForRole, ROLE_DISPLAY_LABELS } from "@/lib/hierarchy/role-utils";
import { cn } from "@/lib/utils";
import type { OrgChartNode, OrgChartStatusFlag, OrgChartUserOps, UserRole } from "@/types/flow";
import {
  AlertTriangle,
  Building2,
  Clock,
  HelpCircle,
  Users,
} from "lucide-react";

const ROLE_LABELS = ROLE_DISPLAY_LABELS;

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
  if (ops?.clockStatus === "out") return "muted";
  return "muted";
}

function workloadTone(flags: OrgChartStatusFlag[]): "ok" | "warn" | "danger" {
  if (flags.includes("needs_work")) return "warn";
  return "ok";
}

function helpTone(flags: OrgChartStatusFlag[]): "ok" | "danger" {
  return flags.includes("needs_help") ? "danger" : "ok";
}

export function OrgChartUserCard({
  node,
  ops,
  selected,
  onSelect,
}: {
  node: OrgChartNode;
  ops?: OrgChartUserOps;
  selected: boolean;
  onSelect: () => void;
}) {
  const tier = hierarchyLevelForRole(node.user.role);
  const flags = ops?.flags ?? ["active"];
  const needsAttention = flags.some((f) =>
    ["needs_help", "needs_work", "missing_wrap_up"].includes(f)
  );

  const clockLabel =
    ops?.clockStatus === "in"
      ? ops.clockLabel ?? "Clocked in"
      : ops?.clockStatus === "out"
        ? ops.clockLabel ?? "Clocked out"
        : "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      data-tier={tier}
      data-selected={selected}
      data-attention={needsAttention}
      className="flow-org-user-card w-full text-left p-3"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            tier >= 4 && "bg-amber-500/15 text-amber-300",
            tier === 3 && "bg-blue-500/15 text-blue-300",
            tier === 2 && "bg-violet-500/15 text-violet-300",
            tier <= 1 && "bg-primary/15 text-primary"
          )}
        >
          {node.user.first_name?.[0]}
          {node.user.last_name?.[0]}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-sm leading-tight truncate">{node.user.full_name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {ROLE_LABELS[node.user.role] ?? node.user.role}
            </p>
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
              label={flags.includes("inactive") ? "Inactive" : "Active"}
              tone={flags.includes("inactive") ? "muted" : "ok"}
            />
            {ops?.clockStatus !== "na" && (
              <SignalPill label={clockLabel} tone={clockTone(ops)} />
            )}
            {ops?.workloadStatus && (
              <SignalPill
                label={ops.workloadStatus}
                tone={workloadTone(flags)}
              />
            )}
            {ops?.helpFlagStatus ? (
              <SignalPill label={ops.helpFlagStatus} tone={helpTone(flags)} />
            ) : (
              <SignalPill label="No help flags" tone="ok" />
            )}
            {flags.includes("missing_wrap_up") && (
              <SignalPill label="Missing wrap-up" tone="warn" />
            )}
          </div>

          {ops?.activeTaskTitle && (
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
        </div>
        {node.children.length > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {node.children.length}
          </span>
        )}
      </div>
    </button>
  );
}

export { ROLE_LABELS };
