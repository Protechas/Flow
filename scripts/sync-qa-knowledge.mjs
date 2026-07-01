#!/usr/bin/env node
/**
 * Sync Protech QA reference documents into data/knowledge-library/.
 * Override source paths with QA_KNOWLEDGE_SOURCE_DIR and QA_MC_CHARTS_ZIP env vars.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flowRoot = path.resolve(__dirname, "..");
const destRoot = path.join(flowRoot, "data", "knowledge-library");

const defaultSopDir = path.join("c:", "Protech Files", "SOPs", "SOPs for QA agent");
const defaultMcZip = path.join("c:", "Protech Files", "MC Charts.zip");

const sopSourceDir = process.env.QA_KNOWLEDGE_SOURCE_DIR ?? defaultSopDir;
const mcZipSource = process.env.QA_MC_CHARTS_ZIP ?? defaultMcZip;

const sopFiles = [
  "(1) Service Information Library SOP 07-2022.docx",
  "(2) SI Content SOP 07-2022.docx",
  "(2d) SME Safety System Acronym Definitions 1-30-25.docx",
  "Combined ID³ Map, PCS, & RO Response Templates v2.0.xlsx",
  "SI Library Component SOP 06-2026.docx",
];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${path.basename(dest)}`);
}

function resolveSopSource(name) {
  const direct = path.join(sopSourceDir, name);
  if (fs.existsSync(direct)) return direct;
  const alt = name.replace("ID³", "ID3");
  const altPath = path.join(sopSourceDir, alt);
  if (fs.existsSync(altPath)) return altPath;
  return null;
}

function main() {
  console.log("Syncing QA Center knowledge library…");
  console.log(`  Destination: ${destRoot}`);

  const sopsDest = path.join(destRoot, "sops");
  const mcDest = path.join(destRoot, "mc-charts");
  fs.mkdirSync(sopsDest, { recursive: true });
  fs.mkdirSync(mcDest, { recursive: true });

  console.log("\nSOPs:");
  for (const name of sopFiles) {
    const src = resolveSopSource(name);
    if (!src) {
      console.warn(`  ⚠ Missing: ${name}`);
      continue;
    }
    const destName = path.basename(src).replace("ID³", "ID3");
    copyFile(src, path.join(sopsDest, destName));
  }

  console.log("\nManufacturer charts:");
  if (!fs.existsSync(mcZipSource)) {
    console.warn(`  ⚠ MC Charts zip not found: ${mcZipSource}`);
    return;
  }

  copyFile(mcZipSource, path.join(destRoot, "mc-charts.zip"));

  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${mcZipSource.replace(/'/g, "''")}' -DestinationPath '${mcDest.replace(/'/g, "''")}' -Force"`,
        { stdio: "inherit" }
      );
    } else {
      execSync(`unzip -o "${mcZipSource}" -d "${mcDest}"`, { stdio: "inherit" });
    }
    const count = fs.readdirSync(mcDest).filter((f) => f.endsWith(".xlsx")).length;
    console.log(`  ✓ Extracted ${count} manufacturer charts`);
  } catch (err) {
    console.warn("  ⚠ Could not extract zip automatically — extract mc-charts.zip manually to mc-charts/");
    console.warn(String(err));
  }

  console.log("\nDone. Restart Flow dev server to refresh the Knowledge Library.");
}

main();
