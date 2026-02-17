import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../shopify-admin.js";
import { disconnect } from "../shopify-auth.js";
import type { GetOrdersQuery } from "../../app/types/admin.generated.js";

import { sleep } from "../shared/helpers";

const LIST_TO_FILTER = [
  "verkopen.bol.com",
  "@kaufland-online.de",
  "@gartentraeume.com",
  "@marketplace.amazon",
  "@notification.mirakl.net",
];

const ORDERS_QUERY = `#graphql
  query getOrders($first: Int!, $after: String) {
    orders(first: $first, after: $after) {
      nodes {
        id
        email
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
` as const;

interface OrderNode {
  id: string;
  email?: string | null;
}

console.log("Fetching all orders...");

const filteredOrders: OrderNode[] = [];
let after: string | null = null;
let page = 0;
let totalFetched = 0;

try {
  do {
    page++;
    const result: GraphQLResponse<GetOrdersQuery> = await adminQuery(ORDERS_QUERY, {
      first: 250,
      after,
    });

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      process.exit(1);
    }

    const { nodes, pageInfo } = result.data!.orders;
    totalFetched += nodes.length;

    for (const order of nodes) {
      if (
        order.email &&
        LIST_TO_FILTER.some((filter) => order.email!.includes(filter))
      ) {
        filteredOrders.push(order);
      }
    }

    console.log(
      `Page ${page}: fetched ${nodes.length} orders (${totalFetched} total, ${filteredOrders.length} matched)`
    );

    after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

    if (after) {
      await sleep(100);
    }
  } while (after);

  const outputPath = new URL(
    "./filtered-orders.json",
    import.meta.url
  );
  writeFileSync(outputPath, JSON.stringify(filteredOrders, null, 2));
  console.log(
    `Done! Found ${filteredOrders.length} matching orders out of ${totalFetched} total. Wrote to ${outputPath.pathname}`
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await disconnect();
}
