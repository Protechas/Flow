// Accuracy harness: run the REAL content-check engine against real production
// PDFs (read-only download). Compiles the TS engine via tsx-less trick: we
// re-implement only extraction here and import the engine through a ts-node
// alternative — instead, simplest: this script mirrors extract-browser using
// pdfjs legacy, then dynamically imports the built engine via jiti.
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const jiti = require("jiti")(import.meta.url, { interopDefault: true, alias: { "@": "C:/Protech Monday Replacment/flow/src" } });
const { runContentChecksOnSet, classifyHighlightColor } = jiti("@/lib/content-checks/engine");
const { DEFAULT_CONTENT_RULES } = jiti("@/lib/content-checks/rules");

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  return base;
}

const { data: files } = await s
  .from("task_file_uploads")
  .select("file_name, file_size, storage_path")
  .ilike("file_name", "%.pdf")
  .not("storage_path", "is", null)
  .order("uploaded_at", { ascending: false })
  .limit(12);

const extracted = [];
for (const f of files) {
  const { data: blob, error } = await s.storage.from("task-files").download(f.storage_path);
  if (error) { console.log(`DL-FAIL ${f.file_name}`); continue; }
  extracted.push(await extract(f.file_name, Buffer.from(await blob.arrayBuffer())));
}

for (const g of runContentChecksOnSet(extracted, DEFAULT_CONTENT_RULES)) {
  console.log(`\n${g.result.verdict.toUpperCase().padEnd(10)} ${g.baseName} (${g.partFiles.length} part${g.partFiles.length === 1 ? "" : "s"}, ${g.totalPages}p)`);
  for (const flag of g.result.flags) console.log(`  [${flag.severity}] ${flag.code}: ${flag.message.slice(0, 120)}`);
  if (g.result.flags.length === 0) console.log("  clean");
}
