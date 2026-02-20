import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../../shared/shopify-client.js";
import { disconnect } from "../../shared/shopify-auth.js";
import { sleep } from "../../shared/helpers.js";
import type { GetProductsMediaQuery } from "../../../app/types/admin.generated.js";

const QUERY = `#graphql
  query getProductsMedia(
    $first: Int!
    $after: String
  ) {
    products(first: $first, after: $after) {
      nodes {
        id,
        media(first: 40){
          nodes{
            id,
            mediaContentType,
            ... on ExternalVideo {
              originUrl
            }
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

console.log("Fetching all products media...");

const allResources: { id: string; media: { id: string; mediaContentType: string, originUrl?: string }[] }[] = [];
let after: string | null | undefined = null;
let page = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<GetProductsMediaQuery> =
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
        media: node.media.nodes,
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
    "./product-media.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(allResources, null, 2));
  console.log(
    `Done! Wrote ${allResources.length} resources to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
