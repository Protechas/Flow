/** Per-task receipts for a user: done tasks w/ due vs completed + hours, open overdue. READ-ONLY.
 * Run: node --env-file=.env.local scripts/task-receipts.mjs "Deryk" "Michael Johnson"
 */
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: users } = await s.from("users").select("id, full_name, is_active");
const { data: items } = await s.from("work_items").select("id, title, assigned_to, status, due_date, manual_due_date, completed_date, estimated_hours, actual_hours, estimated_document_count");

for (const name of process.argv.slice(2)) {
  const u = users.find((x) => x.is_active && x.full_name.toLowerCase().includes(name.toLowerCase()));
  if (!u) continue;
  const mine = items.filter((i) => i.assigned_to === u.id);
  console.log(`\n=== ${u.full_name} ===`);
  console.log("DONE tasks:");
  for (const t of mine.filter((i) => i.status === "done")) {
    const due = t.due_date ?? t.manual_due_date;
    const late = due && t.completed_date && t.completed_date.slice(0, 10) > due.slice(0, 10);
    console.log(
      `  - ${t.title} · due ${due ?? "none"} · completed ${t.completed_date?.slice(0, 10) ?? "?"}${late ? "  << LATE" : due ? "  (on time)" : ""} · est ${t.estimated_hours ?? "-"}h actual ${t.actual_hours ?? "-"}h · docs ${t.estimated_document_count ?? "-"}`
    );
  }
  console.log("OPEN tasks:");
  const today = new Date().toISOString().slice(0, 10);
  for (const t of mine.filter((i) => i.status !== "done")) {
    const due = t.due_date ?? t.manual_due_date;
    const overdue = due && due.slice(0, 10) < today;
    console.log(
      `  - ${t.title} · status ${t.status} · due ${due ?? "none"}${overdue ? "  << OVERDUE" : ""} · est ${t.estimated_hours ?? "-"}h actual ${t.actual_hours ?? "-"}h`
    );
  }
}
