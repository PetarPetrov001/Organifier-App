import { readFileSync } from "fs";
import { resolvePath } from "../../../shared/helpers.js";
import { runTranslations } from "../../../shared/translation-runner.js";

const LOCALES = [
  "bg", "cs", "da", "de", "el", "es", "fi", "fr", "hr", "hu", "it", "lt",
  "nl", "pl", "pt-pt", "ro", "sk", "sl", "sv"
];

const gidMap: Record<string, string> = JSON.parse(
  readFileSync(resolvePath(import.meta.url, "translations/data/product-to-metafield.json"), "utf-8"),
);

for (const locale of LOCALES) {
  console.log(`\n========== Starting locale: ${locale} ==========\n`);

  await runTranslations({
    locale,
    inputCsvPath: resolvePath(import.meta.url, `translations/input/${locale}.csv`),
    resourcesJsonPath: resolvePath(import.meta.url, "translations/data/feature-list-translatable-resources.json"),
    progressJsonPath: resolvePath(import.meta.url, `translations/output/${locale}/translated.json`),
    dryRun: false,
    sleepMs: 20,
    maxRetries: 6,
    label: "Feature List Metafield",
    gidColumn: "GID",
    concurrency: 6,
    gidMap,
    csvKeyMap: [
      { csvColumn: "short_description", shopifyKey: "value" },
    ],
  });
}
