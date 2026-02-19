import { resolvePath } from "../../shared/helpers.js";
import { runTranslations } from "../../shared/translation-runner.js";

const LOCALES = [
  "cs", "da", "de", "el", "es", "fi", "fr", "hr", "hu", "it", "lt",
  "nl", "pl", "pt-pt", "ro", "sk", "sl", "sv"
];

for (const locale of LOCALES) {
  console.log(`\n========== Starting locale: ${locale} ==========\n`);

  await runTranslations({
    locale,
    inputCsvPath: resolvePath(import.meta.url, `metaDataTranslations/input/${locale}.csv`),
    resourcesJsonPath: resolvePath(import.meta.url, "metaDataTranslations/product-meta-translation-resources.json"),
    progressJsonPath: resolvePath(import.meta.url, `metaDataTranslations/output/${locale}/translated.json`),
    dryRun: false,
    sleepMs: 20,
    maxRetries: 6,
    label: "Product Meta",
    gidColumn: "GID",
    concurrency: 4,
    csvKeyMap: [
      { csvColumn: "metatitle", shopifyKey: "meta_title" },
      { csvColumn: "metadescription", shopifyKey: "meta_description" },
    ],
  });
}
