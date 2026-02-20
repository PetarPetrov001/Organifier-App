import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { adminQuery, type GraphQLResponse } from "../../../shared/shopify-client.js";
import { disconnect } from "../../../shared/shopify-auth.js";
import { sleep } from "../../../shared/helpers.js";
import type { AddProductVideoMutation } from "../../../../app/types/admin.generated.js";

const DRY_RUN = false;
const CONCURRENCY = 3;
const SLEEP_MS = 300;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = `${scriptDir}/progress.json`;

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

// NOTE: Explicit type annotation needed — TS overload resolution fails for this
// mutation's complex `media: [CreateMediaInput!]` variables type.
const MUTATION = `#graphql
mutation addProductVideo($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
  productUpdate(product: $product, media: $media) {
    product {
      id
      media(first: 10) {
        edges {
          node {
            id
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}` as const;

async function addVideoToProduct(gid: string, videoUrl: string) {
  const response: GraphQLResponse<AddProductVideoMutation> = await adminQuery(MUTATION, {
    product: { id: gid },
    media: [
      {
        mediaContentType: "EXTERNAL_VIDEO",
        originalSource: videoUrl,
      },
    ],
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
    return { productId: gid, status: "failed" as const, error: errorMsg };
  }

  const { userErrors } = response.data!.productUpdate!;
  if (userErrors.length > 0) {
    const errorMsg = userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
    return { productId: gid, status: "failed" as const, error: errorMsg };
  }

  return { productId: gid, status: "success" as const };
}

async function main() {
  const idToVideo: Record<string, string> = JSON.parse(
    readFileSync(new URL("./idToVideo.json", import.meta.url), "utf-8"),
  );

  const entries = Object.entries(idToVideo).filter(([, url]) => url);

  const progress = loadProgress();
  const processedSet = new Set(
    progress.entries.filter((e) => e.status === "success").map((e) => e.productId),
  );

  const toProcess = entries.filter(([gid]) => !processedSet.has(gid));

  console.log(`=== Add External Videos to Products ===`);
  console.log(`Total products: ${entries.length}`);
  console.log(`Already processed: ${entries.length - toProcess.length}`);
  console.log(`To process: ${toProcess.length}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log();

  if (DRY_RUN) {
    console.log("--- DRY RUN ---");
    for (const [gid, url] of toProcess) {
      console.log(`Would add video ${url} to ${gid}`);
    }
    console.log(`\nTotal: ${toProcess.length} products would be updated`);
    return;
  }

  try {
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
      const batch = toProcess.slice(i, i + CONCURRENCY);

      const results = await Promise.all(
        batch.map(([gid, videoUrl]) =>
          addVideoToProduct(gid, videoUrl).catch((err) => ({
            productId: gid,
            status: "failed" as const,
            error: err instanceof Error ? err.message : String(err),
          })),
        ),
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
