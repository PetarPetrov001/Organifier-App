import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../../shopify-admin.js";
import type { GetTranslatableProductsQuery } from "../../../app/types/admin.generated.js";
import { disconnect } from "../../shopify-auth.js";
import type { TranslatableResource } from "../../shared/types.js";
import { sleep } from "../../shared/helpers.js";

const QUERY = `#graphql
  query getTranslatableProductsSeo(
    $resourceType: TranslatableResourceType!
    $first: Int!
    $after: String
  ) {
    translatableResources(first: $first, after: $after, resourceType: $resourceType) {
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

const ALLOWED_KEYS = new Set(["meta_title", "meta_description"]);


console.log("Fetching all PRODUCT meta translatable resources...");

const allResources: TranslatableResource[] = [];
let after: string | null | undefined = null;
let page = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<GetTranslatableProductsQuery> =
      await adminQuery(QUERY, {
        resourceType: "PRODUCT" as const,
        first: 250,
        after,
      });

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      process.exit(1);
    }

    const { nodes, pageInfo } = result.data!.translatableResources;

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
      `Page ${page}: fetched ${nodes.length} resources (${allResources.length} total with title/body_html)`
    );

    after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

    if (after) {
      await sleep(100);
    }
  } while (after);

  const outputPath = new URL(
    "./product-meta-translation-resources.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(allResources, null, 2));
  console.log(
    `Done! Wrote ${allResources.length} resources to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
