"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitySelectValue } from "@/components/ui/entity-select-value";
import { userDisplayName } from "@/lib/users/display-name";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildPlanningCalendarEvents,
  CALENDAR_KIND_LABELS,
  filterCalendarEvents,
  formatCalendarDateKey,
  getCalendarMonthGrid,
  getCalendarWeekDays,
  groupEventsByDate,
  summarizeCalendarDay,
  type PlanningCalendarEvent,
  type PlanningCalendarEventKind,
} from "@/lib/planning/calendar";
import type { PlanningCenterSnapshot } from "@/lib/planning/types";
import { riskLabel } from "@/lib/planning/utils";
import type { Department, Project, WorkPackage } from "@/types/flow";
import { cn } from "@/lib/utils";
import {
  addMonths,
  format,
  isToday,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const ALL_KINDS: PlanningCalendarEventKind[] = [
  "task_forecast",
  "task_due",
  "project_forecast",
  "department_forecast",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function riskAccent(risk: PlanningCalendarEvent["riskLevel"]): string {
  switch (risk) {
    case "critical":
      return "border-destructive/50 bg-destructive/10 text-destructive";
    case "at_risk":
      return "border-warning/50 bg-warning/10 text-warning";
    default:
      return "border-border/60 bg-muted/20 text-foreground";
  }
}

function kindAccent(kind: PlanningCalendarEventKind): string {
  switch (kind) {
    case "project_forecast":
      return "border-primary/40 bg-primary/10";
    case "department_forecast":
      return "border-violet-500/40 bg-violet-500/10";
    case "task_due":
      return "border-amber-500/40 bg-amber-500/10";
    default:
      return "";
  }
}

export function PlanningCalendarView({
  snapshot,
  workPackages,
  projects,
  departments,
  forecastRefreshedAt,
}: {
  snapshot: PlanningCenterSnapshot;
  workPackages: WorkPackage[];
  projects: Project[];
  departments: Department[];
  forecastRefreshedAt?: string;
}) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => formatCalendarDateKey(new Date()));
  const [departmentId, setDepartmentId] = useState<string>("__all__");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [kinds, setKinds] = useState<PlanningCalendarEventKind[]>(ALL_KINDS);

  const allEvents = useMemo(
    () =>
      buildPlanningCalendarEvents({
        workPackages,
        projects,
        departments,
        departmentForecasts: snapshot.departmentForecasts,
      }),
    [workPackages, projects, departments, snapshot.departmentForecasts]
  );

  const filteredEvents = useMemo(
    () =>
      filterCalendarEvents(allEvents, {
        kinds,
        departmentId: departmentId === "__all__" ? null : departmentId,
        atRiskOnly,
      }),
    [allEvents, kinds, departmentId, atRiskOnly]
  );

  const eventsByDate = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);
  const monthGrid = useMemo(() => getCalendarMonthGrid(month), [month]);
  const weekDays = useMemo(() => getCalendarWeekDays(new Date(selectedDate)), [selectedDate]);
  const selectedSummary = summarizeCalendarDay(
    selectedDate,
    eventsByDate.get(selectedDate) ?? []
  );

  const monthEventCount = filteredEvents.filter((e) => {
    const d = e.date.slice(0, 7);
    return d === format(month, "yyyy-MM");
  }).length;

  function toggleKind(kind: PlanningCalendarEventKind, checked: boolean) {
    setKinds((prev) => {
      if (checked) return prev.includes(kind) ? prev : [...prev, kind];
      const next = prev.filter((k) => k !== kind);
      return next.length > 0 ? next : ALL_KINDS;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Previous month"
            onClick={() => setMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const today = new Date();
              setMonth(today);
              setSelectedDate(formatCalendarDateKey(today));
            }}
          >
            Today
          </Button>
          <h3 className="text-sm font-semibold ml-1">{format(month, "MMMM yyyy")}</h3>
          <Badge variant="outline" className="text-[10px]">
            {monthEventCount} events this month
          </Badge>
          {forecastRefreshedAt ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              Live · updated{" "}
              {new Date(forecastRefreshedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="planning-cal-at-risk"
              checked={atRiskOnly}
              onCheckedChange={(v) => setAtRiskOnly(v === true)}
            />
            <Label htmlFor="planning-cal-at-risk" className="text-xs text-muted-foreground">
              At risk only
            </Label>
          </div>
          <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <EntitySelectValue
                value={departmentId}
                items={departments}
                getLabel={(d) => d.name}
                placeholder="All departments"
                sentinels={[{ value: "__all__", label: "All departments" }]}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {ALL_KINDS.map((kind) => (
          <label key={kind} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Checkbox
              checked={kinds.includes(kind)}
              onCheckedChange={(v) => toggleKind(kind, v === true)}
            />
            {CALENDAR_KIND_LABELS[kind]}
          </label>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Dates shift automatically from task timers, document progress, and assignee queues — refreshes
        every 2 minutes while this page is open.
      </p>

      <Tabs defaultValue="month">
        <TabsList className="mb-3">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <TabsContent value="month" className="mt-0">
            <MonthGrid
              monthGrid={monthGrid}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </TabsContent>

          <TabsContent value="week" className="mt-0">
            <WeekGrid
              weekDays={weekDays}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </TabsContent>

          <DayDetailPanel summary={selectedSummary} />
        </div>
      </Tabs>
    </div>
  );
}

function MonthGrid({
  monthGrid,
  eventsByDate,
  selectedDate,
  onSelectDate,
}: {
  monthGrid: { date: Date; inMonth: boolean }[];
  eventsByDate: Map<string, PlanningCalendarEvent[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid.map(({ date, inMonth }) => {
          const key = formatCalendarDateKey(date);
          const dayEvents = eventsByDate.get(key) ?? [];
          const selected = key === selectedDate;
          const today = isToday(date);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={cn(
                "min-h-[108px] border-b border-r border-border/40 p-1.5 text-left transition-colors hover:bg-muted/20",
                !inMonth && "bg-muted/5 text-muted-foreground/60",
                selected && "bg-primary/5 ring-1 ring-inset ring-primary/30"
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    today && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(date, "d")}
                </span>
                {dayEvents.some((e) => e.riskLevel === "critical" || e.riskLevel === "at_risk") && (
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" title="At risk" />
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <CalendarChip key={event.id} event={event} compact />
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  weekDays,
  eventsByDate,
  selectedDate,
  onSelectDate,
}: {
  weekDays: Date[];
  eventsByDate: Map<string, PlanningCalendarEvent[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="grid gap-2 lg:grid-cols-7">
      {weekDays.map((date) => {
        const key = formatCalendarDateKey(date);
        const dayEvents = eventsByDate.get(key) ?? [];
        const selected = key === selectedDate;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDate(key)}
            className={cn(
              "rounded-lg border border-border/60 p-2 text-left min-h-[280px] hover:bg-muted/15",
              selected && "ring-1 ring-primary/40 bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">{format(date, "EEE")}</p>
                <p className={cn("text-lg font-semibold tabular-nums", isToday(date) && "text-primary")}>
                  {format(date, "d")}
                </p>
              </div>
              {dayEvents.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {dayEvents.length}
                </Badge>
              )}
            </div>
            <div className="space-y-1.5">
              {dayEvents.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No forecast events</p>
              ) : (
                dayEvents.map((event) => <CalendarChip key={event.id} event={event} />)
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CalendarChip({
  event,
  compact,
}: {
  event: PlanningCalendarEvent;
  compact?: boolean;
}) {
  const content = (
    <span
      className={cn(
        "block truncate rounded border px-1 py-0.5 text-[10px] leading-tight",
        riskAccent(event.riskLevel),
        kindAccent(event.kind)
      )}
      title={`${event.title} — ${event.statusLabel ?? CALENDAR_KIND_LABELS[event.kind]}`}
    >
      {compact ? event.title : event.title}
    </span>
  );

  if (event.href) {
    return (
      <Link
        href={event.href}
        onClick={(e) => e.stopPropagation()}
        className="block hover:opacity-90"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function DayDetailPanel({ summary }: { summary: ReturnType<typeof summarizeCalendarDay> }) {
  return (
    <aside className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4 h-fit xl:sticky xl:top-4">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <CalendarDays className="h-4 w-4" />
          <p className="text-[10px] uppercase tracking-wide">Selected day</p>
        </div>
        <p className="text-lg font-semibold">
          {format(new Date(summary.date + "T12:00:00"), "EEEE, MMM d")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Tasks" value={summary.taskCount} />
        <Stat label="Projects" value={summary.projectCount} />
        <Stat label="At risk" value={summary.atRiskCount} warn={summary.atRiskCount > 0} />
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {summary.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No forecast or due-date events on this day.</p>
        ) : (
          summary.events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "rounded-md border px-3 py-2 space-y-1",
                riskAccent(event.riskLevel),
                kindAccent(event.kind)
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{event.title}</p>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {CALENDAR_KIND_LABELS[event.kind]}
                </Badge>
              </div>
              {event.subtitle && (
                <p className="text-xs text-muted-foreground">{event.subtitle}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                {event.departmentName && <span>{event.departmentName}</span>}
                <span>{riskLabel(event.riskLevel)}</span>
              </div>
              {event.href && (
                <Button size="sm" variant="outline" className="h-7 text-xs mt-1" render={<Link href={event.href} />}>
                  Open
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={cn("rounded-md border border-border/50 bg-background/60 px-2 py-2", warn && "border-warning/40")}>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
