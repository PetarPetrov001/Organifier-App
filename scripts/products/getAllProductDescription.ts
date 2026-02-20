import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "scripts/shared/shopify-client";
import { disconnect } from "scripts/shared/shopify-auth";
import { sleep } from "../shared/helpers";
import type { GetProductsDescriptionQuery } from "../../app/types/admin.generated";

const QUERY = `#graphql
  query getProductsDescription(
    $first: Int!
    $after: String
  ) {
    products(first: $first, after: $after) {
      nodes {
        id
        descriptionHtml
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
` as const;

console.log("Fetching all products description...");

const allResources: { id: string; descriptionHtml: string }[] = [];
let after: string | null | undefined = null;
let page = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<GetProductsDescriptionQuery> =
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
        descriptionHtml: node.descriptionHtml,
      });
    }

    console.log(
      `Page ${page}: fetched ${nodes.length} products (${allResources.length} total)`
    );

    after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

    if (after) {
      await sleep(30);
    }
  } while (after);

  const outputPath = new URL(
    "./product-description.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(allResources, null, 2));
  console.log(
    `Done! Wrote ${allResources.length} resources to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
