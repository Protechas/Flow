"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeDepartmentStructureAction } from "@/app/actions/departments";
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
import { formatActionError } from "@/lib/errors/action-messages";
import type { User } from "@/types/flow";
import { Building2, Plus, Trash2 } from "lucide-react";

const STEPS = ["Department", "Teams", "Leadership (optional)", "Review"];

interface TeamDraft {
  id: string;
  name: string;
  manager_id: string;
  team_lead_id: string;
}

function newTeamDraft(): TeamDraft {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    manager_id: "",
    team_lead_id: "",
  };
}

export function DepartmentStructureWizard({
  users,
  onComplete,
}: {
  users: User[];
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [leadUserId, setLeadUserId] = useState("");
  const [teams, setTeams] = useState<TeamDraft[]>([newTeamDraft()]);

  const managerPool = users.filter(
    (u) => u.is_active && ["senior_manager", "manager", "teamlead", "admin", "super_admin"].includes(u.role)
  );

  function canAdvance(): boolean {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return teams.some((t) => t.name.trim());
    return true;
  }

  function submit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await completeDepartmentStructureAction({
          name: name.trim(),
          purpose: purpose.trim() || undefined,
          lead_user_id: leadUserId || null,
          teams: teams
            .filter((t) => t.name.trim())
            .map((t) => ({
              name: t.name.trim(),
              manager_id: t.manager_id || null,
              team_lead_user_id: t.team_lead_id || null,
            })),
        });
        setSuccess(`Department "${name}" created. Assign people when ready.`);
        setName("");
        setPurpose("");
        setLeadUserId("");
        setTeams([newTeamDraft()]);
        setStep(0);
        onComplete?.();
        router.refresh();
      } catch (e) {
        setError(formatActionError(e));
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
          <h3 className="font-semibold">Build department structure</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create departments and teams first — assign leaders and members later.
          </p>
        </div>
      </div>

      <WizardStepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-3 max-w-xl">
          <div className="space-y-2">
            <Label>Department name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SI Library" />
          </div>
          <div className="space-y-2">
            <Label>Purpose (optional)</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} />
          </div>
        </div>
      )}

      {step === 1 && (
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
              <Input
                placeholder="Team name"
                value={team.name}
                onChange={(e) =>
                  setTeams((prev) =>
                    prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t))
                  )
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Manager and team lead can be assigned in the next step or later.
              </p>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setTeams((p) => [...p, newTeamDraft()])}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add team
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Department lead (optional)</Label>
            <Select
              value={leadUserId || "__none__"}
              onValueChange={(v) => setLeadUserId(!v || v === "__none__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Vacant — assign later" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Vacant — assign later</SelectItem>
                {managerPool.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {teams.filter((t) => t.name.trim()).map((team) => (
            <div key={team.id} className="rounded-lg border border-border/50 p-3 space-y-2">
              <p className="text-sm font-medium">{team.name}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={team.manager_id || "__none__"}
                  onValueChange={(v) =>
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === team.id ? { ...t, manager_id: !v || v === "__none__" ? "" : v } : t
                      )
                    )
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Manager (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Vacant</SelectItem>
                    {managerPool.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={team.team_lead_id || "__none__"}
                  onValueChange={(v) =>
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === team.id ? { ...t, team_lead_id: !v || v === "__none__" ? "" : v } : t
                      )
                    )
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Team lead (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Vacant</SelectItem>
                    {users.filter((u) => u.is_active).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border border-border/50 p-4 space-y-2 text-sm">
          <p><span className="text-muted-foreground">Department:</span> {name}</p>
          <p><span className="text-muted-foreground">Lead:</span> {leadUserId ? managerPool.find((u) => u.id === leadUserId)?.full_name : "Vacant"}</p>
          <p className="text-muted-foreground">Teams:</p>
          <ul className="list-disc pl-5 space-y-1">
            {teams.filter((t) => t.name.trim()).map((t) => (
              <li key={t.id}>
                {t.name}
                {!t.manager_id && !t.team_lead_id && " (fully vacant)"}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            {pending ? "Creating…" : "Create structure"}
          </Button>
        )}
      </div>

      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
