"use client";

import { useMemo, useState, useTransition } from "react";
import { completePositionSetupAction } from "@/app/actions/positions";
import { HierarchyPreviewCard } from "@/components/setup/hierarchy-preview-card";
import { WizardStepper } from "@/components/work-creation/wizard-stepper";
import { Button } from "@/components/ui/button";
import { WizardDialogFooter, WizardDialogScroll } from "@/components/ui/wizard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORGANIZATIONAL_POSITIONS } from "@/lib/constants";
import {
  departmentLabel,
  teamLabel,
  teamsForDepartment,
} from "@/lib/setup/role-fields";
import { formatActionError } from "@/lib/errors/action-messages";
import type {
  Department,
  OrganizationalPosition,
  OrgPosition,
  Team,
  User,
} from "@/types/flow";

const STEPS = [
  "Position title",
  "Position level",
  "Department / team",
  "Reports to",
  "Assign user",
  "Review & create",
];

export function PositionSetupWizard({
  departments,
  teams,
  positions,
  users,
  onComplete,
}: {
  departments: Department[];
  teams: Team[];
  positions: OrgPosition[];
  users: User[];
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [positionLevel, setPositionLevel] = useState<OrganizationalPosition>("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [reportsToId, setReportsToId] = useState("");
  const [assignNow, setAssignNow] = useState<"yes" | "no">("no");
  const [assignUserId, setAssignUserId] = useState("");

  const deptTeams = useMemo(
    () => (departmentId ? teamsForDepartment(teams, departmentId) : teams),
    [teams, departmentId]
  );

  const parentOptions = useMemo(
    () =>
      positions.filter(
        (p) => p.status !== "inactive" && p.position_level !== "employee"
      ),
    [positions]
  );

  const unassignedUsers = useMemo(
    () => users.filter((u) => u.is_active && !u.assigned_position_id),
    [users]
  );

  function canAdvance(): boolean {
    if (step === 0) return title.trim().length > 0;
    if (step === 1) return !!positionLevel;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) {
      if (assignNow === "yes") return !!assignUserId;
      return true;
    }
    return true;
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await completePositionSetupAction({
          title: title.trim(),
          position_level: positionLevel,
          department_id: departmentId || null,
          team_id: teamId || null,
          reports_to_position_id: reportsToId || null,
          assign_user_id: assignNow === "yes" ? assignUserId : null,
          status: assignNow === "yes" ? "filled" : "vacant",
        });
        onComplete?.();
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  return (
    <div className="space-y-4">
      <WizardStepper steps={STEPS} current={step} />
      <WizardDialogScroll>
        {step === 0 && (
          <div className="space-y-3">
            <Label htmlFor="pos-title">Position title</Label>
            <Input
              id="pos-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Manager — Audit Team"
            />
            <p className="text-xs text-muted-foreground">
              Seats can exist before anyone is hired. Title describes the role, not the person.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Label>Position level</Label>
            <div className="grid gap-2">
              {ORGANIZATIONAL_POSITIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPositionLevel(opt.value)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    positionLevel === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:bg-muted/30"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={departmentId || "__none__"}
                onValueChange={(v) => {
                  setDepartmentId(!v || v === "__none__" ? "" : v);
                  setTeamId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select
                value={teamId || "__none__"}
                onValueChange={(v) => setTeamId(!v || v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {deptTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Reports to position</Label>
            <Select
              value={reportsToId || "__none__"}
              onValueChange={(v) => setReportsToId(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Top-level (no parent)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Top-level position</SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Label>Assign a user now?</Label>
            <div className="flex gap-2">
              {(["no", "yes"] as const).map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant={assignNow === opt ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssignNow(opt)}
                >
                  {opt === "yes" ? "Yes" : "No — leave vacant"}
                </Button>
              ))}
            </div>
            {assignNow === "yes" && (
              <Select
                value={assignUserId || "__pick__"}
                onValueChange={(v) => setAssignUserId(!v || v === "__pick__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__pick__">Select user…</SelectItem>
                  {unassignedUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <HierarchyPreviewCard
              preview={{
                name: title,
                lines: [
                  { label: "Level", value: ORGANIZATIONAL_POSITIONS.find((o) => o.value === positionLevel)?.label ?? positionLevel },
                  ...(departmentId
                    ? [{ label: "Department", value: departmentLabel(departments, departmentId) }]
                    : []),
                  ...(teamId ? [{ label: "Team", value: teamLabel(teams, teamId) }] : []),
                  {
                    label: "Reports to",
                    value: reportsToId
                      ? positions.find((p) => p.id === reportsToId)?.title ?? "—"
                      : "Top level",
                  },
                  { label: "Status", value: assignNow === "yes" ? "Filled" : "Vacant" },
                ],
              }}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </WizardDialogScroll>

      <WizardDialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || pending}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            disabled={!canAdvance() || pending}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? "Creating…" : "Create position"}
          </Button>
        )}
      </WizardDialogFooter>
    </div>
  );
}
