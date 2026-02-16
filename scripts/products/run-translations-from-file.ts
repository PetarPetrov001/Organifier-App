import { resolvePath } from "../shared/helpers.js";
import { runTranslations } from "../shared/translation-runner.js";

const LOCALE = "sk";

await runTranslations({
  locale: LOCALE,
  inputCsvPath: resolvePath(import.meta.url, `products/translationInputFiles/${LOCALE}.csv`),
  resourcesJsonPath: resolvePath(import.meta.url, "products/product-translation-resources.json"),
  progressJsonPath: resolvePath(import.meta.url, `products/translationOutputs/${LOCALE}/translated.json`),
  dryRun: false,
  sleepMs: 20,
  maxRetries: 6,
  label: "Product",
  csvKeyMap: [
    { csvColumn: "Title", shopifyKey: "title" },
    { csvColumn: "Body HTML", shopifyKey: "body_html" },
  ],
});
