"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createClockEntryAction,
  deleteClockEntryAction,
  editClockEntryAction,
} from "@/app/actions/clock";
import {
  EnterpriseDataTable,
  EnterpriseTableHead,
  EnterpriseTh,
  EnterpriseTd,
} from "@/components/enterprise/enterprise-data-table";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { useFlowToast } from "@/components/ui/flow-toast";
import { userDisplayName } from "@/lib/users/display-name";
import { formatMinutes } from "@/lib/production/metrics";
import {
  appDatetimeLocalToIso,
  appTodayDate,
  formatAppDateTimeFull,
  toAppDatetimeLocalValue,
} from "@/lib/datetime/timezone";
import { clockOutTypeLabel } from "@/lib/time-clock/labels";
import { PayTypeBadge } from "@/components/enterprise/pay-type-badge";
import { normalizePayType } from "@/lib/users/pay-type";
import { TeamAvailabilityPanel } from "@/components/production/team-availability-panel";
import { TimeClockRecordsFilterBar } from "@/components/production/time-clock-records-filter-bar";
import {
  TimeClockWeekCalendar,
  weekDays,
  weekStartFor,
} from "@/components/production/time-clock-week-calendar";
import { WrapUpCompliancePanel } from "@/components/production/wrap-up-compliance-panel";
import {
  buildTimeClockRecordsHref,
  filterClockEntriesByDateRange,
  filterClockEntriesByEmployee,
  type ClockRecordDateRange,
} from "@/lib/time-clock/record-filters";
import type { TeamMemberAvailability } from "@/lib/time-clock/availability-types";
import type { DailyWrapUpComplianceRow, TimeClockEntry, User } from "@/types/flow";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

interface EditDraft {
  clockIn: string;
  clockOut: string;
  punchType: "lunch" | "out" | "active";
  reason: string;
}

function defaultManualDraft(): EditDraft {
  const now = toAppDatetimeLocalValue(new Date().toISOString());
  return { clockIn: now, clockOut: now, punchType: "out", reason: "" };
}

