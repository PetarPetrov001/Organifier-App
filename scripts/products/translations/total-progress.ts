import { readdirSync, readFileSync, existsSync } from "fs";
import { parse } from "csv-parse/sync";
import { resolvePath } from "scripts/shared/helpers";

const inputDir = resolvePath(import.meta.url, "products/translationInputFiles");
const outputDir = resolvePath(import.meta.url, "products/translationOutputs");

const inputLocales = readdirSync(inputDir).filter((file) => file.endsWith(".csv"));

let totalProducts = 0;
let totalTranslated = 0;

for (const locale of inputLocales) {
  const localeName = locale.replace(".csv", "");
  const inputPath = `${inputDir}/${locale}`;
  const outputPath = `${outputDir}/${localeName}/translated.json`;

  const rows = parse(readFileSync(inputPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  });
  const inputCount = rows.length;

  let translatedCount = 0;
  if (existsSync(outputPath)) {
    const output = JSON.parse(readFileSync(outputPath, "utf-8"));
    const uniqueIds = new Set(output.entries.map((e: any) => e.resourceId));
    translatedCount = uniqueIds.size;
  }

  const pct = inputCount > 0 ? ((translatedCount / inputCount) * 100).toFixed(1) : "0.0";
  console.log(`${localeName.padEnd(6)} ${String(translatedCount).padStart(6)} / ${String(inputCount).padStart(6)}  (${pct.padStart(5)}%)`);

  totalProducts += inputCount;
  totalTranslated += translatedCount;
}

const totalPct = totalProducts > 0 ? ((totalTranslated / totalProducts) * 100).toFixed(1) : "0.0";
console.log("─".repeat(40));
console.log(`${"TOTAL".padEnd(6)} ${String(totalTranslated).padStart(6)} / ${String(totalProducts).padStart(6)}  (${totalPct.padStart(5)}%)`);
