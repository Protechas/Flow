// Live test: full model-report pipeline on real production docs. ~2 cents.
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(import.meta.url, { interopDefault: true, alias: { "@": "C:/Protech Monday Replacment/flow/src" } });
const { runContentChecksOnSet, analyzeModelCoverage, classifyHighlightColor } = jiti("@/lib/content-checks/engine");
const { DEFAULT_CONTENT_RULES } = jiti("@/lib/content-checks/rules");
const { eddyModelReport } = jiti("@/lib/ai/content-review");

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function extract(fileName, buffer) {
  const base = { fileName, fileSizeBytes: buffer.length, numPages: 0, landscapePages: 0, text: "", hasTextLayer: false, highlights: [] };
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise; } catch { return base; }
  base.numPages = doc.numPages;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    try {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1, rotation: page.rotate });
      if (vp.width > vp.height) base.landscapePages++;
      if (p <= 6) {
        const content = await page.getTextContent();
        text += content.items.map((i) => i.str ?? "").join(" ") + " ";
      }
      for (const a of await page.getAnnotations()) {
        if (a.subtype === "Highlight") base.highlights.push({ page: p, colorGroup: classifyHighlightColor(a.color ? Array.from(a.color) : null) });
      }
    } catch {}
  }
  base.text = text;
  base.hasTextLayer = text.replace(/\s+/g, "").length > 100;
  return base;
}

const { data: files } = await s
  .from("task_file_uploads")
  .select("file_name, storage_path")
  .ilike("file_name", "%Lexus RC300%")
  .not("storage_path", "is", null)
  .limit(30);
console.log(`downloading ${files.length} RC300 files…`);

const extracted = [];
for (const f of files) {
  const { data: blob, error } = await s.storage.from("task-files").download(f.storage_path);
  if (!error) extracted.push(await extract(f.file_name, Buffer.from(await blob.arrayBuffer())));
}

const grouped = runContentChecksOnSet(extracted, DEFAULT_CONTENT_RULES);
const [model] = analyzeModelCoverage(grouped, DEFAULT_CONTENT_RULES);
console.log(`model: ${model.modelLabel} — ${model.docs.length} docs, missing: ${model.missingComponents.join(", ") || "none"}`);

const coverageSummary = [
  ...Object.entries(model.componentsPresent).map(([slot, d]) => `${slot}: covered by ${d.join("; ")}`),
  ...model.missingComponents.map((c) => `${c}: MISSING`),
  ...(model.extraDocs.length ? [`Extra: ${model.extraDocs.join("; ")}`] : []),
].join("\n");

const docLines = model.docs.map((d) => {
  const flags = d.result.flags.map((f) => `[${f.severity}] ${f.message}`).join(" | ") || "clean";
  return `${d.baseName} (${d.partFiles.length} parts) → ${d.result.verdict}: ${flags}`;
});

const report = await eddyModelReport({ modelLabel: model.modelLabel, coverageSummary, docLines });
console.log("\n=== EDDY MODEL REPORT ===");
console.log(JSON.stringify(report, null, 1));
