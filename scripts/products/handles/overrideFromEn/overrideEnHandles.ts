import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { adminQuery, type GraphQLResponse } from "../../../shared/shopify-client.js";
import { disconnect } from "../../../shared/shopify-auth.js";
import { sleep } from "../../../shared/helpers.js";
import type { ProductUpdateMutation } from "../../../../app/types/admin.generated.js";

const DRY_RUN = false;
const CONCURRENCY = 10;
const SLEEP_MS = 200;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = `${scriptDir}/progress.json`;

interface EnProductEntry {
  id: string;
  handle: string;
}

interface ProgressEntry {
  productId: string;
  handle: string;
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

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation productUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
` as const;

async function main() {
  const products: EnProductEntry[] = JSON.parse(
    readFileSync(new URL("./en.json", import.meta.url), "utf-8"),
  );

  const progress = loadProgress();
  const processedSet = new Set(
    progress.entries.filter((e) => e.status === "success").map((e) => e.productId),
  );

  const toProcess = products.filter((p) => !processedSet.has(p.id));

  console.log(`=== Override Product Handles from EN ===`);
  console.log(`Total products: ${products.length}`);
  console.log(`Already processed: ${products.length - toProcess.length}`);
  console.log(`To process: ${toProcess.length}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log();

  if (DRY_RUN) {
    console.log("--- DRY RUN ---");
    for (const product of toProcess) {
      console.log(`Would update ${product.id} handle to "${product.handle}" (redirectNewHandle: true)`);
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
            const response: GraphQLResponse<ProductUpdateMutation> = await adminQuery(PRODUCT_UPDATE_MUTATION, {
              product: {
                id: product.id,
                handle: product.handle,
                redirectNewHandle: true,
              },
            });

            if (response.errors) {
              const errorMsg = response.errors.map((e) => e.message).join("; ");
              return { productId: product.id, handle: product.handle, status: "failed" as const, error: errorMsg };
            }

            const { userErrors } = response.data!.productUpdate!;
            if (userErrors.length > 0) {
              const errorMsg = userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
              return { productId: product.id, handle: product.handle, status: "failed" as const, error: errorMsg };
            }

            return { productId: product.id, handle: product.handle, status: "success" as const };
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { productId: product.id, handle: product.handle, status: "failed" as const, error: errorMsg };
          }
        }),
      );

      for (const result of results) {
        progress.entries.push({
          productId: result.productId,
          handle: result.handle,
          status: result.status,
          ...(result.error ? { error: result.error } : {}),
          processedAt: new Date().toISOString(),
        });

        const icon = result.status === "success" ? "OK" : "FAIL";
        console.log(
          `[${i + results.indexOf(result) + 1}/${toProcess.length}] ${icon} ${result.handle}${result.error ? ` — ${result.error}` : ""}`,
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
