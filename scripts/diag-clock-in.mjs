#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim().replace(/\r$/, "");
  if (!t || t.startsWith("#")) continue;
  const m = t.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: tyler } = await admin
  .from("users")
  .select("id,full_name,email,pay_type,team_id")
  .ilike("full_name", "%tyler%");
const { data: kelsi } = await admin
  .from("users")
  .select("id,full_name,email,pay_type,team_id")
  .or("full_name.ilike.%kelsi%,full_name.ilike.%kelsie%");
const { data: depts } = await admin.from("departments").select("id,name").limit(10);

console.log("Tyler:", tyler);
console.log("Kelsi:", kelsi);
console.log("Departments:", depts);

const teamId = tyler?.[0]?.team_id;
if (teamId) {
  const { data: team } = await admin.from("teams").select("id,name,department_id").eq("id", teamId).single();
  console.log("Tyler team:", team);
}
const { data: du } = await admin
  .from("department_users")
  .select("*")
  .eq("user_id", tyler?.[0]?.id ?? "");
console.log("Tyler department_users:", du);

const userId = tyler?.[0]?.id ?? kelsi?.[0]?.id;
if (!userId) {
  console.error("No test user found");
  process.exit(1);
}

const deptId = depts?.[0]?.id ?? null;
const now = new Date().toISOString();

for (const label of ["string-id", "uuid-id"]) {
  const id = label === "string-id" ? `clk-${Date.now()}-abc12` : randomUUID();
  const row = {
    id,
    user_id: userId,
    department_id: deptId,
    clock_in_at: now,
    clock_out_at: null,
    total_minutes: null,
    clock_out_type: null,
    status: "active",
    edited_by: null,
    edit_reason: null,
    updated_at: now,
  };
  const { error } = await admin.from("time_clock_entries").upsert(row, { onConflict: "id" });
  console.log(`Upsert (${label}):`, error ? `${error.code} ${error.message}` : "OK");
  if (!error) await admin.from("time_clock_entries").delete().eq("id", id);
}

// Test with mock department id
const mockDept = "dept-service-info";
const uuid = randomUUID();
const row2 = {
  id: uuid,
  user_id: userId,
  department_id: mockDept,
  clock_in_at: now,
  clock_out_at: null,
  total_minutes: null,
  clock_out_type: null,
  status: "active",
  edited_by: null,
  edit_reason: null,
  updated_at: now,
};
const { error: e2 } = await admin.from("time_clock_entries").upsert(row2, { onConflict: "id" });
console.log(`Upsert (mock dept id):`, e2 ? `${e2.code} ${e2.message}` : "OK");
if (!e2) await admin.from("time_clock_entries").delete().eq("id", uuid);
