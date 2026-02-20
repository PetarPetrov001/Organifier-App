import { adminQuery } from "scripts/shared/shopify-client";
import { readFileSync } from "fs";
import { resolvePath, sleep } from "scripts/shared/helpers";
import { disconnect } from "scripts/shared/shopify-auth";

const DRY_RUN = false;
const CONCURRENCY = 5;
const SLEEP_MS = 400;

interface CurrentMedia {
  id: string;
  media: { id: string; mediaContentType: string; originUrl?: string }[];
}

const currentMedia: CurrentMedia[] = JSON.parse(
  readFileSync(resolvePath(import.meta.url, "./product-media.json"), "utf-8"),
);

// Filter to products that have at least one video, and where the video is NOT already at position 1
const productsToReorder = currentMedia
  .map((product) => {
    if (product.media.length < 2) return null;
    const videoIndex = product.media.findIndex(
      (m) => m.mediaContentType === "EXTERNAL_VIDEO",
    );
    if (videoIndex === -1 || videoIndex === 1) return null;
    return {
      productId: product.id,
      videoMediaId: product.media[videoIndex].id,
    };
  })
  .filter(Boolean) as { productId: string; videoMediaId: string }[];

const MUTATION = `#graphql
  mutation reorderProductMedia($id: ID!, $moves: [MoveInput!]!) {
    productReorderMedia(id: $id, moves: $moves) {
      mediaUserErrors {
        field
        message
      }
    }
  }
` as const;

async function main() {
  console.log(`=== Reorder Product Media (Video → Position 2) ===`);
  console.log(`Total products with videos to reorder: ${productsToReorder.length}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log();

  if (DRY_RUN) {
    for (const { productId, videoMediaId } of productsToReorder) {
      console.log(`Would move ${videoMediaId} to position 1 on ${productId}`);
    }
    return;
  }

  let success = 0;
  let failed = 0;

  try {
    for (let i = 0; i < productsToReorder.length; i += CONCURRENCY) {
      const batch = productsToReorder.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async ({ productId, videoMediaId }, batchIdx) => {
          try {
            const response = await adminQuery(MUTATION, {
              id: productId,
              moves: [{ id: videoMediaId, newPosition: "1" }],
            });

            if (response.errors) {
              const msg = response.errors.map((e) => e.message).join("; ");
              console.log(`[${i + batchIdx + 1}/${productsToReorder.length}] FAIL ${productId} — ${msg}`);
              failed++;
              return;
            }

            const errors = response.data?.productReorderMedia?.mediaUserErrors ?? [];
            if (errors.length > 0) {
              const msg = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
              console.log(`[${i + batchIdx + 1}/${productsToReorder.length}] FAIL ${productId} — ${msg}`);
              failed++;
              return;
            }

            console.log(`[${i + batchIdx + 1}/${productsToReorder.length}] OK ${productId}`);
            success++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`[${i + batchIdx + 1}/${productsToReorder.length}] FAIL ${productId} — ${msg}`);
            failed++;
          }
        }),
      );

      if (i + CONCURRENCY < productsToReorder.length) {
        await sleep(SLEEP_MS);
      }
    }
  } finally {
    await disconnect();
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main();
