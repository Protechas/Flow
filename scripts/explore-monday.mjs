// READ-ONLY exploration of the Monday export boards.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { readdirSync } from "fs";

const base = "C:/Protech Monday Replacment/monday-data";

function dump(path, maxRows = 6) {
  const wb = XLSX.readFile(path);
  console.log(`\n=== ${path.split("/").pop()} — sheets: ${wb.SheetNames.join(" | ")}`);
  for (const name of wb.SheetNames.slice(0, 2)) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
    console.log(`  [${name}] ${rows.length} rows`);
    for (const r of rows.slice(0, maxRows)) {
      console.log("   ", JSON.stringify(r).slice(0, 220));
    }
  }
}

dump(`${base}/team/ProtechRAD_team_members.xlsx`, 30);
dump(`${base}/boards/7573048871_Bmw 2013-2016.xlsx`, 8);
dump(`${base}/boards/7573964945_Chevrolet 2009-2012.xlsx`, 8);
dump(`${base}/boards/6953888996_Q4 12-2024.xlsx`, 8);

const boards = readdirSync(`${base}/boards`);
console.log(`\ntotal board files: ${boards.length}`);
