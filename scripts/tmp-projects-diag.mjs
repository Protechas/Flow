// Read-only: row counts for the structures the /projects page computes over.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = readFileSync("C:/Protech Monday Replacment/flow/.env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const db = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY") ?? get("SUPABASE_SERVICE_ROLE"));

for (const table of ["projects", "work_items", "manufacturers", "year_work_items", "comments", "task_corrections"]) {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true });
  console.log(`${table}: ${error ? "ERR " + error.message : count}`);
}
