/** Read-only: Kelsie's recent uploads + her active task state. */
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: users } = await s.from("users").select("id, full_name").ilike("full_name", "%kelsie%");
const kelsie = users?.[0];
if (!kelsie) { console.log("No Kelsie found"); process.exit(0); }
console.log("user:", kelsie.full_name, kelsie.id);

const { data: uploads } = await s
  .from("task_file_uploads")
  .select("task_id, file_name, file_size, uploaded_at, storage_path")
  .eq("user_id", kelsie.id)
  .order("uploaded_at", { ascending: false })
  .limit(12);
console.log("\n=== last 12 uploads ===");
for (const u of uploads ?? []) {
  console.log(
    `${u.uploaded_at}  ${Math.round(u.file_size / 1024)}KB  storage:${u.storage_path ? "yes" : "NO"}  ${u.file_name.slice(0, 60)}`
  );
}

const taskIds = [...new Set((uploads ?? []).map((u) => u.task_id))];
const { data: tasks } = await s
  .from("work_items")
  .select("id, title, status, file_count, estimated_document_count, current_documents_completed")
  .in("id", taskIds);
console.log("\n=== tasks ===");
for (const t of tasks ?? []) console.log(t);

const { count } = await s
  .from("task_file_uploads")
  .select("id", { count: "exact", head: true })
  .eq("user_id", kelsie.id);
console.log("\ntotal uploads by Kelsie ever:", count);
