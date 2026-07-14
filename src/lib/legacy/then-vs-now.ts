import type { LegacyMetricRow } from "@/lib/legacy/monday-baseline";
import type { TaskFileUpload, TaskSubmissionRecord } from "@/types/flow";

/**
 * Then vs Now: Monday.com era baseline against live Flow production.
 *
 * Comparability rules (they keep the numbers honest):
 * - Rate math (minutes per document) uses only Monday DOC-WORK categories
 *   (special_functions, other) — the si_check boards were seconds-long
 *   per-system checks, a different unit of work. They count toward volume,
 *   never toward the rate.
 * - Flow-era minutes/doc comes from task submissions (timer minutes over
 *   uploaded documents), sanity-bounded the same way the Monday clocks were.
 * - Dollars use the wage the owner set; wage-only (no benefits burden), so
 *   the savings figure is conservative.
 */

const RATE_CATEGORIES = new Set(["special_functions", "other"]);
/** Same spirit as the import's 5s..4h per-item window. */
const SANE_MIN_PER_DOC = 0.2;
const SANE_MAX_PER_DOC = 480;

export interface ThenVsNowWeekPoint {
  week: string;
  era: "monday" | "flow";
  docsPerPersonDay: number | null;
  docs: number;
  people: number;
}

export interface ThenVsNowSummary {
  monday: {
    doneItems: number;
    docWorkItems: number;
    clockedItems: number;
    minutesPerDoc: number | null;
    docsPerPersonDay: number | null;
    people: number;
    firstWeek: string | null;
    lastWeek: string | null;
  };
  flow: {
    docsDone: number;
    minutesPerDoc: number | null;
    docsPerPersonDay: number | null;
    people: number;
    sinceDate: string;
    monthlyDocPace: number;
  };
  savings: {
    minutesSavedPerDoc: number | null;
    hoursSavedPerMonth: number | null;
    dollarsSavedPerMonth: number | null;
    dollarsSavedPerYear: number | null;
    wagePerHour: number;
  };
  productionRateChangePct: number | null;
  timePerDocChangePct: number | null;
  weekly: ThenVsNowWeekPoint[];
}

