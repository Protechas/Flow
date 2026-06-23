"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminResendInviteAction,
  adminResetPasswordAction,
  adminSetPasswordAction,
  saveUserProfileAction,
  setUserActiveAction,
  type SaveUserProfileInput,
} from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ORGANIZATIONAL_POSITIONS, PAY_TYPES, SYSTEM_ACCESS_LEVELS } from "@/lib/constants";
import { formatActionError } from "@/lib/errors/action-messages";
import {
  EMPLOYMENT_STATUS_OPTIONS,
  employmentStatusLabel,
} from "@/lib/users/profile-validation";
import {
  getOrganizationalPosition,
  getSystemAccessLevel,
} from "@/lib/auth/access-level";
import type {
  Department,
  DepartmentUser,
  EmploymentStatus,
  OrgPosition,
  OrganizationalPosition,
  PayType,
  SystemAccessLevel,
  Team,
  User,
} from "@/types/flow";
import { KeyRound, Mail, Save, UserCog } from "lucide-react";

function primaryDepartmentId(userId: string, departmentUsers: DepartmentUser[]): string | null {
  const primary = departmentUsers.find((du) => du.user_id === userId && du.is_primary);
  return (
    primary?.department_id ??
    departmentUsers.find((du) => du.user_id === userId)?.department_id ??
    null
  );
}

