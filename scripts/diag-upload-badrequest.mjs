/**
 * Diagnose Kelsie's "Bad Request" on task-file upload. Read-mostly:
 * inspects bucket config, then uploads tiny probes to task-files under a
 * diagnostics/ prefix (mirroring the app's sanitized key format) and removes
 * them. Prints the exact storage error message per probe.
 *
 * Run: node --env-file=.env.local scripts/diag-upload-badrequest.mjs
 */
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mirror src/lib/files/task-files.ts
function sanitizeFileName(name) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

console.log("=== bucket config ===");
const { data: bucket, error: bErr } = await s.storage.getBucket("task-files");
if (bErr) console.log("getBucket error:", bErr.message);
else
  console.log({
    name: bucket.name,
    public: bucket.public,
    file_size_limit: bucket.file_size_limit,
    allowed_mime_types: bucket.allowed_mime_types,
  });

const probes = [
  { label: "plain hyphen part name", name: "2025 Toyota Tacoma [HEV] (APA 1)-part-3.pdf", type: "application/pdf", size: 64 },
  { label: "EN-DASH part name (Word autocorrect)", name: "2025 Toyota Tacoma [HEV] (AEB 2)–part-9.pdf", type: "application/pdf", size: 64 },
  { label: "empty mime type (drag from some apps)", name: "2025 Toyota Tacoma [HEV] (FRS)-part-1.pdf", type: "application/octet-stream", size: 64 },
  { label: "1.2MB pdf-typed buffer", name: "2025 Toyota Tacoma [HEV] (WSC)-part-2.pdf", type: "application/pdf", size: 1_200_000 },
  { label: "zero-byte file", name: "2025 Toyota Tacoma [HEV] (NV)-part-1.pdf", type: "application/pdf", size: 0 },
];

const cleanup = [];
for (const probe of probes) {
  const key = `diagnostics/${Date.now()}-${sanitizeFileName(probe.name)}`;
  const buffer = Buffer.alloc(probe.size, 37);
  const { error } = await s.storage
    .from("task-files")
    .upload(key, buffer, { contentType: probe.type, upsert: false });
  console.log(
    `${error ? "FAIL" : "ok  "} ${probe.label}: ${error ? error.message : key}`
  );
  if (!error) cleanup.push(key);
}
if (cleanup.length) {
  await s.storage.from("task-files").remove(cleanup);
  console.log(`cleaned up ${cleanup.length} probe object(s)`);
}
