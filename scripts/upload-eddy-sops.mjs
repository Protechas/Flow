// One-off: file Eddy's QA-standard SOPs into the Flow document library as
// PROTECTED documents inside a dedicated locked folder. Idempotent by title.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DUSTY = "3c01e08d-1c90-4062-9b4d-4db248d7a6a0";
const FOLDER_NAME = "Eddy — QA Standards (locked)";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.ms-excel";

const FILES = [
  ["C:/Protech Files/SOPs/SOPs for QA agent/(1) Service Information Library SOP 07-2022.docx", "SI Library SOP (Eddy standard)", DOCX],
  ["C:/Protech Files/SOPs/SOPs for QA agent/(2) SI Content SOP 07-2022.docx", "SI Content SOP (Eddy standard)", DOCX],
  ["C:/Protech Files/SOPs/SOPs for QA agent/(2d) SME Safety System Acronym Definitions 1-30-25.docx", "SME Safety System Acronym Definitions (Eddy standard)", DOCX],
  ["C:/Protech Files/SOPs/SOPs for QA agent/SI Library Component SOP 06-2026.docx", "SI Library Component SOP 06-2026 (Eddy standard)", DOCX],
  ["C:/Protech Files/SOPs/SOPs for QA agent/Combined ID³ Map, PCS, & RO Response Templates v2.0.xlsx", "Combined ID³ Map, PCS & RO Response Templates v2.0 (Eddy standard)", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
];

// Folder: reuse if it exists.
let { data: folder } = await s.from("document_folders").select("id").eq("name", FOLDER_NAME).maybeSingle();
if (!folder) {
  const res = await s
    .from("document_folders")
    .insert({ name: FOLDER_NAME, parent_id: null, created_by: DUSTY })
    .select("id")
    .single();
  if (res.error) throw res.error;
  folder = res.data;
  console.log("created folder:", FOLDER_NAME);
}

for (const [path, title, mime] of FILES) {
  const { data: existing } = await s.from("company_documents").select("id").eq("title", title).maybeSingle();
  if (existing) { console.log(`skip (exists): ${title}`); continue; }

  const buffer = readFileSync(path);
  const id = randomUUID();
  const fileName = path.split("/").pop();
  const safeName = fileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
  const storagePath = `${DUSTY}/${id}-${safeName}`;

  const up = await s.storage.from("company-documents").upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (up.error) { console.log(`UPLOAD FAIL ${title}: ${up.error.message}`); continue; }

  const ins = await s.from("company_documents").insert({
    id,
    title,
    description: "Locked QA standard — this document guides Eddy's content reviews. Admin-only edits.",
    category: "sop",
    folder_id: folder.id,
    tags: ["eddy", "qa-standard"],
    file_name: fileName,
    storage_path: storagePath,
    file_size: buffer.length,
    mime_type: mime,
    uploaded_by: DUSTY,
    is_protected: true,
  });
  if (ins.error) {
    await s.storage.from("company-documents").remove([storagePath]);
    console.log(`INSERT FAIL ${title}: ${ins.error.message}`);
  } else {
    console.log(`filed: ${title} (${Math.round(buffer.length / 1024)}KB)`);
  }
}

const { data: check } = await s
  .from("company_documents")
  .select("title, is_protected")
  .eq("folder_id", folder.id);
console.log(`\nfolder now holds ${check?.length} protected docs`);
