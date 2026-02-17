import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "scripts/shopify-admin";
import { disconnect } from "scripts/shopify-auth";
import { sleep } from "../shared/helpers";
import type { GetProductsQuery } from "../../app/types/admin.generated";

const QUERY = `#graphql
  query getProducts(
    $first: Int!
    $after: String
  ) {
    products(first: $first, after: $after) {
      nodes {
        id
        variants(first: 1) {
          nodes {
            sku
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
` as const;

console.log("Fetching all products...");

const allResources: { id: string; variantSkus: string }[] = [];
let after: string | null | undefined = null;
let page = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<GetProductsQuery> =
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
      allResources.push({
        id: node.id,
        variantSkus: node.variants.nodes.find((variant) => variant.sku)?.sku ?? "",
      });
    }

    console.log(
      `Page ${page}: fetched ${nodes.length} products (${allResources.length} total)`
    );

    after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

    if (after) {
      await sleep(100);
    }
  } while (after);

  const outputPath = new URL(
    "./product-variant-skus.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(allResources, null, 2));
  console.log(
    `Done! Wrote ${allResources.length} resources to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
