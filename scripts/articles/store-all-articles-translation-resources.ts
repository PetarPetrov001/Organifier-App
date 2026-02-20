import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../shared/shopify-client.js";
import type { GetTranslatableArticlesQuery } from "../../app/types/admin.generated.js";
import { disconnect } from "../shared/shopify-auth.js";
import type { TranslatableResource } from "../shared/types.js";

const QUERY = `#graphql
  query getTranslatableArticles(
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

const ALLOWED_KEYS = new Set([
  "title",
  "body_html",
  "meta_title",
  "meta_description",
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

console.log("Fetching all ARTICLE translatable resources...");

const allResources: TranslatableResource[] = [];
let after: string | null | undefined = null;
let page = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<GetTranslatableArticlesQuery> =
      await adminQuery(QUERY, {
        resourceType: "ARTICLE" as const,
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
      `Page ${page}: fetched ${nodes.length} resources (${allResources.length} total with allowed keys)`
    );

    after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

    if (after) {
      await sleep(1000);
    }
  } while (after);

  const outputPath = new URL(
    "./article-translation-resources.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(allResources, null, 2));
  console.log(
    `Done! Wrote ${allResources.length} resources to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
