import { resolvePath } from "../../shared/helpers.js";
import { runTranslations } from "../../shared/translation-runner.js";

const LOCALE = "lt";

await runTranslations({
  locale: LOCALE,
  inputCsvPath: resolvePath(import.meta.url, `products/translations/translationInputFiles/${LOCALE}.csv`),
  resourcesJsonPath: resolvePath(import.meta.url, "products/translations/product-translation-resources.json"),
  progressJsonPath: resolvePath(import.meta.url, `products/translations/translationOutputs/${LOCALE}/translated.json`),
  dryRun: false,
  sleepMs: 20,
  maxRetries: 6,
  label: "Product",
  csvKeyMap: [
    { csvColumn: "Title", shopifyKey: "title" },
    { csvColumn: "Body HTML", shopifyKey: "body_html" },
  ],
});