export function TimeClockAdminView({
  entries,
  users,
  availability,
  wrapUpCompliance,
  canOverrideWrapUp,
  canEdit,
  initialDateRange,
  initialUserFilter = "all",
  variant = "full",
  syncFiltersToUrl = false,
}: {
  entries: TimeClockEntry[];
  users: User[];
  availability: TeamMemberAvailability[];
  wrapUpCompliance: DailyWrapUpComplianceRow[];
  canOverrideWrapUp: boolean;
  canEdit: boolean;
  initialDateRange: ClockRecordDateRange;
  initialUserFilter?: string;
  variant?: "full" | "employee";
  syncFiltersToUrl?: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const isEmployeeVariant = variant === "employee";
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [userFilter, setUserFilter] = useState(
    isEmployeeVariant ? users[0]?.id ?? "all" : initialUserFilter
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState(users[0]?.id ?? "");
  const [addDraft, setAddDraft] = useState<EditDraft>(defaultManualDraft);
  const [pending, startTransition] = useTransition();
  const [recordsView, setRecordsView] = useState<"punches" | "calendar">("punches");
  const [calWeekStart, setCalWeekStart] = useState(() => weekStartFor(appTodayDate()));

  const filtered = filterClockEntriesByEmployee(
    filterClockEntriesByDateRange(entries, dateRange),
    userFilter
  );

  function onEmployeeFilterChange(userId: string) {
    setUserFilter(userId);
    if (!syncFiltersToUrl) return;
    router.push(
      buildTimeClockRecordsHref("/time-clock", dateRange, userId === "all" ? undefined : userId)
    );
  }

  function onCalendarWeekChange(weekStart: string) {
    setCalWeekStart(weekStart);
    // Refetch entries for the selected week (range is capped to today server-side)
    const days = weekDays(weekStart);
    const today = appTodayDate();
    const range = { from: days[0], to: days[6] < today ? days[6] : today };
    setDateRange(range);
    if (!syncFiltersToUrl) return;
    router.push(
      buildTimeClockRecordsHref("/time-clock", range, userFilter === "all" ? undefined : userFilter)
    );
  }

  function startEdit(entry: TimeClockEntry) {
    setEditingId(entry.id);
    setEditDraft({
      clockIn: toAppDatetimeLocalValue(entry.clock_in_at),
      clockOut: entry.clock_out_at ? toAppDatetimeLocalValue(entry.clock_out_at) : "",
      punchType: entry.clock_out_at ? entry.clock_out_type ?? "out" : "active",
      reason: "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function saveEdit(entryId: string) {
    if (!editDraft) return;
    startTransition(async () => {
      try {
        await editClockEntryAction(entryId, {
          clock_in_at: appDatetimeLocalToIso(editDraft.clockIn),
          clock_out_at:
            editDraft.punchType === "active"
              ? null
              : editDraft.clockOut
                ? appDatetimeLocalToIso(editDraft.clockOut)
                : null,
          clock_out_type: editDraft.punchType === "active" ? null : editDraft.punchType,
          edit_reason: editDraft.reason,
        });
        toast({ variant: "success", title: "Clock punch updated" });
        cancelEdit();
        router.refresh();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not save punch",
          description: e instanceof Error ? e.message : "Try again",
        });
      }
    });
  }

  function saveManual() {
    if (!addUserId) {
      toast({ variant: "error", title: "Select an employee" });
      return;
    }
    startTransition(async () => {
      try {
        await createClockEntryAction({
          userId: addUserId,
          clock_in_at: appDatetimeLocalToIso(addDraft.clockIn),
          clock_out_at:
            addDraft.punchType === "active"
              ? null
              : addDraft.clockOut
                ? appDatetimeLocalToIso(addDraft.clockOut)
                : null,
          clock_out_type: addDraft.punchType === "active" ? null : addDraft.punchType,
          edit_reason: addDraft.reason,
        });
        toast({ variant: "success", title: "Clock punch added" });
        setAddOpen(false);
        setAddDraft(defaultManualDraft());
        router.refresh();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not add punch",
          description: e instanceof Error ? e.message : "Try again",
        });
      }
    });
  }

  function removeEntry(entry: TimeClockEntry) {
    const reason = window.prompt("Reason for removing this punch (required):");
    if (!reason?.trim()) return;
    startTransition(async () => {
      try {
        await deleteClockEntryAction(entry.id, reason.trim());
        toast({ variant: "success", title: "Clock punch removed" });
        router.refresh();
      } catch (e) {
        toast({
          variant: "error",
          title: "Could not remove punch",
          description: e instanceof Error ? e.message : "Try again",
        });
      }
    });
  }

  const focusUser = isEmployeeVariant ? users[0] : null;

  return (
    <div className="space-y-6">
      {!isEmployeeVariant && (
        <>
          <TeamAvailabilityPanel members={availability} />
          <WrapUpCompliancePanel rows={wrapUpCompliance} canOverride={canOverrideWrapUp} />
        </>
      )}

      {isEmployeeVariant && focusUser && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Shift clock punches</p>
            <p className="text-xs text-muted-foreground">
              Clock history for {focusUser.full_name}
              {canEdit ? " — edit or add corrections below" : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" render={<Link href={`/time-clock?employee=${focusUser.id}`} />}>
            Open in Time Clock
          </Button>
        </div>
      )}

      {(isEmployeeVariant || recordsView === "punches") && (
        <TimeClockRecordsFilterBar
          range={dateRange}
          onRangeChange={setDateRange}
          employeeId={userFilter !== "all" ? userFilter : undefined}
          syncToUrl={syncFiltersToUrl}
          resultCount={filtered.length}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!isEmployeeVariant && (
          <div className="flex items-center rounded-md border border-border/60 p-0.5">
            <Button
              size="sm"
              variant={recordsView === "punches" ? "secondary" : "ghost"}
              onClick={() => setRecordsView("punches")}
            >
              Punches
            </Button>
            <Button
              size="sm"
              variant={recordsView === "calendar" ? "secondary" : "ghost"}
              onClick={() => {
                setRecordsView("calendar");
                onCalendarWeekChange(calWeekStart);
              }}
            >
              Weekly calendar
            </Button>
          </div>
        )}
        {!isEmployeeVariant && (
          <Select value={userFilter} onValueChange={(v) => onEmployeeFilterChange(v ?? "all")}>
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
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {canEdit && !isEmployeeVariant && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add manual punch
          </Button>
        )}

        {canEdit && isEmployeeVariant && focusUser && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddUserId(focusUser.id);
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add manual punch
          </Button>
        )}
      </div>

      {!isEmployeeVariant && recordsView === "calendar" && (
        <TimeClockWeekCalendar
          entries={entries}
          users={users}
          userFilter={userFilter}
          weekStart={calWeekStart}
          onWeekChange={onCalendarWeekChange}
        />
      )}

      {(isEmployeeVariant || recordsView === "punches") && (
      <EnterpriseSection
        title="Time clock records"
        description={
          canEdit
            ? "Correct missed or wrong punches — edits are audited with a required reason"
            : "Daily and weekly shift punches (view only)"
        }
      >
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              {!isEmployeeVariant && <EnterpriseTh>Employee</EnterpriseTh>}
              <EnterpriseTh>Clock in</EnterpriseTh>
              <EnterpriseTh>Clock out</EnterpriseTh>
              <EnterpriseTh>Punch</EnterpriseTh>
              <EnterpriseTh align="right">Duration</EnterpriseTh>
              <EnterpriseTh>Status</EnterpriseTh>
              {canEdit && <EnterpriseTh>Actions</EnterpriseTh>}
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? (isEmployeeVariant ? 6 : 7) : isEmployeeVariant ? 5 : 6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No clock punches in this date range
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const user = users.find((u) => u.id === e.user_id);
                const isEditing = editingId === e.id && editDraft != null;
                return (
                  <tr key={e.id} className="enterprise-row-hover align-top">
                    {!isEmployeeVariant && (
                      <EnterpriseTd>
                        <div className="flex items-center gap-2">
                          <span>{user?.full_name ?? e.user_id}</span>
                          {user?.role === "employee" && (
                            <PayTypeBadge payType={normalizePayType(user.pay_type, user.role)} />
                          )}
                        </div>
                      </EnterpriseTd>
                    )}
                    <EnterpriseTd>
                      {isEditing ? (
                        <Input
                          type="datetime-local"
                          value={editDraft.clockIn}
                          onChange={(ev) =>
                            setEditDraft((d) => (d ? { ...d, clockIn: ev.target.value } : d))
                          }
                          className="h-8 text-xs min-w-[180px]"
                        />
                      ) : (
                        formatAppDateTimeFull(e.clock_in_at)
                      )}
                    </EnterpriseTd>
                    <EnterpriseTd>
                      {isEditing ? (
                        editDraft.punchType === "active" ? (
                          <span className="text-xs text-muted-foreground">Still on shift</span>
                        ) : (
                          <Input
                            type="datetime-local"
                            value={editDraft.clockOut}
                            onChange={(ev) =>
                              setEditDraft((d) => (d ? { ...d, clockOut: ev.target.value } : d))
                            }
                            className="h-8 text-xs min-w-[180px]"
                          />
                        )
                      ) : e.clock_out_at ? (
                        formatAppDateTimeFull(e.clock_out_at)
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Active
                        </Badge>
                      )}
                    </EnterpriseTd>
                    <EnterpriseTd className="capitalize text-xs">
                      {isEditing ? (
                        <Select
                          value={editDraft.punchType}
                          onValueChange={(v) =>
                            setEditDraft((d) =>
                              d ? { ...d, punchType: (v as EditDraft["punchType"]) ?? "out" } : d
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">On shift</SelectItem>
                            <SelectItem value="lunch">Lunch</SelectItem>
                            <SelectItem value="out">End of day</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        clockOutTypeLabel(e.clock_out_type)
                      )}
                    </EnterpriseTd>
                    <EnterpriseTd align="right">
                      {e.total_minutes != null ? formatMinutes(e.total_minutes) : "—"}
                    </EnterpriseTd>
                    <EnterpriseTd>
                      <div className="space-y-1">
                        <Badge
                          variant={e.status === "active" ? "default" : "secondary"}
                          className="capitalize text-[10px]"
                        >
                          {e.status}
                        </Badge>
                        {e.edit_reason && (
                          <p className="text-[10px] text-muted-foreground max-w-[160px] leading-snug">
                            {e.edit_reason}
                          </p>
                        )}
                      </div>
                    </EnterpriseTd>
                    {canEdit && (
                      <EnterpriseTd align="right">
                        {isEditing ? (
                          <div className="flex flex-col gap-2 items-end min-w-[200px]">
                            <Input
                              value={editDraft.reason}
                              onChange={(ev) =>
                                setEditDraft((d) => (d ? { ...d, reason: ev.target.value } : d))
                              }
                              placeholder="Reason (required)"
                              className="h-8 text-xs w-full"
                            />
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                disabled={pending || !editDraft.reason.trim()}
                                onClick={() => saveEdit(e.id)}
                              >
                                Save
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(e)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeEntry(e)}
                              disabled={pending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </EnterpriseTd>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add manual clock punch</DialogTitle>
            <DialogDescription>
              For missed punches or corrections — requires a reason and is logged in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={addUserId} onValueChange={(v) => setAddUserId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Clock in</Label>
              <Input
                type="datetime-local"
                value={addDraft.clockIn}
                onChange={(ev) => setAddDraft((d) => ({ ...d, clockIn: ev.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Punch type</Label>
              <Select
                value={addDraft.punchType}
                onValueChange={(v) =>
                  setAddDraft((d) => ({ ...d, punchType: (v as EditDraft["punchType"]) ?? "out" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Still on shift (no clock out)</SelectItem>
                  <SelectItem value="lunch">Clocked out for lunch</SelectItem>
                  <SelectItem value="out">Clocked out for day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addDraft.punchType !== "active" && (
              <div className="space-y-1.5">
                <Label>Clock out</Label>
                <Input
                  type="datetime-local"
                  value={addDraft.clockOut}
                  onChange={(ev) => setAddDraft((d) => ({ ...d, clockOut: ev.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                value={addDraft.reason}
                onChange={(ev) => setAddDraft((d) => ({ ...d, reason: ev.target.value }))}
                placeholder="e.g. Forgot to clock out Friday"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending || !addDraft.reason.trim()} onClick={saveManual}>
              Add punch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
