"use client";

import { useMemo, useState, useTransition } from "react";
import { completeUserSetupAction } from "@/app/actions/setup";
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
import { USER_ROLES, PAY_TYPES } from "@/lib/constants";
import { buildHierarchyPreview } from "@/lib/setup/hierarchy-preview";
import {
  departmentLabel,
  filterValidSupervisors,
  getRoleFieldConfig,
  teamsForDepartment,
  teamLabel,
} from "@/lib/setup/role-fields";
import type { Department, PayType, Team, User, UserRole } from "@/types/flow";
import { UserPlus } from "lucide-react";

const STEPS = [
  "Basic info",
  "Department",
  "Team",
  "Supervisor",
  "Role",
  "Review & activate",
];

export function UserSetupWizard({
  users,
  departments,
  teams,
  mode = "create",
  initialUser,
  onComplete,
}: {
  users: User[];
  departments: Department[];
  teams: Team[];
  mode?: "create" | "update";
  initialUser?: User;
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(initialUser?.first_name ?? "");
  const [lastName, setLastName] = useState(initialUser?.last_name ?? "");
  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initialUser?.role ?? "employee");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState(initialUser?.team_id ?? "");
  const [managerId, setManagerId] = useState(initialUser?.manager_id ?? "");
  const [payType, setPayType] = useState<PayType>(initialUser?.pay_type ?? "hourly");
  const [hireDate, setHireDate] = useState(initialUser?.hire_date ?? "");

  const roleConfig = getRoleFieldConfig(role);
  const deptTeams = useMemo(
    () => (departmentId ? teamsForDepartment(teams, departmentId) : teams),
    [teams, departmentId]
  );
  const supervisors = useMemo(
    () => filterValidSupervisors(role, users),
    [role, users]
  );

  const preview = useMemo(
    () =>
      buildHierarchyPreview({
        first_name: firstName,
        last_name: lastName,
        role,
        department_name: departmentLabel(departments, departmentId),
        team_name: teamLabel(teams, teamId),
        reports_to_id: managerId || null,
        users,
      }),
    [firstName, lastName, role, departmentId, teamId, managerId, departments, teams, users]
  );

  function canAdvance(): boolean {
    if (step === 0) {
      if (!firstName.trim()) return false;
      if (mode === "create" && (!email.trim() || password.length < 8)) return false;
      return true;
    }
    if (step === 1) {
      if (roleConfig.requiresDepartment && !departmentId) return false;
      return true;
    }
    if (step === 2) {
      if (roleConfig.requiresTeam && !teamId) return false;
      return true;
    }
    if (step === 3) {
      if (roleConfig.requiresReportsTo && !managerId) return false;
      return true;
    }
    if (step === 4) return Boolean(role);
    return true;
  }

  function submit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await completeUserSetupAction({
          mode,
          user_id: initialUser?.id,
          email: mode === "create" ? email.trim() : undefined,
          password: mode === "create" ? password : undefined,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role,
          department_id: departmentId || undefined,
          team_id: teamId || null,
          manager_id: managerId || null,
          hire_date: hireDate || null,
          pay_type: role === "employee" ? payType : "salary",
        });
        setSuccess(
          mode === "create"
            ? `User ${firstName} ${lastName} created with full reporting chain.`
            : `Setup completed for ${firstName} ${lastName}.`
        );
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
          <UserPlus className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">
            {mode === "create" ? "Guided user setup" : "Complete user setup"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Answer a few questions — Flow builds the reporting chain, permissions, and dashboard scope automatically.
          </p>
        </div>
      </div>

      <WizardStepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>First name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          {mode === "create" && (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Temporary password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Hire date (optional)</Label>
            <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          {roleConfig.requiresDepartment ? (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.filter((d) => d.status === "active").map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              No department required for this role.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          {roleConfig.requiresTeam ? (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId || "__none__"} onValueChange={(v) => setTeamId(!v || v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select team…</SelectItem>
                  {deptTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              No team required for this role.
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 max-w-md">
          {roleConfig.requiresReportsTo ? (
            <div className="space-y-2">
              <Label>Reports to</Label>
              <Select value={managerId || "__none__"} onValueChange={(v) => setManagerId(!v || v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select supervisor…</SelectItem>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only valid supervisors for a {role.replace("_", " ")} are shown.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This role does not require a direct supervisor.
            </p>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 max-w-md">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            {roleConfig.helper}
          </p>
          <p className="text-xs text-muted-foreground">
            New users default to Employee. Change only when authorized.
          </p>
          {role === "employee" && (
            <div className="space-y-2">
              <Label>Pay type</Label>
              <Select value={payType} onValueChange={(v) => v && setPayType(v as PayType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAY_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {step === 5 && <HierarchyPreviewCard preview={preview} />}

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
            {pending ? "Saving…" : mode === "create" ? "Create user" : "Activate account"}
          </Button>
        )}
      </div>

      {success && <p className="text-sm text-emerald-400">{success}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
