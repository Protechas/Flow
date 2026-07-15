// Live test: Eddy reads TWO real production documents — one that should pass
// (correct doc for its label) and one deliberately mislabeled (wrong-vehicle
// test). One-off Haiku calls, ~1-2 cents total. READ-ONLY on data.
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(import.meta.url, { interopDefault: true, alias: { "@": "C:/Protech Monday Replacment/flow/src" } });
const { eddyReviewContent } = jiti("@/lib/ai/content-review");

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function extractText(buffer, maxPages = 6) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  let text = "";
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => i.str ?? "").join(" ") + "\n";
  }
  return text;
}

const { data: files } = await s
  .from("task_file_uploads")
  .select("file_name, storage_path")
  .ilike("file_name", "%Part-1.pdf")
  .not("storage_path", "is", null)
  .order("uploaded_at", { ascending: false })
  .limit(1);

const f = files[0];
const { data: blob } = await s.storage.from("task-files").download(f.storage_path);
const text = await extractText(Buffer.from(await blob.arrayBuffer()));
console.log(`doc: ${f.file_name} (${text.length} chars extracted)\n`);

console.log("=== TEST 1: correct label (should look right) ===");
const honest = await eddyReviewContent({ fileName: f.file_name, claim: f.file_name.replace(/\.pdf$/i, ""), text });
console.log(JSON.stringify(honest, null, 1));

console.log("\n=== TEST 2: same content, WRONG label (should catch it) ===");
const lied = await eddyReviewContent({
  fileName: "2024 Honda Civic (BUC).pdf",
  claim: "2024 Honda Civic (BUC) — backup camera",
  text,
});
console.log(JSON.stringify(lied, null, 1));
