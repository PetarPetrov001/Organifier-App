import { resolvePath } from "../../../shared/helpers.js";
import { runTranslations } from "../../../shared/translation-runner.js";

const LOCALES = [
  "nl"
];

for (const locale of LOCALES) {
  console.log(`\n========== Starting locale: ${locale} ==========\n`);

  await runTranslations({
    locale,
    inputCsvPath: resolvePath(import.meta.url, `translation/inputs/${locale}.csv`),
    resourcesJsonPath: resolvePath(import.meta.url, "translation/product-handle-translation-resources.json"),
    progressJsonPath: resolvePath(import.meta.url, `translation/outputs/${locale}/translated.json`),
    dryRun: false,
    sleepMs: 20,
    maxRetries: 6,
    label: "Product Handle",
    gidColumn: "GID",
    csvKeyMap: [
      { csvColumn: "Handle", shopifyKey: "handle" },
    ],
  });
}
