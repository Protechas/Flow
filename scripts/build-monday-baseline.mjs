// Parse all Monday boards -> classified, normalized weekly aggregates.
// READ-ONLY on the export; writes one JSON file for review before any DB touch.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { readdirSync, writeFileSync } from "fs";

const dir = "C:/Protech Monday Replacment/monday-data/boards";
const OUT = "C:/Protech Monday Replacment/monday-data/monday-baseline.json";

const SKIP_RE = /^Duplicate of|Private Board|Attendance|Subitems of/i;
const DONE_RE = /^(done|completed?|good to go)/i;
const PERSON_COLS = ["Teammate", "Person", "People", "Owner", "Analyst", "Assignee"];
const CLOCK_COLS = ["Working Clock", "Total Clock", "Total Time", "Total Task Time", "Total Working time", "Total Hours"];

function categorize(name) {
  if (/special functions/i.test(name)) return "special_functions";
  if (/service info refresh/i.test(name)) return "si_refresh";
  if (/acc|aeb|work area/i.test(name)) return "adas_work";
  if (/^(Acura-Fiat|Ford - Kia|Land Rover - Ram|Rolls Royce - Volkswagen)/i.test(name)) return "si_check";
  if (/^Q\d/i.test(name)) return "quarterly";
  return "other";
}

function serialToDate(v) {
  if (typeof v === "number" && v > 40000 && v < 60000) {
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return new Date(m[1] + "T00:00:00Z");
  }
  return null;
}

function clockToSeconds(v) {
  let secs = 0;
  if (typeof v === "string") {
    const m = v.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (m) secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  if (typeof v === "number" && v > 0 && v < 30) secs = Math.round(v * 86400); // excel time fraction
  // Sanity window: some boards put a cumulative board total on every row
  // (one person "clocked" 181,789 hours). A real per-item check runs
  // seconds to a few hours; outside that it's a rollup, not a measurement.
  if (secs < 5 || secs > 4 * 3600) return 0;
  return secs;
}

function weekStart(d) {
  const dt = new Date(d);
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}

const files = readdirSync(dir).filter((f) => f.endsWith(".xlsx"));
const agg = new Map(); // person|week|category -> {items, seconds, withClock}
const eraTotals = { items: 0, doneItems: 0, doneWithPerson: 0, seconds: 0, withClock: 0, boardsUsed: 0, boardsSkipped: 0 };
const perPerson = new Map();
const perCategory = new Map();
let minDate = "9999-12-31", maxDate = "0000-01-01";
const boardLog = [];

for (const f of files) {
  const boardName = f.replace(/^\d+_/, "").replace(/\.xlsx$/, "");
  if (SKIP_RE.test(boardName)) { eraTotals.boardsSkipped++; continue; }
  let wb;
  try { wb = XLSX.readFile(`${dir}/${f}`); } catch { eraTotals.boardsSkipped++; continue; }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) { eraTotals.boardsSkipped++; continue; }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  const category = categorize(boardName);

  let headers = null;
  let pIdx = -1, sIdx = -1, dIdx = -1, cIdx = -1;
  let boardDone = 0, boardSeconds = 0;

  for (const r of rows) {
    if (!r?.length) continue;
    if (r[0] === "Name" && r.length > 2) {
      headers = r.map((h) => (typeof h === "string" ? h.trim() : h));
      pIdx = headers.findIndex((h) => PERSON_COLS.includes(h));
      sIdx = headers.findIndex((h) => h === "Status" || h === "Task Status");
      dIdx = headers.findIndex((h) => h === "Date" || h === "Completed Date" || h === "Done Date");
      cIdx = headers.findIndex((h) => CLOCK_COLS.includes(h));
      continue;
    }
    if (!headers || r[0] == null || !String(r[0]).trim()) continue;
    eraTotals.items++;
    const status = sIdx >= 0 ? String(r[sIdx] ?? "") : "";
    if (!DONE_RE.test(status)) continue;
    eraTotals.doneItems++;
    boardDone++;

    const person = pIdx >= 0 && r[pIdx] ? String(r[pIdx]).trim() : null;
    if (!person) continue;
    eraTotals.doneWithPerson++;

    const date = dIdx >= 0 ? serialToDate(r[dIdx]) : null;
    const week = date ? weekStart(date) : "unknown";
    if (date) {
      const iso = date.toISOString().slice(0, 10);
      if (iso < minDate) minDate = iso;
      if (iso > maxDate) maxDate = iso;
    }
    const secs = cIdx >= 0 ? clockToSeconds(r[cIdx]) : 0;
    if (secs > 0) { eraTotals.seconds += secs; eraTotals.withClock++; boardSeconds += secs; }

    const key = `${person}|${week}|${category}`;
    const a = agg.get(key) ?? { person, week, category, items: 0, seconds: 0, withClock: 0 };
    a.items++;
    if (secs > 0) { a.seconds += secs; a.withClock++; }
    agg.set(key, a);

    const pp = perPerson.get(person) ?? { items: 0, seconds: 0, withClock: 0 };
    pp.items++; if (secs > 0) { pp.seconds += secs; pp.withClock++; }
    perPerson.set(person, pp);
    const pc = perCategory.get(category) ?? { items: 0, seconds: 0, withClock: 0 };
    pc.items++; if (secs > 0) { pc.seconds += secs; pc.withClock++; }
    perCategory.set(category, pc);
  }
  if (boardDone > 0) { eraTotals.boardsUsed++; boardLog.push({ boardName, category, boardDone, hours: Math.round(boardSeconds / 36) / 100 }); }
}

const rows = [...agg.values()].sort((a, b) => a.week.localeCompare(b.week));
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), eraTotals, minDate, maxDate, rows }, null, 1));

console.log("=== ERA TOTALS ===");
console.log(JSON.stringify(eraTotals));
console.log(`date range (dated done items): ${minDate} -> ${maxDate}`);
console.log(`aggregate rows: ${rows.length}`);
console.log("\n=== PER PERSON (done items) ===");
[...perPerson.entries()].sort((a, b) => b[1].items - a[1].items).slice(0, 20).forEach(([p, v]) =>
  console.log(`  ${p.padEnd(28)} items=${String(v.items).padStart(6)} clocked=${String(v.withClock).padStart(6)} hours=${(v.seconds / 3600).toFixed(1)}`));
console.log("\n=== PER CATEGORY ===");
[...perCategory.entries()].forEach(([c, v]) =>
  console.log(`  ${c.padEnd(18)} items=${String(v.items).padStart(6)} clocked=${String(v.withClock).padStart(6)} hours=${(v.seconds / 3600).toFixed(1)} avg min/item=${v.withClock ? (v.seconds / 60 / v.withClock).toFixed(1) : "—"}`));
console.log("\n=== TOP BOARDS USED ===");
boardLog.sort((a, b) => b.boardDone - a.boardDone).slice(0, 12).forEach((b) =>
  console.log(`  ${String(b.boardDone).padStart(6)} done  ${b.hours}h  [${b.category}] ${b.boardName}`));
