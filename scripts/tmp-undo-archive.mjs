// EMERGENCY UNDO: restore the 4 AP projects to active and identify the 8
// tasks my earlier script unassigned/reset, with evidence for reconstruction.
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

const teams = await q("teams", "id,name");
const ap = teams.find((t) => /advanced/i.test(t.name));

// 1. Projects back to active immediately
const projects = await q("projects", "id,name,status", (s) => s.eq("team_id", ap.id));
for (const p of projects) {
  const { error } = await db.from("projects").update({ status: "active" }).eq("id", p.id);
  console.log(error ? `RESTORE ERROR ${p.name}: ${error.message}` : `restored active: ${p.name}`);
}

// 2. The 8 modified tasks: assigned_at set but assigned_to now null
const pids = projects.map((p) => p.id);
const tasks = await q(
  "work_items",
  "id,title,project_id,status,assigned_to,assigned_at,started_at,updated_at,qa_status,file_count",
  (s) => s.in("project_id", pids)
);
const wiped = tasks.filter((t) => !t.assigned_to && t.assigned_at);
console.log(`\ncandidate wiped tasks (assigned_at present, assignee null): ${wiped.length}`);
for (const t of wiped) {
  console.log(`- ${t.id} | ${t.title} | status=${t.status} started_at=${t.started_at ?? "-"} qa=${t.qa_status ?? "-"} files=${t.file_count ?? 0}`);
}

// 3. Evidence for who owned them: timer entries, submissions, uploads
const ids = wiped.map((t) => t.id);
const users = await q("users", "id,full_name");
const uname = (id) => users.find((u) => u.id === id)?.full_name ?? id;

for (const table of ["task_time_entries", "task_submissions", "task_files"]) {
  const rows = await q(table, "*", (s) => s.in(table === "task_files" ? "task_id" : "task_id", ids).limit(200));
  console.log(`\n${table}: ${rows.length}`);
  for (const r of rows) {
    const when = r.started_at ?? r.submitted_at ?? r.uploaded_at ?? r.created_at;
    console.log(`  task=${r.task_id} user=${uname(r.user_id)} at=${when} ${r.status ?? ""}`);
  }
}