function Section({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function UserProfileEditor({
  user,
  users,
  teams,
  departments,
  departmentUsers,
  positions,
  managers,
  open,
  onOpenChange,
  resetPasswordEnabled = false,
  initialSection,
}: {
  user: User | null;
  users: User[];
  teams: Team[];
  departments: Department[];
  departmentUsers: DepartmentUser[];
  positions: OrgPosition[];
  managers: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetPasswordEnabled?: boolean;
  initialSection?: "access" | "account" | "organization";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const [form, setForm] = useState<SaveUserProfileInput | null>(null);

  useEffect(() => {
    if (!open || !initialSection) return;
    const id =
      initialSection === "access"
        ? "profile-access-section"
        : initialSection === "account"
          ? "profile-account-section"
          : initialSection === "organization"
            ? "profile-org-section"
            : null;
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [open, initialSection, user?.id]);

  useEffect(() => {
    if (!user || !open) return;
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone ?? "",
      job_title: user.job_title ?? "",
      department_id: primaryDepartmentId(user.id, departmentUsers),
      team_id: user.team_id ?? null,
      manager_id: user.manager_id ?? null,
      assigned_position_id: user.assigned_position_id ?? null,
      organizational_position: getOrganizationalPosition(user),
      system_access_level: getSystemAccessLevel(user),
      pay_type: user.pay_type ?? null,
      hire_date: user.hire_date ?? "",
      employment_status: (user.employment_status ?? "active") as EmploymentStatus,
      is_active: user.is_active,
      branch_view_access: !!user.branch_view_access,
    });
    setError(null);
    setMessage(null);
    setPassword("");
  }, [user, open, departmentUsers]);

  const filteredTeams = useMemo(() => {
    if (!form?.department_id) return teams;
    return teams.filter((t) => !t.department_id || t.department_id === form.department_id);
  }, [teams, form?.department_id]);

  const vacantPositions = useMemo(
    () =>
      positions.filter(
        (p) =>
          p.status !== "inactive" &&
          (!p.assigned_user_id || p.assigned_user_id === user?.id) &&
          (p.status === "vacant" || p.status === "planned" || p.status === "filled")
      ),
    [positions, user?.id]
  );

  if (!user || !form) return null;

  const orgPosition = form.organizational_position;
  const showPayType = orgPosition === "employee";
  const showBranchAccess = orgPosition === "manager";

  function patch<K extends keyof SaveUserProfileInput>(key: K, value: SaveUserProfileInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function run(action: () => Promise<unknown>, success: string, closeOnSuccess = false) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(success);
        router.refresh();
        if (closeOnSuccess) onOpenChange(false);
      } catch (e) {
        setError(formatActionError(e));
      }
    });
  }

  function saveProfile() {
    if (!form || !user) return;
    run(
      () =>
        saveUserProfileAction(user.id, {
          ...form,
          phone: form.phone || null,
          job_title: form.job_title || null,
          hire_date: form.hire_date || null,
        }),
      "User profile saved.",
      true
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flow-org-profile-panel w-full sm:max-w-xl overflow-y-auto p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 text-left">
          <SheetTitle className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            Edit user
          </SheetTitle>
          <SheetDescription>
            Update profile, organization, and access for {user.full_name}.
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{employmentStatusLabel(form.employment_status)}</Badge>
            <Badge
              variant="outline"
              className={
                form.is_active
                  ? "text-emerald-400 border-emerald-500/30"
                  : "text-red-400 border-red-500/30"
              }
            >
              {form.is_active ? "Account active" : "Account disabled"}
            </Badge>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          <Section title="Basic information">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-first-name">First name</Label>
                <Input
                  id="profile-first-name"
                  value={form.first_name}
                  onChange={(e) => patch("first_name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-last-name">Last name</Label>
                <Input
                  id="profile-last-name"
                  value={form.last_name}
                  onChange={(e) => patch("last_name", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-display-name">Display name</Label>
              <Input
                id="profile-display-name"
                value={form.full_name}
                onChange={(e) => patch("full_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-job-title">Job title</Label>
              <Input
                id="profile-job-title"
                value={form.job_title ?? ""}
                onChange={(e) => patch("job_title", e.target.value)}
                placeholder="Optional display title"
              />
            </div>
          </Section>

          <Section
            title="Contact & login"
            description="Email changes update Supabase Auth and the user profile together."
          >
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={form.email}
                onChange={(e) => patch("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => patch("phone", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </Section>

          <Section title="Organization" id={initialSection === "organization" ? "profile-org-section" : undefined}>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={form.department_id ?? "__none__"}
                onValueChange={(v) =>
                  patch("department_id", !v || v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select
                value={form.team_id ?? "__none__"}
                onValueChange={(v) => patch("team_id", !v || v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No team</SelectItem>
                  {filteredTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Supervisor</Label>
              <Select
                value={form.manager_id ?? "__none__"}
                onValueChange={(v) =>
                  patch("manager_id", !v || v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No supervisor</SelectItem>
                  {managers
                    .filter((m) => m.id !== user.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned org seat</Label>
              <Select
                value={form.assigned_position_id ?? "__none__"}
                onValueChange={(v) =>
                  patch("assigned_position_id", !v || v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No seat assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {vacantPositions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section
            title="Access & permissions"
            id={initialSection === "access" ? "profile-access-section" : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Org chart position</Label>
                <Select
                  value={form.organizational_position}
                  onValueChange={(v) =>
                    v && patch("organizational_position", v as OrganizationalPosition)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORGANIZATIONAL_POSITIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>System access</Label>
                <Select
                  value={form.system_access_level}
                  onValueChange={(v) =>
                    v && patch("system_access_level", v as SystemAccessLevel)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_ACCESS_LEVELS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {showBranchAccess && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.branch_view_access}
                  onChange={(e) => patch("branch_view_access", e.target.checked)}
                />
                <span>Full branch view access</span>
              </label>
            )}
          </Section>

          <Section title="Employment details">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-hire-date">Start date</Label>
                <Input
                  id="profile-hire-date"
                  type="date"
                  value={form.hire_date ?? ""}
                  onChange={(e) => patch("hire_date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Employment status</Label>
                <Select
                  value={form.employment_status ?? "active"}
                  onValueChange={(v) =>
                    v && patch("employment_status", v as EmploymentStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {showPayType && (
              <div className="space-y-1.5">
                <Label>Pay type</Label>
                <Select
                  value={form.pay_type ?? "hourly"}
                  onValueChange={(v) => v && patch("pay_type", v as PayType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_TYPES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Account status</Label>
              <Select
                value={form.is_active ? "active" : "disabled"}
                onValueChange={(v) => patch("is_active", v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — can sign in</SelectItem>
                  <SelectItem value="disabled">Disabled — cannot sign in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section
            title="Account actions"
            description="Password and invite actions apply immediately."
            id={initialSection === "account" ? "profile-account-section" : undefined}
          >
            {resetPasswordEnabled ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-password" className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Set password
                  </Label>
                  <Input
                    id="profile-password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending || password.length < 8}
                    onClick={() =>
                      run(
                        () => adminSetPasswordAction(user.id, password),
                        "Password updated.",
                        false
                      )
                    }
                  >
                    Set password
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => adminResetPasswordAction(user.id, form.email),
                        "Password reset email sent."
                      )
                    }
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Send reset email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() => adminResendInviteAction(user.id), "Invite email resent.")
                    }
                  >
                    Resend invite
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Password and invite actions require SUPABASE_SERVICE_ROLE_KEY on the server.
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () => setUserActiveAction(user.id, !form.is_active),
                  form.is_active ? "User deactivated." : "User reactivated."
                )
              }
            >
              {form.is_active ? "Deactivate user" : "Reactivate user"}
            </Button>
          </Section>

          {message && <p className="text-sm text-emerald-400">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/50">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={saveProfile}>
            <Save className="h-4 w-4 mr-1" />
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
