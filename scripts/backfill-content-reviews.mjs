// Backfill document_content_reviews for historical task uploads: download
// each stored PDF, run the free content-check layers, upsert one row per
// file. Idempotent (skips files that already have a review row). Newest
// first so recent work gets badges immediately. Run:
//   node --env-file=.env.local scripts/backfill-content-reviews.mjs
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const jiti = require("jiti")(import.meta.url, {
  interopDefault: true,
  alias: { "@": "C:/Protech Monday Replacment/flow/src" },
});
const { runContentChecksOnSet, classifyHighlightColor } = jiti("@/lib/content-checks/engine");
const { DEFAULT_CONTENT_RULES } = jiti("@/lib/content-checks/rules");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function extract(fileName, buffer) {
  const base = { fileName, fileSizeBytes: buffer.length, numPages: 0, landscapePages: 0, text: "", hasTextLayer: false, highlights: [] };
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  } catch { return base; }
  base.numPages = doc.numPages;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    try {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1, rotation: page.rotate });
      if (vp.width > vp.height) base.landscapePages++;
      if (p <= 6) {
        const content = await page.getTextContent();
        text += content.items.map((i) => i.str ?? "").join(" ") + "\n";
      }
      const annotations = await page.getAnnotations();
      for (const a of annotations) {
        if (a.subtype === "Highlight") {
          base.highlights.push({ page: p, colorGroup: classifyHighlightColor(a.color ? Array.from(a.color) : null) });
        }
      }
    } catch { /* page-level tolerance */ }
  }
  base.text = text;
  base.hasTextLayer = text.replace(/\s+/g, "").length > 100;
  try { await doc.destroy(); } catch { /* noop */ }
  return base;
}

// Supabase caps selects at 1000 rows — page through everything.
async function fetchAll(table, columns, apply) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(columns).range(from, from + 999);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const existing = await fetchAll("document_content_reviews", "file_id");
const done = new Set(existing.map((r) => r.file_id));

const uploads = await fetchAll(
  "task_file_uploads",
  "id, task_id, project_id, user_id, file_name, storage_path, uploaded_at",
  (q) => q.ilike("file_name", "%.pdf").not("storage_path", "is", null).order("uploaded_at", { ascending: false })
);

const pending = (uploads ?? []).filter((u) => !done.has(u.id));
console.log(`${uploads?.length ?? 0} stored PDFs, ${done.size} already reviewed, ${pending.length} to backfill`);

// Group by task so -Part-N sets are judged together, like live checks do.
const byTask = new Map();
for (const u of pending) byTask.set(u.task_id, [...(byTask.get(u.task_id) ?? []), u]);

let processed = 0, failed = 0, taskN = 0;
for (const [taskId, files] of byTask) {
  taskN++;
  const extracted = [];
  const byName = new Map();
  for (const f of files) {
    const { data: blob, error } = await sb.storage.from("task-files").download(f.storage_path);
    if (error || !blob) { failed++; continue; }
    byName.set(f.file_name, f);
    extracted.push(await extract(f.file_name, Buffer.from(await blob.arrayBuffer())));
  }
  if (extracted.length === 0) continue;

  const results = runContentChecksOnSet(extracted, DEFAULT_CONTENT_RULES);
  const now = new Date().toISOString();
  const rows = [];
  for (const logical of results) {
    for (const partName of logical.partFiles) {
      const u = byName.get(partName);
      if (!u) continue;
      rows.push({
        file_id: u.id,
        task_id: taskId,
        project_id: u.project_id ?? null,
        uploader_id: u.user_id ?? null,
        file_name: u.file_name,
        verdict: logical.result.verdict,
        flags: logical.result.flags,
        is_placeholder: logical.result.isPlaceholder,
        source: "backfill",
        checked_at: now,
      });
    }
  }
  if (rows.length) {
    const { error } = await sb.from("document_content_reviews").upsert(rows, { onConflict: "file_id" });
    if (error) { console.error(`upsert failed task ${taskId}: ${error.message}`); failed += rows.length; }
    else processed += rows.length;
  }
  if (taskN % 5 === 0 || processed % 200 < rows.length) {
    console.log(`progress: ${processed} reviewed, ${failed} failed, task ${taskN}/${byTask.size}`);
  }
}
console.log(`DONE: ${processed} files reviewed, ${failed} failed`);