function weekStartOf(iso: string): string {
  const dt = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildThenVsNow(input: {
  legacy: LegacyMetricRow[];
  uploads: TaskFileUpload[];
  submissions: TaskSubmissionRecord[];
  wagePerHour: number;
  flowStartDate: string;
  now?: Date;
}): ThenVsNowSummary {
  const now = input.now ?? new Date();

  // ——— Monday era ———
  const mondayPeople = new Set<string>();
  const mondayWeeks = new Map<string, { docs: number; people: Set<string> }>();
  let doneItems = 0;
  let docWorkItems = 0;
  let clockSeconds = 0;
  let clockedItems = 0;

  for (const r of input.legacy) {
    doneItems += r.items_done;
    mondayPeople.add(r.person_name);
    if (!RATE_CATEGORIES.has(r.category)) continue;
    docWorkItems += r.items_done;
    clockSeconds += r.clock_seconds;
    clockedItems += r.items_with_clock;
    if (r.week_start) {
      const w = mondayWeeks.get(r.week_start) ?? { docs: 0, people: new Set<string>() };
      w.docs += r.items_done;
      w.people.add(r.person_name);
      mondayWeeks.set(r.week_start, w);
    }
  }

  const mondayMinutesPerDoc =
    clockedItems > 0 ? round1(clockSeconds / 60 / clockedItems) : null;

  // ——— Flow era ———
  const flowUploads = input.uploads.filter(
    (u) => (u.uploaded_at ?? u.created_at) >= input.flowStartDate
  );
  const flowPeople = new Set(flowUploads.map((u) => u.user_id));
  const flowWeeks = new Map<string, { docs: number; people: Set<string> }>();
  for (const u of flowUploads) {
    const week = weekStartOf(u.uploaded_at ?? u.created_at);
    const w = flowWeeks.get(week) ?? { docs: 0, people: new Set<string>() };
    w.docs += 1;
    w.people.add(u.user_id);
    flowWeeks.set(week, w);
  }

  let flowMinutes = 0;
  let flowDocs = 0;
  for (const s of input.submissions) {
    if (s.submitted_at < input.flowStartDate) continue;
    if (!s.uploaded_file_count || s.total_task_minutes <= 0) continue;
    const perDoc = s.total_task_minutes / s.uploaded_file_count;
    if (perDoc < SANE_MIN_PER_DOC || perDoc > SANE_MAX_PER_DOC) continue;
    flowMinutes += s.total_task_minutes;
    flowDocs += s.uploaded_file_count;
  }
  const flowMinutesPerDoc = flowDocs > 0 ? round1(flowMinutes / flowDocs) : null;

  const daysElapsed = Math.max(
    1,
    (now.getTime() - new Date(input.flowStartDate + "T00:00:00Z").getTime()) / 86400000
  );
  const monthlyDocPace = Math.round((flowUploads.length / daysElapsed) * 30);

  // ——— Rates: docs per person-day (5-day work week) ———
  const rate = (weeks: Map<string, { docs: number; people: Set<string> }>) => {
    let docs = 0;
    let personDays = 0;
    for (const w of weeks.values()) {
      docs += w.docs;
      personDays += w.people.size * 5;
    }
    return personDays > 0 ? round1(docs / personDays) : null;
  };
  const mondayRate = rate(mondayWeeks);
  const flowRate = rate(flowWeeks);

  // ——— Savings at the owner's wage ———
  let minutesSavedPerDoc: number | null = null;
  let hoursSavedPerMonth: number | null = null;
  let dollarsSavedPerMonth: number | null = null;
  let dollarsSavedPerYear: number | null = null;
  if (mondayMinutesPerDoc != null && flowMinutesPerDoc != null) {
    minutesSavedPerDoc = round1(mondayMinutesPerDoc - flowMinutesPerDoc);
    hoursSavedPerMonth = round1((minutesSavedPerDoc * monthlyDocPace) / 60);
    dollarsSavedPerMonth = Math.round(hoursSavedPerMonth * input.wagePerHour);
    dollarsSavedPerYear = dollarsSavedPerMonth * 12;
  }

  const weekly: ThenVsNowWeekPoint[] = [
    ...[...mondayWeeks.entries()].map(([week, w]): ThenVsNowWeekPoint => ({
      week,
      era: "monday",
      docs: w.docs,
      people: w.people.size,
      docsPerPersonDay: w.people.size > 0 ? round1(w.docs / (w.people.size * 5)) : null,
    })),
    ...[...flowWeeks.entries()].map(([week, w]): ThenVsNowWeekPoint => ({
      week,
      era: "flow",
      docs: w.docs,
      people: w.people.size,
      docsPerPersonDay: w.people.size > 0 ? round1(w.docs / (w.people.size * 5)) : null,
    })),
  ].sort((a, b) => a.week.localeCompare(b.week));

  const mondayWeekKeys = [...mondayWeeks.keys()].sort();

  return {
    monday: {
      doneItems,
      docWorkItems,
      clockedItems,
      minutesPerDoc: mondayMinutesPerDoc,
      docsPerPersonDay: mondayRate,
      people: mondayPeople.size,
      firstWeek: mondayWeekKeys[0] ?? null,
      lastWeek: mondayWeekKeys[mondayWeekKeys.length - 1] ?? null,
    },
    flow: {
      docsDone: flowUploads.length,
      minutesPerDoc: flowMinutesPerDoc,
      docsPerPersonDay: flowRate,
      people: flowPeople.size,
      sinceDate: input.flowStartDate,
      monthlyDocPace,
    },
    savings: {
      minutesSavedPerDoc,
      hoursSavedPerMonth,
      dollarsSavedPerMonth,
      dollarsSavedPerYear,
      wagePerHour: input.wagePerHour,
    },
    productionRateChangePct:
      mondayRate && flowRate ? Math.round(((flowRate - mondayRate) / mondayRate) * 100) : null,
    timePerDocChangePct:
      mondayMinutesPerDoc && flowMinutesPerDoc
        ? Math.round(((flowMinutesPerDoc - mondayMinutesPerDoc) / mondayMinutesPerDoc) * 100)
        : null,
    weekly,
  };
}
