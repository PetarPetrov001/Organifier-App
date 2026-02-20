import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { adminQuery } from "../../../shared/shopify-client.js";
import { disconnect } from "../../../shared/shopify-auth.js";
import { sleep } from "../../../shared/helpers.js";

const DRY_RUN = false;
const CONCURRENCY = 5;
const SLEEP_MS = 100;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = `${scriptDir}/progress.json`;

interface ProductFeatureEntry {
  GID: string;
  short_description: string;
}

interface ProgressEntry {
  productId: string;
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

const MUTATION = `#graphql
mutation updateProductFeatureList($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product {
      id
      featureList: metafield(namespace: "custom", key: "feature_list") {
        jsonValue
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

async function main() {
  const products: ProductFeatureEntry[] = JSON.parse(
    readFileSync(new URL("./en.json", import.meta.url), "utf-8"),
  );

  const progress = loadProgress();
  const processedSet = new Set(
    progress.entries.filter((e) => e.status === "success").map((e) => e.productId),
  );

  const toProcess = products.filter((p) => {
    if (processedSet.has(p.GID)) return false;
    if (!p.short_description) return false;
    // Validate it's a parseable JSON array
    try {
      const parsed = JSON.parse(p.short_description);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  });

  const skippedEmpty = products.filter(
    (p) => !processedSet.has(p.GID) && (!p.short_description || (() => {
      try { const parsed = JSON.parse(p.short_description); return !Array.isArray(parsed) || parsed.length === 0; } catch { return true; }
    })()),
  ).length;

  console.log(`=== Set Product Feature Lists ===`);
  console.log(`Total products: ${products.length}`);
  console.log(`Already processed: ${products.length - toProcess.length - skippedEmpty}`);
  console.log(`Skipped (no feature data): ${skippedEmpty}`);
  console.log(`To process: ${toProcess.length}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log();

  if (DRY_RUN) {
    console.log("--- DRY RUN ---");
    for (const product of toProcess) {
      const features: string[] = JSON.parse(product.short_description);
      console.log(`Would set ${features.length} features on ${product.GID}`);
    }
    console.log(`\nTotal: ${toProcess.length} products would be updated`);
    return;
  }

  try {
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
      const batch = toProcess.slice(i, i + CONCURRENCY);

      const results = await Promise.all(
        batch.map(async (product) => {
          try {
            const features: string[] = JSON.parse(product.short_description);

            const response = await adminQuery(MUTATION, {
              product: {
                id: product.GID,
                metafields: [
                  {
                    namespace: "custom",
                    key: "feature_list",
                    type: "list.single_line_text_field",
                    value: JSON.stringify(features),
                  },
                ],
              },
            });

            const cost = response.extensions?.cost;
            if (cost) {
              const { throttleStatus: t } = cost;
              console.log(
                `  Throttle: ${t.currentlyAvailable}/${t.maximumAvailable} available (cost: ${cost.actualQueryCost}, restore: ${t.restoreRate}/s)`,
              );
            }

            if (response.errors) {
              const errorMsg = response.errors.map((e) => e.message).join("; ");
              return { productId: product.GID, status: "failed" as const, error: errorMsg };
            }

            const { userErrors } = response.data!.productUpdate!;
            if (userErrors.length > 0) {
              const errorMsg = userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
              return { productId: product.GID, status: "failed" as const, error: errorMsg };
            }

            return { productId: product.GID, status: "success" as const };
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { productId: product.GID, status: "failed" as const, error: errorMsg };
          }
        }),
      );

      for (const result of results) {
        progress.entries.push({
          productId: result.productId,
          status: result.status,
          ...(result.error ? { error: result.error } : {}),
          processedAt: new Date().toISOString(),
        });

        const icon = result.status === "success" ? "OK" : "FAIL";
        console.log(
          `[${i + results.indexOf(result) + 1}/${toProcess.length}] ${icon} ${result.productId}${result.error ? ` — ${result.error}` : ""}`,
        );
      }

      saveProgress(progress);

      if (i + CONCURRENCY < toProcess.length) {
        console.log(`  Sleeping ${SLEEP_MS}ms before next batch...`);
        await sleep(SLEEP_MS);
      }
    }
  } finally {
    await disconnect();
  }

  const successCount = progress.entries.filter((e) => e.status === "success").length;
  const failCount = progress.entries.filter((e) => e.status === "failed").length;
  console.log(`\nDone. Success: ${successCount}, Failed: ${failCount}`);
}

main();
