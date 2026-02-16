import { resolvePath } from "../shared/helpers.js";
import { runTranslations } from "../shared/translation-runner.js";

const LOCALE = "sv";

await runTranslations({
  locale: LOCALE,
  inputCsvPath: resolvePath(import.meta.url, `articles/inputFiles/${LOCALE}.csv`),
  resourcesJsonPath: resolvePath(import.meta.url, "articles/article-translation-resources.json"),
  progressJsonPath: resolvePath(import.meta.url, `articles/outputFiles/${LOCALE}/translated.json`),
  dryRun: false,
  sleepMs: 20,
  maxRetries: 6,
  label: "Article",
  csvKeyMap: [
    { csvColumn: "Title", shopifyKey: "title" },
    { csvColumn: "Content", shopifyKey: "body_html" },
    { csvColumn: "Meta Title", shopifyKey: "meta_title" },
    { csvColumn: "Meta Description", shopifyKey: "meta_description" },
  ],
});
