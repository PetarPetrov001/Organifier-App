import { readFileSync, writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../shopify-admin.js";
import { disconnect } from "../shopify-auth.js";

interface OrderNode {
  id: string;
  email: string | null;
}

interface DeleteAliasResult {
  deletedId: string | null;
  userErrors: Array<{ field: string[]; message: string }>;
}

function buildBatchDeleteMutation(batch: OrderNode[]): {
  query: string;
  variables: Record<string, string>;
} {
  const varDefs = batch.map((_, i) => `$id${i}: ID!`).join(", ");
  const mutations = batch
    .map(
      (_, i) => `    delete${i}: orderDelete(orderId: $id${i}) {
      deletedId
      userErrors {
        field
        message
      }
    }`
    )
    .join("\n");

  const query = `mutation batchDeleteOrders(${varDefs}) {\n${mutations}\n}`;
  const variables: Record<string, string> = {};
  batch.forEach((order, i) => {
    variables[`id${i}`] = order.id;
  });

  return { query, variables };
}

const BATCH_SIZE = 5;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ALREADY_DELETED = 5500;

const ordersPath = new URL("./filtered-orders.json", import.meta.url);
const allOrders: OrderNode[] = JSON.parse(readFileSync(ordersPath, "utf-8"));
const orders = allOrders.slice(ALREADY_DELETED);

console.log(`Loaded ${orders.length} orders to delete.`);

const failedOrders: OrderNode[] = [];
let deleted = 0;

try {
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    const { query, variables } = buildBatchDeleteMutation(batch);

    const result: GraphQLResponse<Record<string, DeleteAliasResult>> =
      await adminQuery(query, variables);

    if (result.errors) {
      console.error(`GraphQL errors on batch ${Math.floor(i / BATCH_SIZE) + 1}:`, result.errors);
      failedOrders.push(...batch);
    } else {
      for (let j = 0; j < batch.length; j++) {
        const alias = `delete${j}`;
        const entry = result.data![alias];

        if (entry.userErrors.length > 0) {
          console.error(`User errors for ${batch[j].id}:`, entry.userErrors);
          failedOrders.push(batch[j]);
        } else {
          deleted++;
        }
      }
    }

    console.log(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${deleted} deleted, ${failedOrders.length} failed (${Math.min(i + BATCH_SIZE, orders.length)}/${orders.length})`
    );

    if (i + BATCH_SIZE < orders.length) {
      await sleep(60);
    }
  }

  console.log(`\nDone! Deleted: ${deleted}, Failed: ${failedOrders.length}`);

  if (failedOrders.length > 0) {
    const failedPath = new URL("./failed-orders.json", import.meta.url);
    writeFileSync(failedPath, JSON.stringify(failedOrders, null, 2));
    console.log(`Failed orders written to ${failedPath.pathname}`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await disconnect();
}
