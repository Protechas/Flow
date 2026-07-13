import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: projects } = await s.from("projects").select("name, status, department_id");
console.log("projects:", JSON.stringify(projects?.map(p => ({ n: p.name.slice(0, 24), s: p.status, dept: p.department_id ? "set" : "NULL" }))));
const { data: du } = await s.from("department_users").select("user_id, department_id, is_primary");
console.log("department_users rows:", du?.length);
const { data: users } = await s.from("users").select("id, full_name, team_id");
console.log("users with team_id:", users?.filter(u => u.team_id).length, "of", users?.length);
