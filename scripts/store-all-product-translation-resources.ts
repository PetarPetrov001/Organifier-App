import { writeFileSync } from "fs";
import { adminQuery, disconnect, GraphQLResponse } from "./shopify-admin.js";

const QUERY = `#graphql
  query getTranslatableProducts(
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
`;

const ALLOWED_KEYS = new Set(["title", "body_html"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TranslatableContent {
  digest: string | null;
  key: string;
  locale: string;
  value: string | null;
}

interface TranslatableResource {
  resourceId: string;
  translatableContent: TranslatableContent[];
}

interface QueryResult {
  translatableResources: {
    nodes: TranslatableResource[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

console.log("Fetching all PRODUCT translatable resources...");

const allResources: TranslatableResource[] = [];
let after: string | null = null;
let page = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<QueryResult> = await adminQuery(QUERY, {
      resourceType: "PRODUCT",
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

    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;

    if (after) {
      await sleep(1000);
    }
  } while (after);

  const outputPath = new URL(
    "./product-translation-resources.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(allResources, null, 2));
  console.log(
    `Done! Wrote ${allResources.length} resources to ${outputPath.pathname}`
  );
} finally {
  await disconnect();
}
