/**
 * Head-to-head Flow Score comparison using the REAL scoring engine against
 * live data (READ-ONLY). Loads the same tables the app hydrates from and maps
 * them exactly like the hydrators do, then runs the app's own
 * buildEmployeeScorecard / computeFlowScoreBreakdown.
 *
 * Run: node --env-file=.env.local scripts/compare-flow-scores.mjs "Deryk" "Michael Johnson"
 *
 * Caveat: activity events are in-memory on the server (not DB-persisted), so
 * the 10% Activity component reads 0 here — mirror of what a fresh serverless
 * instance shows.
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const jiti = require("jiti")(import.meta.url, {
  interopDefault: true,
  alias: { "@": "C:/Protech Monday Replacment/flow/src" },
});

const { buildEmployeeScorecard, rankScorecards } = jiti("@/lib/scoring/performance-engine");
const { computeFlowScoreBreakdown } = jiti("@/lib/scoring/accountability-engine");
const {
  completedThisWeek,
  completedThisMonth,
  completedToday,
  computeQaPassRate,
  computeOnTimeRate,
  computeAvgCompletionHours,
} = jiti("@/lib/scoring/flow-score");

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function all(table, order) {
  let q = s.from(table).select("*");
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

const [users, teams, workItems, timeLogs, qaRecords] = await Promise.all([
  all("users"),
  all("teams"),
  all("work_items", { col: "created_at", asc: true }),
  all("time_logs"),
  all("qa_review_records"),
]);

// Mirror mapWorkPackage's due-date fallback; other scoring fields are 1:1.
const workPackages = workItems.map((r) => ({
  ...r,
  due_date: r.due_date ?? r.manual_due_date ?? null,
  qa_status: r.qa_status ?? "pending",
  status: r.status ?? "not_started",
}));
const byTaskId = new Map(workPackages.map((w) => [w.id, w]));

// Mirror qaRecordToReview: analyst resolved from the task's assignee.
const qaReviews = qaRecords.map((rec) => ({
  id: rec.id,
  work_package_id: rec.task_id,
  reviewer_id: rec.reviewer_id,
  analyst_id: byTaskId.get(rec.task_id)?.assigned_to ?? "",
  result: rec.status,
  notes: rec.notes,
  reviewed_at: rec.reviewed_at,
  created_at: rec.created_at,
}));

const slice = { users, teams, workPackages, timeLogs, qaReviews, activity: [], corrections: [] };

function findUser(name) {
  const q = name.toLowerCase();
  const hit = users.find((u) => u.is_active && (u.full_name ?? "").toLowerCase().includes(q));
  if (!hit) {
    console.error(`No active user matching "${name}".`);
    process.exit(1);
  }
  return hit;
}
const a = findUser(process.argv[2] ?? "Deryk");
const b = findUser(process.argv[3] ?? "Michael Johnson");

const employees = users.filter(
  (u) => u.is_active && (u.organizational_position ?? u.role) === "employee"
);
const cards = rankScorecards(employees.map((u) => buildEmployeeScorecard(u, slice)));

console.log("=== LEADERBOARD (engine ranking, live data) ===");
cards.forEach((c, i) => {
  const mark = c.user.id === a.id || c.user.id === b.id ? "   <<<" : "";
  console.log(`${String(i + 1).padStart(2)}. ${(c.user.full_name ?? "?").padEnd(24)} ${String(c.flowScore).padStart(3)}${mark}`);
});

const pkgs = (id) => workPackages.filter((p) => p.assigned_to === id);

function detail(user) {
  const bd = computeFlowScoreBreakdown(slice, user.id);
  const mine = pkgs(user.id);
  const rank = cards.findIndex((c) => c.user.id === user.id) + 1;
  console.log(`\n=== ${user.full_name} — Flow Score ${bd.flowScore} (rank ${rank || "?"}) ===`);
  for (const key of ["productivity", "quality", "onTime", "activity"]) {
    const comp = bd[key];
    console.log(`\n[${key.toUpperCase()}] ${comp.score}/100 × weight ${comp.weight}`);
    for (const f of comp.factors ?? []) {
      console.log(
        `   - ${f.label}: ${f.rawValue} → ${f.normalizedScore}/100 (factor weight ${f.weight}, contributes ${f.contribution})`
      );
      if (f.explanation) console.log(`       ${f.explanation}`);
    }
  }
  const doneCount = mine.filter((p) => p.status === "done").length;
  console.log(`\nCounters:`);
  console.log(`   assigned ${mine.length} · done ${doneCount} · today ${completedToday(mine)} · this week ${completedThisWeek(mine)} · this month ${completedThisMonth(mine)}`);
  console.log(`   QA pass rate ${computeQaPassRate(qaReviews, user.id)}% (${qaReviews.filter((r) => r.analyst_id === user.id).length} reviews: ${
    qaReviews.filter((r) => r.analyst_id === user.id && r.result === "pass").length
  } pass / ${qaReviews.filter((r) => r.analyst_id === user.id && r.result !== "pass").length} not)`);
  console.log(`   on-time rate ${computeOnTimeRate(mine)}% · avg completion hours ${computeAvgCompletionHours(mine)}`);
  const overdueOpen = mine.filter((p) => p.status !== "done" && p.due_date && new Date(p.due_date) < new Date()).length;
  console.log(`   open+overdue right now: ${overdueOpen}`);
  const hrs = timeLogs.filter((t) => t.user_id === user.id).reduce((x, t) => x + Number(t.hours ?? 0), 0);
  console.log(`   total logged hours: ${Math.round(hrs * 10) / 10}`);
}

detail(a);
detail(b);

const ba = computeFlowScoreBreakdown(slice, a.id);
const bb = computeFlowScoreBreakdown(slice, b.id);
console.log(`\n=== HEAD-TO-HEAD (${a.full_name} vs ${b.full_name}) ===`);
for (const key of ["productivity", "quality", "onTime", "activity"]) {
  console.log(`${key.padEnd(13)} ${String(ba[key].score).padStart(3)} vs ${String(bb[key].score).padStart(3)}  Δ ${ba[key].score - bb[key].score}`);
}
console.log(`${"FLOW SCORE".padEnd(13)} ${String(ba.flowScore).padStart(3)} vs ${String(bb.flowScore).padStart(3)}  Δ ${ba.flowScore - bb.flowScore}`);
