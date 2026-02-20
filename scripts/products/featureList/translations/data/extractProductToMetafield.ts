import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "scripts/shared/shopify-client";
import { disconnect } from "scripts/shared/shopify-auth";
import { sleep } from "../../../../shared/helpers";
import type { GetProductsFeatureListMetafieldQuery } from "../../../../../app/types/admin.generated";

const QUERY = `#graphql
  query getProductsFeatureListMetafield(
    $first: Int!
    $after: String
  ) {
    products(first: $first, after: $after) {
      nodes {
        id
        featureList: metafield(namespace: "custom", key: "feature_list") {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
` as const;

console.log("Fetching all products with custom.feature_list metafield...");

const metafieldMap: Record<string, string> = {};
let after: string | null | undefined = null;
let page = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<GetProductsFeatureListMetafieldQuery> =
      await adminQuery(QUERY, {
        first: 250,
        after,
      });

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      process.exit(1);
    }

    const { nodes, pageInfo } = result.data!.products;

    for (const node of nodes) {
      if (node.featureList?.id) {
        metafieldMap[node.id] = node.featureList.id;
      }
    }

    console.log(
      `Page ${page}: fetched ${nodes.length} products (${Object.keys(metafieldMap).length} with metafield)`
    );

    after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

    if (after) {
      await sleep(100);
    }
  } while (after);

  const outputPath = new URL(
    "./product-to-metafield.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(metafieldMap, null, 2));
  console.log(
    `Done! Wrote ${Object.keys(metafieldMap).length} entries to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
