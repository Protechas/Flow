// Phase 0 feasibility: do production task PDFs have readable text layers?
// READ-ONLY: downloads a sample of uploads, extracts text, reports. No writes.
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: files, error } = await s
  .from("task_file_uploads")
  .select("id, file_name, file_size, storage_path, task_id")
  .ilike("file_name", "%.pdf")
  .not("storage_path", "is", null)
  .order("uploaded_at", { ascending: false })
  .limit(10);
if (error) throw error;

const { data: tasks } = await s
  .from("work_items")
  .select("id, title")
  .in("id", [...new Set(files.map((f) => f.task_id))]);
const taskTitle = (id) => tasks?.find((t) => t.id === id)?.title ?? "?";

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

async function extractText(buffer, maxPages = 3) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  let text = "";
  const pages = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => i.str).join(" ") + "\n";
  }
  return { numPages: doc.numPages, text };
}

console.log(`sampling ${files.length} recent PDFs...\n`);
let withText = 0;
for (const f of files) {
  try {
    const { data: blob, error: dlErr } = await s.storage.from("task-files").download(f.storage_path);
    if (dlErr) { console.log(`  DL-FAIL ${f.file_name}: ${dlErr.message}`); continue; }
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { numPages, text } = await extractText(buffer);
    const clean = text.replace(/\s+/g, " ").trim();
    const hasText = clean.length > 100;
    if (hasText) withText++;
    // Identity probe: do task-title tokens appear in the content?
    const tokens = taskTitle(f.task_id).toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const hits = tokens.filter((t) => clean.toLowerCase().includes(t));
    console.log(
      `  ${hasText ? "TEXT" : "SCAN?"} ${String(numPages).padStart(3)}p ${(f.file_size / 1024).toFixed(0).padStart(5)}KB chars=${String(clean.length).padStart(6)} title-match=${hits.length}/${tokens.length} :: ${f.file_name.slice(0, 50)} [task: ${taskTitle(f.task_id).slice(0, 20)}]`
    );
    if (hasText) console.log(`         sample: ${clean.slice(0, 140)}`);
  } catch (e) {
    console.log(`  ERROR ${f.file_name}: ${e.message.slice(0, 80)}`);
  }
}
console.log(`\n${withText}/${files.length} PDFs have extractable text layers`);
