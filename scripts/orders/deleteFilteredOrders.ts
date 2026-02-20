import { readFileSync, writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../shopify-admin.js";
import { disconnect } from "../shopify-auth.js";
import { sleep, isTransientError } from "../shared/helpers.js";

// ── Config ───────────────────────────────────────────────────────────
const CONCURRENCY = 10;
const DELAY_MS = 300;
const MAX_RETRIES = 3;
const SKIP = 0;
// ─────────────────────────────────────────────────────────────────────

interface OrderNode {
  id: string;
  email: string | null;
}

interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

interface Cost {
  requestedQueryCost: number;
  actualQueryCost: number;
  throttleStatus: ThrottleStatus;
}

const DELETE_MUTATION = `
  mutation orderDelete($orderId: ID!) {
    orderDelete(orderId: $orderId) {
      deletedId
      userErrors { field message }
    }
  }
`;

interface DeleteResult {
  order: OrderNode;
  status: "success" | "failed";
  error?: string;
  throttle?: ThrottleStatus;
  cost?: number;
}

async function deleteOne(order: OrderNode): Promise<DeleteResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result: GraphQLResponse<{
        orderDelete: {
          deletedId: string | null;
          userErrors: Array<{ field: string[]; message: string }>;
        };
      }> = await adminQuery(DELETE_MUTATION, { orderId: order.id });

      const ext = (result as any).extensions?.cost as Cost | undefined;
      const throttle = ext?.throttleStatus;

      if (result.errors) {
        const errMsg = result.errors.map((e) => e.message).join("; ");
        const isThrottled = errMsg.toLowerCase().includes("throttl");

        if (isThrottled && attempt < MAX_RETRIES) {
          const backoff =
            Math.min(1000 * Math.pow(2, attempt), 30_000) +
            Math.random() * 500;
          console.log(
            `  ${order.id} — throttled, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoff)}ms`,
          );
          await sleep(backoff);
          continue;
        }

        return { order, status: "failed", error: errMsg, throttle, cost: ext?.actualQueryCost };
      }

      const { userErrors } = result.data!.orderDelete;
      if (userErrors.length > 0) {
        const errMsg = userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
        return { order, status: "failed", error: errMsg, throttle, cost: ext?.actualQueryCost };
      }

      return { order, status: "success", throttle, cost: ext?.actualQueryCost };
    } catch (err) {
      if (isTransientError(err) && attempt < MAX_RETRIES) {
        const backoff =
          Math.min(1000 * Math.pow(2, attempt), 30_000) +
          Math.random() * 500;
        console.log(
          `  ${order.id} — transient error, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoff)}ms: ${err instanceof Error ? err.message : err}`,
        );
        await sleep(backoff);
        continue;
      }
      return {
        order,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { order, status: "failed", error: "Exhausted retries" };
}

// ── Load orders ──────────────────────────────────────────────────────
const ordersPath = new URL("./filtered-orders.json", import.meta.url);
const allOrders: OrderNode[] = JSON.parse(readFileSync(ordersPath, "utf-8"));
const orders = allOrders.slice(SKIP);

console.log(
  `Loaded ${allOrders.length} orders (skipping ${SKIP}, processing ${orders.length})`,
);
console.log(`Config: CONCURRENCY=${CONCURRENCY}, DELAY_MS=${DELAY_MS}, MAX_RETRIES=${MAX_RETRIES}`);
console.log();

// ── Execute ──────────────────────────────────────────────────────────
const failedOrders: OrderNode[] = [];
let deleted = 0;

try {
  for (let i = 0; i < orders.length; i += CONCURRENCY) {
    const batch = orders.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(batch.map(deleteOne));

    let anyThrottled = false;
    let lowestAvailable = Infinity;
    let restoreRate = 50;

    for (let k = 0; k < results.length; k++) {
      const settled = results[k];

      if (settled.status === "rejected") {
        console.error(`  ${batch[k].id} — fatal: ${settled.reason}`);
        failedOrders.push(batch[k]);
        continue;
      }

      const r = settled.value;
      const icon = r.status === "success" ? "OK" : "FAIL";
      console.log(
        `[${i + k + 1}/${orders.length}] ${icon} ${r.order.id}${r.error ? ` — ${r.error}` : ""}`,
      );

      if (r.status === "success") {
        deleted++;
      } else {
        failedOrders.push(r.order);
      }

      if (r.throttle) {
        const { currentlyAvailable, maximumAvailable, restoreRate: rr } = r.throttle;
        const pct = Math.round((currentlyAvailable / maximumAvailable) * 100);
        console.log(
          `  Throttle: ${currentlyAvailable}/${maximumAvailable} (${pct}%) | restore ${rr}/s | cost ${r.cost ?? "?"}`,
        );

        if (currentlyAvailable < lowestAvailable) {
          lowestAvailable = currentlyAvailable;
          restoreRate = rr;
        }

        if (currentlyAvailable < rr * 2) {
          anyThrottled = true;
        }
      }
    }

    // Dynamic throttle backoff
    if (anyThrottled && lowestAvailable < Infinity) {
      const backoff = Math.ceil(
        ((restoreRate * 2 - lowestAvailable) / restoreRate) * 1000,
      );
      console.log(
        `  Throttle low (${lowestAvailable} available) — backing off ${backoff}ms`,
      );
      await sleep(backoff);
    } else if (i + CONCURRENCY < orders.length) {
      await sleep(DELAY_MS);
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
