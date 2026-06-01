// Diagnostic: run the new parseMakovetzkiWorkbook against the Hana Rovina
// file and verify the in-app importer would now handle it cleanly.

import * as fs from "fs";
import { parseMakovetzkiWorkbook } from "../lib/xlsx";

const PATHS = [
  "C:\\Users\\itzik\\AppData\\Local\\Temp\\חנה רובינא 11 טבלת סטטוס (1).xlsx",
  "C:\\Users\\itzik\\AppData\\Local\\Temp\\חנה רובינא 11 טבלת סטטוס למערכת (1).csv"
];

for (const path of PATHS) {
  if (!fs.existsSync(path)) {
    console.log(`(missing) ${path}`);
    continue;
  }
  const bytes = new Uint8Array(fs.readFileSync(path));
  const r = parseMakovetzkiWorkbook(bytes);
  console.log(`\n=== ${path} ===`);
  if (!r.ok) {
    console.log(`  error: ${r.error}`);
    continue;
  }
  console.log(`  rows: ${r.rows.length} · skipped: ${r.skipped.length}`);
  for (const s of r.skipped) console.log(`    skip R${s.row}: ${s.reason}`);
  const byCat = new Map<string, number>();
  for (const row of r.rows) {
    byCat.set(row.category || "(ללא קטגוריה)", (byCat.get(row.category || "(ללא קטגוריה)") ?? 0) + 1);
  }
  for (const [cat, count] of byCat) {
    console.log(`    [${cat}] ${count}`);
  }
}
