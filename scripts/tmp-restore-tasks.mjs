// EMERGENCY RESTORE step 2: rebuild assignee/status on the 8 wiped tasks.
// Evidence: timers (Deryk Nissan+Honda, Jacob Kia, Michael Toyota) + upload
// rows for the rest. Applies restores and prints what it did.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync("C:/Protech Monday Replacment/flow/.env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const db = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY") ?? get("SUPABASE_SERVICE_ROLE"));

const q = async (t, c, f) => {
  let query = db.from(t).select(c);
  if (f) query = f(query);
  const { data, error } = await query;
  if (error) { console.log(`${t} ERROR: ${error.message}`); return []; }
  return data;
};

const users = await q("users", "id,full_name");
const uid = (name) => users.find((u) => u.full_name.startsWith(name))?.id;
const uname = (id) => users.find((u) => u.id === id)?.full_name ?? id;

const TASKS = {
  subaru: "7bda0031-db47-4c54-aac1-afd4adb2b51e",
  nissan: "4ee25947-fc10-41ae-8da2-d7ef8d42c091",
  honda: "93545b7d-1e1b-4e1f-93b4-e73dcc4cf76d",
  ford: "19ae02d6-62f4-4aa2-89a3-5dc020332cc6",
  chevrolet: "724374eb-96a2-4166-bf3b-c118bdeb81a3",
  hyundai: "a0e876f4-8949-4c3d-b204-7d898d202806",
  kia: "9ff2b8bb-3a2e-4cf0-9b8f-aa108f5a1b16",
  toyota: "271671d0-9ec7-4044-a900-17a9dacec848",
};
const ids = Object.values(TASKS);

// More evidence: file uploads per task (who uploaded, when)
const uploads = await q("task_file_uploads", "task_id,user_id,uploaded_at", (s) => s.in("task_id", ids));
const byTask = {};
for (const u of uploads) {
  byTask[u.task_id] ??= {};
  byTask[u.task_id][uname(u.user_id)] = (byTask[u.task_id][uname(u.user_id)] ?? 0) + 1;
}
console.log("uploads by task:");
for (const [name, id] of Object.entries(TASKS)) {
  console.log(`  ${name}: ${JSON.stringify(byTask[id] ?? {})}`);
}

// Evidence-based restore map (statuses conservative: active work =
// working_on_it, everything else assigned so it reappears in queues).
const RESTORE = [
  { name: "nissan", task: TASKS.nissan, user: uid("Deryk"), status: "working_on_it" },
  { name: "honda", task: TASKS.honda, user: uid("Deryk"), status: "working_on_it" },
  { name: "kia", task: TASKS.kia, user: uid("Jacob"), status: "working_on_it" },
  { name: "toyota", task: TASKS.toyota, user: uid("Michael Johnson"), status: "assigned" },
];

// The four without timer evidence: use upload evidence if present.
for (const [name, id] of Object.entries(TASKS)) {
  if (RESTORE.some((r) => r.task === id)) continue;
  const evidence = byTask[id] ? Object.keys(byTask[id]) : [];
  if (evidence.length === 1) {
    RESTORE.push({ name, task: id, user: uid(evidence[0].split(" ")[0]) ?? users.find((u) => u.full_name === evidence[0])?.id, status: "assigned" });
  } else {
    console.log(`NO EVIDENCE for ${name} — leaving unassigned (report to owner)`);
  }
}

for (const r of RESTORE) {
  if (!r.user) { console.log(`SKIP ${r.name}: could not resolve user`); continue; }
  const { error } = await db
    .from("work_items")
    .update({ assigned_to: r.user, status: r.status })
    .eq("id", r.task);
  console.log(error ? `RESTORE ERROR ${r.name}: ${error.message}` : `restored ${r.name} -> ${uname(r.user)} (${r.status})`);
}

// Final state
const after = await q("work_items", "title,status,assigned_to,file_count", (s) => s.in("id", ids));
console.log("\nFINAL:");
for (const t of after) console.log(`  ${t.title}: ${t.status} -> ${t.assigned_to ? uname(t.assigned_to) : "(unassigned)"} files=${t.file_count ?? 0}`);
