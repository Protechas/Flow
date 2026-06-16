"use client";

import { useMemo, useState, useTransition } from "react";
import { completeDepartmentSetupAction } from "@/app/actions/setup";
import { HierarchyPreviewCard } from "@/components/setup/hierarchy-preview-card";
import { WizardStepper } from "@/components/work-creation/wizard-stepper";
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
import { Textarea } from "@/components/ui/textarea";
import { buildDepartmentSetupPreview } from "@/lib/setup/hierarchy-preview";
import { userLabel } from "@/lib/setup/role-fields";
import type { User } from "@/types/flow";
import { Building2, Plus, Trash2 } from "lucide-react";

const STEPS = ["Department info", "Leadership", "Teams", "Assign people", "Review"];

interface TeamDraft {
  id: string;
  name: string;
  team_lead_id: string;
  manager_id: string;
  employee_ids: string[];
}

function newTeamDraft(): TeamDraft {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    team_lead_id: "",
    manager_id: "",
    employee_ids: [],
  };
}

export function DepartmentSetupWizard({
  users,
  onComplete,
}: {
  users: User[];
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [seniorManagerId, setSeniorManagerId] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<TeamDraft[]>([newTeamDraft()]);

  const seniorManagers = users.filter(
    (u) => u.is_active && (u.role === "senior_manager" || u.role === "manager" || u.role === "admin")
  );
  const managerPool = users.filter(
    (u) => u.is_active && ["manager", "teamlead", "employee"].includes(u.role)
  );
  const teamLeadPool = users.filter((u) => u.is_active);
  const employeePool = users.filter((u) => u.is_active && u.role === "employee");

  const preview = useMemo(
    () =>
      buildDepartmentSetupPreview({
        name: name || "New department",
        purpose,
        senior_manager_name: userLabel(users, seniorManagerId),
        manager_names: managerIds.map((id) => userLabel(users, id)),
        teams: teams
          .filter((t) => t.name.trim())
          .map((t) => ({
            name: t.name,
            lead_name: userLabel(users, t.team_lead_id),
            employee_count: t.employee_ids.length,
          })),
      }),
    [name, purpose, seniorManagerId, managerIds, teams, users]
  );

  function toggleManager(id: string) {
    setManagerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleEmployee(teamId: string, employeeId: string) {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        const has = t.employee_ids.includes(employeeId);
        return {
          ...t,
          employee_ids: has
            ? t.employee_ids.filter((id) => id !== employeeId)
            : [...t.employee_ids, employeeId],
        };
      })
    );
  }

  function canAdvance(): boolean {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return Boolean(seniorManagerId) && managerIds.length > 0;
    if (step === 2) {
      return teams.every((t) => t.name.trim() && t.team_lead_id);
    }
    return true;
  }

  function submit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await completeDepartmentSetupAction({
          name: name.trim(),
          purpose: purpose.trim() || undefined,
          senior_manager_id: seniorManagerId,
          manager_ids: managerIds,
          teams: teams.map((t) => ({
            name: t.name.trim(),
            team_lead_id: t.team_lead_id,
            manager_id: t.manager_id || undefined,
            employee_ids: t.employee_ids,
          })),
        });
        setSuccess(`Department "${name}" created with teams and reporting chain.`);
        setName("");
        setPurpose("");
        setSeniorManagerId("");
        setManagerIds([]);
        setTeams([newTeamDraft()]);
        setStep(0);
        onComplete?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Setup failed");
      }
    });
  }

  return (
    <div className="enterprise-panel p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Guided department setup</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Name your department, assign leadership, and place people on teams — Flow wires dashboards, alerts, and permissions automatically.
          </p>
        </div>
      </div>

      <WizardStepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-3 max-w-xl">
          <div className="space-y-2">
            <Label>Department name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SI Library"
            />
          </div>
          <div className="space-y-2">
            <Label>Department purpose</Label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              placeholder="What does this department do?"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Senior manager</Label>
            <Select value={seniorManagerId} onValueChange={(v) => v && setSeniorManagerId(v)}>
              <SelectTrigger><SelectValue placeholder="Who leads this department branch?" /></SelectTrigger>
              <SelectContent>
                {seniorManagers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Managers under senior manager</Label>
            <div className="rounded-lg border border-border/50 divide-y divide-border/40 max-h-48 overflow-y-auto">
              {managerPool.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/20"
                >
                  <input
                    type="checkbox"
                    checked={managerIds.includes(u.id)}
                    onChange={() => toggleManager(u.id)}
                  />
                  <span>{u.full_name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{u.role}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Select one or more managers for this department.</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {teams.map((team, index) => (
            <div key={team.id} className="rounded-lg border border-border/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Team {index + 1}</p>
                {teams.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTeams((prev) => prev.filter((t) => t.id !== team.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Team name"
                  value={team.name}
                  onChange={(e) =>
                    setTeams((prev) =>
                      prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t))
                    )
                  }
                />
                <Select
                  value={team.team_lead_id || "__none__"}
                  onValueChange={(v) =>
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === team.id
                          ? { ...t, team_lead_id: !v || v === "__none__" ? "" : v }
                          : t
                      )
                    )
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Team lead" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select team lead…</SelectItem>
                    {teamLeadPool.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={team.manager_id || "__none__"}
                  onValueChange={(v) =>
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === team.id
                          ? { ...t, manager_id: !v || v === "__none__" ? "" : v }
                          : t
                      )
                    )
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Manager (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Auto from leadership</SelectItem>
                    {managerIds.map((id) => (
                      <SelectItem key={id} value={id}>{userLabel(users, id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setTeams((p) => [...p, newTeamDraft()])}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add team
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {teams.map((team) => (
            <div key={team.id} className="rounded-lg border border-border/50 p-3">
              <p className="text-sm font-medium mb-2">
                {team.name || "Unnamed team"} — assign employees
              </p>
              <div className="grid gap-1 sm:grid-cols-2 max-h-40 overflow-y-auto">
                {employeePool.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted/20 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={team.employee_ids.includes(emp.id)}
                      onChange={() => toggleEmployee(team.id, emp.id)}
                    />
                    {emp.full_name}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Employees will report to their team lead. You can skip this and assign people later.
          </p>
        </div>
      )}

      {step === 4 && <HierarchyPreviewCard preview={preview} />}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance() || pending}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending || !canAdvance()}>
            {pending ? "Creating…" : "Create department"}
          </Button>
        )}
      </div>

      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
