"use client";

import { useState, useTransition } from "react";
import { editClockEntryAction } from "@/app/actions/clock";
import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTh, EnterpriseTd } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { userDisplayName } from "@/lib/users/display-name";
import { formatMinutes } from "@/lib/production/metrics";
import { clockOutTypeLabel } from "@/lib/time-clock/labels";
import { PayTypeBadge } from "@/components/enterprise/pay-type-badge";
import { normalizePayType } from "@/lib/users/pay-type";
import { TeamAvailabilityPanel } from "@/components/production/team-availability-panel";
import { WrapUpCompliancePanel } from "@/components/production/wrap-up-compliance-panel";
import type { TeamMemberAvailability } from "@/lib/time-clock/availability-types";
import type { DailyWrapUpComplianceRow, TimeClockEntry, User } from "@/types/flow";

export function TimeClockAdminView({
  entries,
  users,
  availability,
  wrapUpCompliance,
  canOverrideWrapUp,
}: {
  entries: TimeClockEntry[];
  users: User[];
  availability: TeamMemberAvailability[];
  wrapUpCompliance: DailyWrapUpComplianceRow[];
  canOverrideWrapUp: boolean;
}) {
  const [userFilter, setUserFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = entries.filter((e) => userFilter === "all" || e.user_id === userFilter);

  return (
    <div className="space-y-6">
      <TeamAvailabilityPanel members={availability} />
      <WrapUpCompliancePanel rows={wrapUpCompliance} canOverride={canOverrideWrapUp} />

      <Select value={userFilter} onValueChange={(v) => setUserFilter(v ?? "all")}>
        <SelectTrigger className="w-[220px]">
          <EntitySelectValue
            value={userFilter}
            items={users}
            getLabel={userDisplayName}
            placeholder="Filter employee"
            sentinels={[{ value: "all", label: "All employees" }]}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All employees</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <EnterpriseSection title="Time clock records" description="Daily and weekly shift punches">
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh>Clock in</EnterpriseTh>
              <EnterpriseTh>Clock out</EnterpriseTh>
              <EnterpriseTh>Punch</EnterpriseTh>
              <EnterpriseTh align="right">Duration</EnterpriseTh>
              <EnterpriseTh>Status</EnterpriseTh>
              <EnterpriseTh>Actions</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {filtered.map((e) => {
              const user = users.find((u) => u.id === e.user_id);
              const isEditing = editingId === e.id;
              return (
                <tr key={e.id} className="enterprise-row-hover">
                  <EnterpriseTd>
                    <div className="flex items-center gap-2">
                      <span>{user?.full_name ?? e.user_id}</span>
                      {user?.role === "employee" && (
                        <PayTypeBadge payType={normalizePayType(user.pay_type, user.role)} />
                      )}
                    </div>
                  </EnterpriseTd>
                  <EnterpriseTd>
                    {isEditing ? (
                      <Input
                        type="datetime-local"
                        defaultValue={e.clock_in_at.slice(0, 16)}
                        name="clock_in"
                        className="h-8 text-xs"
                      />
                    ) : (
                      new Date(e.clock_in_at).toLocaleString()
                    )}
                  </EnterpriseTd>
                  <EnterpriseTd>
                    {isEditing ? (
                      <Input
                        type="datetime-local"
                        defaultValue={e.clock_out_at?.slice(0, 16) ?? ""}
                        name="clock_out"
                        className="h-8 text-xs"
                      />
                    ) : (
                      e.clock_out_at ? new Date(e.clock_out_at).toLocaleString() : "Active"
                    )}
                  </EnterpriseTd>
                  <EnterpriseTd className="capitalize text-xs">
                    {clockOutTypeLabel(e.clock_out_type)}
                  </EnterpriseTd>
                  <EnterpriseTd align="right">
                    {e.total_minutes != null ? formatMinutes(e.total_minutes) : "—"}
                  </EnterpriseTd>
                  <EnterpriseTd className="capitalize text-xs">{e.status}</EnterpriseTd>
                  <EnterpriseTd align="right">
                    {isEditing ? (
                      <form
                        className="flex gap-1 items-center"
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          const fd = new FormData(ev.currentTarget);
                          startTransition(async () => {
                            await editClockEntryAction(e.id, {
                              clock_in_at: fd.get("clock_in") ? new Date(String(fd.get("clock_in"))).toISOString() : undefined,
                              clock_out_at: fd.get("clock_out")
                                ? new Date(String(fd.get("clock_out"))).toISOString()
                                : null,
                              edit_reason: String(fd.get("reason") ?? "Manager correction"),
                            });
                            setEditingId(null);
                          });
                        }}
                      >
                        <Input name="reason" placeholder="Reason" className="h-8 w-24 text-xs" required />
                        <Button type="submit" size="sm" disabled={pending}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(e.id)}>
                        Edit
                      </Button>
                    )}
                  </EnterpriseTd>
                </tr>
              );
            })}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>
    </div>
  );
}
