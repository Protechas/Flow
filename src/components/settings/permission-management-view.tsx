"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  cloneTemplateToUserAction,
  copyUserPermissionsAction,
  getUserPermissionSnapshotAction,
  resetUserPermissionsAction,
  updateUserModulePermissionAction,
  updateUserModuleVisibilityAction,
} from "@/app/actions/permission-profiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowToast } from "@/components/ui/flow-toast";
import type { UserFeatureAccessSnapshot } from "@/lib/auth/feature-access";
import type { PermissionTemplateId } from "@/lib/auth/feature-registry";
import { PERMISSION_TEMPLATE_LABELS } from "@/lib/auth/feature-registry";
import { cn } from "@/lib/utils";
import { Copy, RefreshCw, Search, Shield, Users } from "lucide-react";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  templateId: PermissionTemplateId;
};

type ModuleMeta = {
  id: string;
  label: string;
  group: string;
  permissions: { key: string; label: string }[];
};

const GROUP_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  attention: "Attention",
  operations: "Operations",
  workforce: "Workforce",
  reporting: "Reporting",
  administration: "Administration",
  employee: "Employee",
};

export function PermissionManagementView({
  users,
  modules,
}: {
  users: UserRow[];
  modules: ModuleMeta[];
}) {
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [copySourceId, setCopySourceId] = useState("");
  const [snapshot, setSnapshot] = useState<UserFeatureAccessSnapshot | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [userQuery, users]);

  const loadSnapshot = useCallback(
    (userId: string) => {
      if (!userId) return;
      startTransition(async () => {
        const res = await getUserPermissionSnapshotAction(userId);
        if (!res.ok) {
          toast({ variant: "error", title: "Load failed", description: res.message });
          return;
        }
        setSnapshot(res.snapshot);
      });
    },
    [toast]
  );

  const selectUser = useCallback(
    (userId: string) => {
      setSelectedUserId(userId);
      loadSnapshot(userId);
    },
    [loadSnapshot]
  );

  useEffect(() => {
    if (selectedUserId) loadSnapshot(selectedUserId);
  }, [selectedUserId, loadSnapshot]);

  const groupedModules = useMemo(() => {
    const groups = new Map<string, ModuleMeta[]>();
    for (const m of modules) {
      const list = groups.get(m.group) ?? [];
      list.push(m);
      groups.set(m.group, list);
    }
    return groups;
  }, [modules]);

  const moduleState = (moduleId: string) =>
    snapshot?.modules.find((m) => m.moduleId === moduleId);

  function toggleVisibility(moduleId: string, visible: boolean) {
    if (!selectedUserId) return;
    startTransition(async () => {
      const res = await updateUserModuleVisibilityAction(
        selectedUserId,
        moduleId,
        visible ? "visible" : "hidden"
      );
      if (!res.ok) {
        toast({ variant: "error", title: "Update failed", description: res.message });
        return;
      }
      loadSnapshot(selectedUserId);
    });
  }

  function togglePermission(moduleId: string, key: string, enabled: boolean) {
    if (!selectedUserId) return;
    startTransition(async () => {
      const res = await updateUserModulePermissionAction(selectedUserId, moduleId, key, enabled);
      if (!res.ok) {
        toast({ variant: "error", title: "Update failed", description: res.message });
        return;
      }
      loadSnapshot(selectedUserId);
    });
  }

  function resetDefaults() {
    if (!selectedUserId) return;
    startTransition(async () => {
      await resetUserPermissionsAction(selectedUserId);
      toast({ variant: "success", title: "Reset", description: "Permissions restored to role defaults." });
      loadSnapshot(selectedUserId);
    });
  }

  function copyFromUser() {
    if (!selectedUserId || !copySourceId) return;
    startTransition(async () => {
      const res = await copyUserPermissionsAction(copySourceId, selectedUserId);
      if (!res.ok) {
        toast({ variant: "error", title: "Copy failed", description: res.message });
        return;
      }
      toast({ variant: "success", title: "Copied", description: "Permissions copied from source user." });
      loadSnapshot(selectedUserId);
    });
  }

  function applyTemplate(templateId: PermissionTemplateId) {
    if (!selectedUserId) return;
    startTransition(async () => {
      await cloneTemplateToUserAction(selectedUserId, templateId);
      toast({
        variant: "success",
        title: "Template applied",
        description: `${PERMISSION_TEMPLATE_LABELS[templateId]} template cloned to user.`,
      });
      loadSnapshot(selectedUserId);
    });
  }

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Shield className="h-4 w-4 text-primary" />
          Enterprise permission layer (Phase 1)
        </p>
        <p className="mt-1">
          Custom profiles override sidebar visibility and block direct URLs to hidden modules. Feature
          permission toggles are stored for Phase 2 action enforcement — legacy role permissions still
          apply for unmapped checks. Users without a custom profile behave exactly as they do today.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="enterprise-panel p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Users</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users…"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="max-h-[420px] overflow-y-auto space-y-1">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectUser(u.id)}
                className={cn(
                  "w-full rounded-md px-2 py-2 text-left text-sm transition",
                  selectedUserId === u.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <p className="font-medium truncate">{u.full_name}</p>
                <p className="text-xs opacity-80 truncate">{u.email}</p>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          {selectedUser && snapshot && (
            <>
              <div className="enterprise-panel p-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{selectedUser.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="capitalize">
                      Role: {selectedUser.role.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="secondary">Template: {snapshot.templateLabel}</Badge>
                    {snapshot.isCustomized ? (
                      <Badge>Customized</Badge>
                    ) : (
                      <Badge variant="outline">Role defaults</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    onValueChange={(v) => v && applyTemplate(v as PermissionTemplateId)}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Apply template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PERMISSION_TEMPLATE_LABELS) as PermissionTemplateId[]).map(
                        (id) => (
                          <SelectItem key={id} value={id}>
                            {PERMISSION_TEMPLATE_LABELS[id]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={resetDefaults} disabled={pending}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Reset to defaults
                  </Button>
                </div>
              </div>

              <div className="enterprise-panel p-4 space-y-3">
                <Label className="text-xs text-muted-foreground">Copy permissions from another user</Label>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={copySourceId}
                    onValueChange={(v) => setCopySourceId(v ?? "")}
                  >
                    <SelectTrigger className="w-[220px] h-9">
                      <SelectValue placeholder="Source user…" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.id !== selectedUserId)
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={copyFromUser} disabled={pending || !copySourceId}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </Button>
                </div>
              </div>

              {[...groupedModules.entries()].map(([group, groupModules]) => (
                <section key={group} className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                    {GROUP_LABELS[group] ?? group}
                  </h4>
                  {groupModules.map((meta) => {
                    const state = moduleState(meta.id);
                    const isExpanded = expandedModule === meta.id;
                    const visible = state?.visibility === "visible";

                    return (
                      <div key={meta.id} className="enterprise-panel overflow-hidden">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/30"
                          onClick={() => setExpandedModule(isExpanded ? null : meta.id)}
                        >
                          <div>
                            <p className="font-medium text-sm">{meta.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {visible ? "Visible in navigation" : "Hidden from navigation"}
                            </p>
                          </div>
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Label className="text-xs">Visible</Label>
                            <Checkbox
                              checked={visible}
                              disabled={pending}
                              onCheckedChange={(v) => toggleVisibility(meta.id, v === true)}
                            />
                          </div>
                        </button>

                        {isExpanded && state && (
                          <div className="border-t px-4 py-3 space-y-2 bg-muted/10">
                            {meta.permissions.map((perm) => (
                              <div
                                key={perm.key}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span>{perm.label}</span>
                                <Checkbox
                                  checked={state.permissions[perm.key] ?? false}
                                  disabled={pending}
                                  onCheckedChange={(v) =>
                                    togglePermission(meta.id, perm.key, v === true)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
            </>
          )}

          {!snapshot && selectedUserId && (
            <div className="enterprise-panel p-8 text-center text-sm text-muted-foreground">
              Select a user to load their permission profile.
              <div className="mt-3">
                <Button size="sm" onClick={() => loadSnapshot(selectedUserId)} disabled={pending}>
                  Load profile
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
