/** Detect missing QA Center tables (migration not applied yet). */
export function isQaCenterTableUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("schema cache");
}

export function qaCenterTablesMissingMessage(): string {
  return "QA Center tables are not migrated yet. Apply migrations 042_qa_center_platform.sql and 043_qa_knowledge_library.sql in Supabase.";
}
