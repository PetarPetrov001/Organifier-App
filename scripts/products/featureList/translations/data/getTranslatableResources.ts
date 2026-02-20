import { readFileSync, writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "scripts/shopify-admin";
import { disconnect } from "scripts/shopify-auth";
import { sleep } from "../../../../shared/helpers";
import type { TranslatableResource } from "../../../../shared/types";
import type { GetTranslatableFeatureListMetafieldsQuery } from "../../../../../app/types/admin.generated";

const QUERY = `#graphql
  query getTranslatableFeatureListMetafields(
    $resourceIds: [ID!]!
    $first: Int!
    $after: String
  ) {
    translatableResourcesByIds(resourceIds: $resourceIds, first: $first, after: $after) {
      nodes {
        resourceId
        translatableContent {
          digest
          key
          locale
          value
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
` as const;

const ALLOWED_KEYS = new Set(["value"]);
const BATCH_SIZE = 250;

const mapPath = new URL("./product-to-metafield.json", import.meta.url);
const metafieldMap: Record<string, string> = JSON.parse(
  readFileSync(mapPath, "utf-8")
);
const metafieldIds = Object.values(metafieldMap);

console.log(
  `Loaded ${metafieldIds.length} metafield IDs from product-to-metafield.json`
);

const allResources: TranslatableResource[] = [];

try {
  for (let i = 0; i < metafieldIds.length; i += BATCH_SIZE) {
    const batch = metafieldIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(metafieldIds.length / BATCH_SIZE);
    let after: string | null | undefined = null;

    do {
      const result: GraphQLResponse<GetTranslatableFeatureListMetafieldsQuery> =
        await adminQuery(QUERY, {
          resourceIds: batch,
          first: 250,
          after,
        });

      if (result.errors) {
        console.error("GraphQL errors:", result.errors);
        process.exit(1);
      }

      const { nodes, pageInfo } = result.data!.translatableResourcesByIds;

      for (const node of nodes) {
        const filtered = node.translatableContent.filter((c) =>
          ALLOWED_KEYS.has(c.key)
        );
        if (filtered.length > 0) {
          allResources.push({
            resourceId: node.resourceId,
            translatableContent: filtered,
          });
        }
      }

      console.log(
        `Batch ${batchNum}/${totalBatches}: fetched ${nodes.length} resources (${allResources.length} total)`
      );

      after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

      if (after) {
        await sleep(100);
      }
    } while (after);

    if (i + BATCH_SIZE < metafieldIds.length) {
      await sleep(100);
    }
  }

  // Verify count matches
  if (allResources.length !== metafieldIds.length) {
    console.warn(
      `⚠ Count mismatch: product-to-metafield.json has ${metafieldIds.length} entries, but got ${allResources.length} translatable resources`
    );
  } else {
    console.log(
      `✓ Count matches: ${allResources.length} translatable resources for ${metafieldIds.length} metafield IDs`
    );
  }

  const outputPath = new URL(
    "./feature-list-translatable-resources.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(allResources, null, 2));
  console.log(
    `Done! Wrote ${allResources.length} resources to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
