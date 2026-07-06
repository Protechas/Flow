"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { appTodayDate, formatAppCalendarDate, formatAppTime } from "@/lib/datetime/timezone";
import { formatMinutes } from "@/lib/production/metrics";
import { userDisplayName } from "@/lib/users/display-name";
import { cn } from "@/lib/utils";
import type { TimeClockEntry, User } from "@/types/flow";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Sunday (yyyy-MM-dd) of the week containing the given app-TZ calendar date. */
export function weekStartFor(day: string): string {
  const anchor = parseISO(`${day}T12:00:00`);
  return format(addDays(anchor, -anchor.getDay()), "yyyy-MM-dd");
}

export function weekDays(weekStart: string): string[] {
  const anchor = parseISO(`${weekStart}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => format(addDays(anchor, i), "yyyy-MM-dd"));
}

function entryMinutes(entry: TimeClockEntry, now: Date): number {
  if (entry.total_minutes != null) return entry.total_minutes;
  if (!entry.clock_out_at) {
    return Math.max(0, Math.round((now.getTime() - new Date(entry.clock_in_at).getTime()) / 60000));
  }
  return Math.max(
    0,
    Math.round(
      (new Date(entry.clock_out_at).getTime() - new Date(entry.clock_in_at).getTime()) / 60000
    )
  );
}

function dayLabel(day: string): string {
  return format(parseISO(`${day}T12:00:00`), "EEE d");
}

function weekLabel(weekStart: string): string {
  const start = parseISO(`${weekStart}T12:00:00`);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
    : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function TimeClockWeekCalendar({
  entries,
  users,
  userFilter,
  weekStart,
  onWeekChange,
}: {
  entries: TimeClockEntry[];
  users: User[];
  userFilter: string;
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
}) {
  const now = new Date();
  const today = appTodayDate(now);
  const days = weekDays(weekStart);
  const thisWeek = weekStartFor(today);
  const focusUser = userFilter !== "all" ? users.find((u) => u.id === userFilter) : null;
  const rows = focusUser ? [focusUser] : users;

  // minutesByUserDay[userId][yyyy-MM-dd] = { minutes, punches[] }
  const byUserDay = new Map<string, Map<string, { minutes: number; punches: TimeClockEntry[] }>>();
  for (const entry of entries) {
    const day = formatAppCalendarDate(entry.clock_in_at);
    if (day < days[0] || day > days[6]) continue;
    let userMap = byUserDay.get(entry.user_id);
    if (!userMap) {
      userMap = new Map();
      byUserDay.set(entry.user_id, userMap);
    }
    const cell = userMap.get(day) ?? { minutes: 0, punches: [] };
    cell.minutes += entryMinutes(entry, now);
    cell.punches.push(entry);
    userMap.set(day, cell);
  }

  const dayTotals = days.map((day) =>
    rows.reduce((sum, u) => sum + (byUserDay.get(u.id)?.get(day)?.minutes ?? 0), 0)
  );
  const grandTotal = dayTotals.reduce((a, b) => a + b, 0);

  function shiftWeek(offsetDays: number) {
    const anchor = parseISO(`${weekStart}T12:00:00`);
    onWeekChange(format(addDays(anchor, offsetDays), "yyyy-MM-dd"));
  }

  return (
    <EnterpriseSection
      title="Weekly hours"
      description={
        focusUser
          ? `Shift punches and daily totals for ${focusUser.full_name}`
          : "Daily and weekly hours per team member"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => shiftWeek(-7)} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => shiftWeek(7)} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekStart !== thisWeek && (
            <Button size="sm" variant="ghost" onClick={() => onWeekChange(thisWeek)}>
              This week
            </Button>
          )}
        </div>
        <p className="text-sm font-semibold">{weekLabel(weekStart)}</p>
        <Badge variant="outline" className="text-xs tabular-nums">
          Week total · {formatMinutes(grandTotal)}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium min-w-[140px]">
                {focusUser ? "Employee" : `Employees (${rows.length})`}
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className={cn(
                    "px-3 py-2 font-medium text-center min-w-[86px]",
                    day === today && "text-primary"
                  )}
                >
                  {dayLabel(day)}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-right min-w-[80px]">Week</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No team members in scope
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const userMap = byUserDay.get(u.id);
                const weekTotal = days.reduce(
                  (sum, day) => sum + (userMap?.get(day)?.minutes ?? 0),
                  0
                );
                return (
                  <tr key={u.id} className="border-b border-border/40 enterprise-row-hover align-top">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{userDisplayName(u)}</td>
                    {days.map((day) => {
                      const cell = userMap?.get(day);
                      return (
                        <td
                          key={day}
                          className={cn(
                            "px-3 py-2 text-center tabular-nums",
                            day === today && "bg-primary/5"
                          )}
                        >
                          {cell ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold">{formatMinutes(cell.minutes)}</p>
                              {focusUser &&
                                cell.punches
                                  .slice()
                                  .sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at))
                                  .map((p) => (
                                    <p key={p.id} className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {formatAppTime(p.clock_in_at)}–
                                      {p.clock_out_at ? formatAppTime(p.clock_out_at) : "now"}
                                    </p>
                                  ))}
                              {!focusUser && cell.punches.some((p) => !p.clock_out_at) && (
                                <p className="text-[10px] text-primary">on shift</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {weekTotal > 0 ? formatMinutes(weekTotal) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {!focusUser && rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-border/60 bg-muted/30 text-xs">
                <td className="px-3 py-2 font-semibold">Team total</td>
                {dayTotals.map((minutes, i) => (
                  <td key={days[i]} className="px-3 py-2 text-center font-semibold tabular-nums">
                    {minutes > 0 ? formatMinutes(minutes) : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatMinutes(grandTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </EnterpriseSection>
  );
}
