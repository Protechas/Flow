// READ-ONLY survey: classify every Monday board — columns, dates, doc counts.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { readdirSync } from "fs";

const dir = "C:/Protech Monday Replacment/monday-data/boards";
const files = readdirSync(dir).filter((f) => f.endsWith(".xlsx"));

const DATE_RE = /date|created|updated|timeline|due|completed/i;
const DOC_RE = /doc|count|models|pages|# of|number|qty|total/i;
const PERSON_RE = /person|owner|assignee|analyst|who/i;
const STATUS_RE = /status/i;

let totals = { boards: 0, items: 0, withStatus: 0, withPerson: 0, withDate: 0, withDoc: 0 };
const docColNames = new Map();
const statusValues = new Map();
let dateMin = "9999", dateMax = "0000";
const boardSummaries = [];

for (const f of files) {
  let wb;
  try {
    wb = XLSX.readFile(`${dir}/${f}`, { cellDates: false });
  } catch {
    console.log("UNREADABLE:", f);
    continue;
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  // Monday layout: board name row, then group rows; each group = title row,
  // header row (starts with "Name"), item rows.
  let headers = null;
  let items = 0;
  const cols = new Set();
  for (const r of rows) {
    if (!r?.length) continue;
    if (typeof r[0] === "string" && r[0] === "Name" && r.length > 1) {
      headers = r;
      r.forEach((c) => typeof c === "string" && cols.add(c));
      continue;
    }
    if (headers && r[0] != null && String(r[0]).trim() && r.length > 1) {
      items++;
      // Track status values + date ranges from typed columns
      headers.forEach((h, i) => {
        const v = r[i];
        if (v == null || v === "") return;
        if (typeof h === "string" && STATUS_RE.test(h) && typeof v === "string" && v.length < 40) {
          statusValues.set(v, (statusValues.get(v) ?? 0) + 1);
        }
        if (typeof h === "string" && DATE_RE.test(h) && typeof v === "string") {
          const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
          if (m) {
            if (m[1] < dateMin) dateMin = m[1];
            if (m[1] > dateMax) dateMax = m[1];
          }
        }
      });
    }
  }
  if (!headers && rows.length <= 2) continue; // empty board
  totals.boards++;
  totals.items += items;
  const colArr = [...cols];
  const hasStatus = colArr.some((c) => STATUS_RE.test(c));
  const hasPerson = colArr.some((c) => PERSON_RE.test(c));
  const hasDate = colArr.some((c) => DATE_RE.test(c));
  const docCols = colArr.filter((c) => DOC_RE.test(c));
  if (hasStatus) totals.withStatus++;
  if (hasPerson) totals.withPerson++;
  if (hasDate) totals.withDate++;
  if (docCols.length) {
    totals.withDoc++;
    docCols.forEach((c) => docColNames.set(c, (docColNames.get(c) ?? 0) + 1));
  }
  boardSummaries.push({ f: f.replace(/^\d+_/, ""), items, cols: colArr.length, hasStatus, hasPerson, hasDate, docCols: docCols.slice(0, 3).join("; ") });
}

console.log("=== TOTALS ===");
console.log(JSON.stringify(totals));
console.log("\n=== DOC-COUNT-ISH COLUMN NAMES (top 25) ===");
[...docColNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([c, n]) => console.log(`  ${String(n).padStart(3)}x  ${c}`));
console.log("\n=== STATUS VALUES (top 25) ===");
[...statusValues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([c, n]) => console.log(`  ${String(n).padStart(5)}x  ${c}`));
console.log(`\n=== DATE RANGE seen: ${dateMin} → ${dateMax} ===`);
console.log("\n=== 20 BIGGEST BOARDS ===");
boardSummaries.sort((a, b) => b.items - a.items).slice(0, 20).forEach((b) => console.log(`  ${String(b.items).padStart(5)} items  ${b.hasStatus ? "S" : "-"}${b.hasPerson ? "P" : "-"}${b.hasDate ? "D" : "-"}  docCols:[${b.docCols}]  ${b.f}`));
