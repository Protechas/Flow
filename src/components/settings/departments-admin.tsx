"use client";

import { useState, useTransition } from "react";
import {
  createDepartmentAction,
  updateDepartmentAction,
} from "@/app/actions/departments";
import { DepartmentBadge } from "@/components/departments/department-badge";
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
import { Textarea } from "@/components/ui/textarea";
import type { Department, User } from "@/types/flow";
import { Building2, Plus } from "lucide-react";

export function DepartmentsAdmin({
  departments,
  managers,
}: {
  departments: Department[];
  managers: User[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLead, setNewLead] = useState("");

  function run(action: () => Promise<unknown>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setMessage("Saved");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="flow-helper">
          Departments organize teams, projects, and reporting. Teams remain the operational unit for day-to-day work.
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New department
        </Button>
      </div>

      {showCreate && (
        <div className="enterprise-panel p-4 space-y-3">
          <p className="enterprise-label">Create department</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. ADAS Research" />
            </div>
            <div className="space-y-1">
              <Label>Department lead</Label>
              <Select value={newLead || "__none__"} onValueChange={(v) => setNewLead(!v || v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
          </div>
          <Button
            size="sm"
            disabled={pending || !newName.trim()}
            onClick={() =>
              run(async () => {
                await createDepartmentAction({
                  name: newName.trim(),
                  description: newDesc || undefined,
                  lead_user_id: newLead || null,
                });
                setNewName("");
                setNewDesc("");
                setNewLead("");
                setShowCreate(false);
              })
            }
          >
            Create
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left py-3 px-3 font-medium">Department</th>
              <th className="text-left py-3 px-3 font-medium">Lead</th>
              <th className="text-left py-3 px-3 font-medium">Status</th>
              <th className="text-right py-3 px-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className={pending ? "opacity-60" : ""}>
            {departments.map((dept) => (
              <DepartmentRow key={dept.id} department={dept} managers={managers} onSave={(u) => run(() => updateDepartmentAction(dept.id, u))} />
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function DepartmentRow({
  department,
  managers,
  onSave,
}: {
  department: Department;
  managers: User[];
  onSave: (updates: Parameters<typeof updateDepartmentAction>[1]) => void;
}) {
  const [name, setName] = useState(department.name);
  const [desc, setDesc] = useState(department.description ?? "");
  const [lead, setLead] = useState(department.lead_user_id ?? "");

  return (
    <tr className="border-t border-border/40 align-top">
      <td className="py-3 px-3">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <DepartmentBadge departmentId={department.id} name={department.name} />
        </div>
        <Input className="h-8 text-sm mb-1" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea className="text-xs" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
      </td>
      <td className="py-3 px-3">
        <Select value={lead || "__none__"} onValueChange={(v) => setLead(!v || v === "__none__" ? "" : v)}>
          <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Lead" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-3 px-3">
        <Badge variant="outline" className={department.status === "active" ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground"}>
          {department.status}
        </Badge>
      </td>
      <td className="py-3 px-3 text-right space-y-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs w-full"
          onClick={() => onSave({ name, description: desc || null, lead_user_id: lead || null })}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs w-full"
          onClick={() =>
            onSave({ status: department.status === "active" ? "archived" : "active" })
          }
        >
          {department.status === "active" ? "Archive" : "Reactivate"}
        </Button>
      </td>
    </tr>
  );
}
