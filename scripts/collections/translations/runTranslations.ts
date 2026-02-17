import { resolvePath } from "../../shared/helpers.js";
import { runTranslations } from "../../shared/translation-runner.js";

const LOCALES = [
  "bg", "cs", "da", "de", "el", "es", "fi", "fr", "hr",
  "hu", "it", "lt", "nl", "pl", "pt-pt", "ro", "sk", "sl", "sv",
];

for (const locale of LOCALES) {
  console.log(`\n========== Starting locale: ${locale} ==========\n`);

  await runTranslations({
    locale,
    inputCsvPath: resolvePath(import.meta.url, `translations/translationInputs/${locale}.csv`),
    resourcesJsonPath: resolvePath(import.meta.url, "translations/collection-translation-resources.json"),
    progressJsonPath: resolvePath(import.meta.url, `translations/translationOutputs/${locale}/translated.json`),
    dryRun: false,
    sleepMs: 20,
    maxRetries: 6,
    label: "Collection",
    gidColumn: "ID",
    csvKeyMap: [
      { csvColumn: "Title", shopifyKey: "title" },
      { csvColumn: "DescriptionHTML", shopifyKey: "body_html" },
      { csvColumn: "Handle", shopifyKey: "handle" },
    ],
  });
}
