// Import the reviewed Monday baseline JSON into legacy_metrics. Idempotent:
// clears source='monday' rows first, then inserts the current aggregate set.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const data = JSON.parse(readFileSync("C:/Protech Monday Replacment/monday-data/monday-baseline.json", "utf8"));

const { error: delErr } = await s.from("legacy_metrics").delete().eq("source", "monday");
if (delErr) throw delErr;

const rows = data.rows.map((r) => ({
  source: "monday",
  person_name: r.person,
  week_start: r.week === "unknown" ? null : r.week,
  category: r.category,
  items_done: r.items,
  clock_seconds: r.seconds,
  items_with_clock: r.withClock,
}));

for (let i = 0; i < rows.length; i += 200) {
  const { error } = await s.from("legacy_metrics").insert(rows.slice(i, i + 200));
  if (error) throw error;
}
const { count } = await s.from("legacy_metrics").select("*", { count: "exact", head: true });
console.log(`imported ${rows.length} rows; table now holds ${count}`);
