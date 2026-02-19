import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { adminQuery, type GraphQLResponse } from "../../shopify-admin.js";
import { disconnect } from "../../shopify-auth.js";
import { sleep } from "../../shared/helpers.js";
import type { ProductUpdateSeoMutation } from "../../../app/types/admin.generated.js";

const DRY_RUN = false;
const CONCURRENCY = 5;
const SLEEP_MS = 100;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = `${scriptDir}/progress.json`;

interface EnProductEntry {
  GID: string;
  metatitle: string;
  metadescription: string;
}

interface SEOFields {
  title?: string;
  description?: string;
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

function buildSEO(entry: EnProductEntry): SEOFields | null {
  const seo: SEOFields = {};
  if (entry.metatitle) seo.title = entry.metatitle;
  if (entry.metadescription) seo.description = entry.metadescription;
  return Object.keys(seo).length > 0 ? seo : null;
}

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation productUpdateSeo($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        seo {
          title
          description
        }
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

  // Filter out already-processed and entries with no SEO data
  const toProcess = products.filter((p) => {
    if (processedSet.has(p.GID)) return false;
    return buildSEO(p) !== null;
  });

  const skippedEmpty = products.filter((p) => !processedSet.has(p.GID) && buildSEO(p) === null).length;

  console.log(`=== Update Product SEO Metadata ===`);
  console.log(`Total products: ${products.length}`);
  console.log(`Already processed: ${products.length - toProcess.length - skippedEmpty}`);
  console.log(`Skipped (no SEO data): ${skippedEmpty}`);
  console.log(`To process: ${toProcess.length}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log();

  if (DRY_RUN) {
    console.log("--- DRY RUN ---");
    for (const product of toProcess) {
      const seo = buildSEO(product)!;
      const parts: string[] = [];
      if (seo.title) parts.push(`title="${seo.title}"`);
      if (seo.description) parts.push(`description="${seo.description.slice(0, 60)}..."`);
      console.log(`Would update ${product.GID} SEO: ${parts.join(", ")}`);
    }
    console.log(`\nTotal: ${toProcess.length} products would be updated`);
    return;
  }

  try {
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
      const batch = toProcess.slice(i, i + CONCURRENCY);

      const results = await Promise.all(
        batch.map(async (product) => {
          const seo = buildSEO(product)!;
          try {
            const response: GraphQLResponse<ProductUpdateSeoMutation> = await adminQuery(PRODUCT_UPDATE_MUTATION, {
              product: {
                id: product.GID,
                seo,
              },
            });

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
