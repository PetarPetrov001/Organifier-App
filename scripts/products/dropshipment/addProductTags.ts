import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { parse } from "csv-parse/sync";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { resolvePath, sleep } from "scripts/shared/helpers";
import { adminQuery } from "scripts/shared/shopify-client";

const TAGS = ["dropshipment"];
const CONCURRENCY = 10;
const DRY_RUN = false;
const SLEEP_MS = 500;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = `${scriptDir}/progress.json`;

const CSV_FILE = resolvePath(
  import.meta.url,
  "dropshipment/productDropshipment.csv",
);
const SKUS_FILE = resolvePath(import.meta.url, "product-variant-skus.json");

interface ProgressEntry {
  productId: string;
  sku: string;
  status: "success" | "failed";
  error?: string;
  processedAt: string;
}

interface ProgressFile {
  version: 1;
  entries: ProgressEntry[];
}

function loadProgress(): ProgressFile {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { version: 1, entries: [] };
}

function saveProgress(progress: ProgressFile): void {
  mkdirSync(dirname(PROGRESS_FILE), { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

const TAGS_ADD_MUTATION = `#graphql
  mutation tagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
` as const;

interface CsvRow {
  Naam: string;
  Dropshipment: string;
  Artikelnummer: string;
}

interface ProductSkuEntry {
  id: string;
  variantSkus: string;
}

async function main() {
  const csvRows: CsvRow[] = parse(readFileSync(CSV_FILE, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  });

  const skuEntries: ProductSkuEntry[] = JSON.parse(readFileSync(SKUS_FILE, "utf-8"));
  const skuToProductId = new Map<string, string>();
  for (const entry of skuEntries) {
    if (entry.variantSkus) {
      skuToProductId.set(entry.variantSkus, entry.id);
    }
  }

  const csvSkus = csvRows
    .map((row) => row.Artikelnummer.trim())
    .filter((sku) => sku && sku !== "–");

  const matchedProducts: { sku: string; productId: string }[] = [];
  const unmatchedSkus: string[] = [];

  for (const sku of csvSkus) {
    const productId = skuToProductId.get(sku);
    if (productId) {
      matchedProducts.push({ sku, productId });
    } else {
      unmatchedSkus.push(sku);
    }
  }

  console.log(`Total CSV SKUs (valid): ${csvSkus.length}`);
  console.log(`Matched products: ${matchedProducts.length}`);
  console.log(`Unmatched SKUs: ${unmatchedSkus.length}`);
  if (unmatchedSkus.length > 0) {
    console.log("Unmatched:", unmatchedSkus);
  }

  const progress = loadProgress();
  const processedSet = new Set(
    progress.entries.filter((e) => e.status === "success").map((e) => e.productId),
  );

  const toProcess = matchedProducts.filter((p) => !processedSet.has(p.productId));
  console.log(`Already processed: ${matchedProducts.length - toProcess.length}`);
  console.log(`To process: ${toProcess.length}`);

  if (DRY_RUN) {
    console.log("\n--- DRY RUN ---");
    for (const { sku, productId } of toProcess) {
      console.log(`Would add tags ${JSON.stringify(TAGS)} to product ${productId} (SKU: ${sku})`);
    }
    console.log(`\nTotal: ${toProcess.length} products would be updated`);
    return;
  }

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async ({ sku, productId }) => {
        try {
          const response = await adminQuery(TAGS_ADD_MUTATION, {
            id: productId,
            tags: TAGS,
          });

          const cost = response.extensions?.cost;
          if (cost) {
            const { throttleStatus: t } = cost;
            console.log(
              `  Throttle: ${t.currentlyAvailable}/${t.maximumAvailable} available (cost: ${cost.actualQueryCost}, restore: ${t.restoreRate}/s)`,
            );
          }

          if (response.data?.tagsAdd?.userErrors?.length) {
            const errorMsg = response.data.tagsAdd.userErrors
              .map((e) => `${e.field}: ${e.message}`)
              .join("; ");
            return { sku, productId, status: "failed" as const, error: errorMsg };
          }

          return { sku, productId, status: "success" as const };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          return { sku, productId, status: "failed" as const, error: errorMsg };
        }
      }),
    );

    for (const result of results) {
      progress.entries.push({
        productId: result.productId,
        sku: result.sku,
        status: result.status,
        ...(result.error ? { error: result.error } : {}),
        processedAt: new Date().toISOString(),
      });

      const icon = result.status === "success" ? "OK" : "FAIL";
      console.log(
        `[${i + results.indexOf(result) + 1}/${toProcess.length}] ${icon} ${result.productId} (SKU: ${result.sku})${result.error ? ` - ${result.error}` : ""}`,
      );
    }

    saveProgress(progress);

    if (i + CONCURRENCY < toProcess.length) {
      console.log(`  Sleeping ${SLEEP_MS}ms before next batch...`);
      await sleep(SLEEP_MS);
    }
  }

  const successCount = progress.entries.filter((e) => e.status === "success").length;
  const failCount = progress.entries.filter((e) => e.status === "failed").length;
  console.log(`\nDone. Success: ${successCount}, Failed: ${failCount}`);
}

main();
