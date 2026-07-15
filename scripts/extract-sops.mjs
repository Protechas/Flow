// READ-ONLY: extract text from the QA-agent SOP docx/xlsx set for rule distillation.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mammoth = require("mammoth");
const XLSX = require("xlsx");
import { writeFileSync, mkdirSync } from "fs";

const outDir = "C:/Users/dusty/AppData/Local/Temp/claude/C--Protech-Monday-Replacment/5499cd03-7b33-4e73-8dc3-0804d2ec84da/scratchpad/sops";
mkdirSync(outDir, { recursive: true });

const docx = [
  ["C:/Protech Files/SOPs/SOPs for QA agent/(1) Service Information Library SOP 07-2022.docx", "1-si-library-sop.txt"],
  ["C:/Protech Files/SOPs/SOPs for QA agent/(2) SI Content SOP 07-2022.docx", "2-si-content-sop.txt"],
  ["C:/Protech Files/SOPs/SOPs for QA agent/(2d) SME Safety System Acronym Definitions 1-30-25.docx", "2d-acronyms.txt"],
  ["C:/Protech Files/SOPs/SOPs for QA agent/SI Library Component SOP 06-2026.docx", "component-sop.txt"],
];

for (const [path, out] of docx) {
  try {
    const { value } = await mammoth.extractRawText({ path });
    writeFileSync(`${outDir}/${out}`, value);
    console.log(`${out}: ${value.length} chars`);
  } catch (e) {
    console.log(`${out}: FAILED ${e.message.slice(0, 80)}`);
  }
}

const wb = XLSX.readFile("C:/Protech Files/SOPs/SOPs for QA agent/Combined ID³ Map, PCS, & RO Response Templates v2.0.xlsx");
console.log("\nxlsx sheets:", wb.SheetNames.join(" | "));
let xout = "";
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
  xout += `\n===== SHEET: ${name} (${rows.length} rows) =====\n`;
  for (const r of rows.slice(0, 60)) xout += JSON.stringify(r).slice(0, 400) + "\n";
}
writeFileSync(`${outDir}/id3-templates.txt`, xout);
console.log("id3-templates.txt written");
