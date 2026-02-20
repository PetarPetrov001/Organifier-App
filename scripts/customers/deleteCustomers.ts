import { readFileSync, writeFileSync } from "fs";
import { adminQuery, type ThrottleStatus } from "../shared/shopify-client.js";
import { disconnect } from "../shared/shopify-auth.js";
import { sleep, isTransientError } from "../shared/helpers.js";
import type { GetCustomersQuery } from "../../app/types/admin.generated.js";

// ── Config ───────────────────────────────────────────────────────────
const DRY_RUN = false;
const CONCURRENCY = 15;
const DELAY_MS = 100;
const MAX_RETRIES = 3;
const SKIP = 0;
// ─────────────────────────────────────────────────────────────────────

type CustomerNode = GetCustomersQuery["customers"]["nodes"][number];

const DELETE_MUTATION = `#graphql
  mutation customerDelete($input: CustomerDeleteInput!) {
    customerDelete(input: $input) {
      deletedCustomerId
      userErrors { field message }
    }
  }
`;

interface DeleteResult {
  customer: CustomerNode;
  status: "success" | "failed";
  error?: string;
  throttle?: ThrottleStatus;
  cost?: number;
}

async function deleteOne(customer: CustomerNode): Promise<DeleteResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await adminQuery(DELETE_MUTATION, { input: { id: customer.id } });

      const ext = result.extensions?.cost;
      const throttle = ext?.throttleStatus;
      const cost = ext?.actualQueryCost;

      if (result.errors) {
        const errMsg = result.errors.map((e) => e.message).join("; ");
        const isThrottled = errMsg.toLowerCase().includes("throttl");

        if (isThrottled && attempt < MAX_RETRIES) {
          const backoff =
            Math.min(1000 * Math.pow(2, attempt), 30_000) +
            Math.random() * 500;
          console.log(
            `  ${customer.id} — throttled, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoff)}ms`,
          );
          await sleep(backoff);
          continue;
        }

        return { customer, status: "failed", error: errMsg, throttle, cost };
      }

      const userErrors = result.data!.customerDelete?.userErrors ?? [];
      if (userErrors.length > 0) {
        const errMsg = userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
        return { customer, status: "failed", error: errMsg, throttle, cost };
      }

      return { customer, status: "success", throttle, cost };
    } catch (err) {
      if (isTransientError(err) && attempt < MAX_RETRIES) {
        const backoff =
          Math.min(1000 * Math.pow(2, attempt), 30_000) +
          Math.random() * 500;
        console.log(
          `  ${customer.id} — transient error, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoff)}ms: ${err instanceof Error ? err.message : err}`,
        );
        await sleep(backoff);
        continue;
      }
      return {
        customer,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { customer, status: "failed", error: "Exhausted retries" };
}

// ── Load customers ───────────────────────────────────────────────────
const customersPath = new URL("./filtered-customers.json", import.meta.url);
const allCustomers: CustomerNode[] = JSON.parse(
  readFileSync(customersPath, "utf-8"),
);
const customers = allCustomers.slice(SKIP);

console.log(
  `Loaded ${allCustomers.length} customers (skipping ${SKIP}, processing ${customers.length})`,
);
console.log(
  `Config: CONCURRENCY=${CONCURRENCY}, DELAY_MS=${DELAY_MS}, MAX_RETRIES=${MAX_RETRIES}, DRY_RUN=${DRY_RUN}`,
);

if (DRY_RUN) {
  console.log("\n── DRY RUN ── No mutations will be sent.\n");
  for (let i = 0; i < Math.min(customers.length, 5); i++) {
    const c = customers[i];
    console.log(`  Would delete ${c.id} (${c.defaultEmailAddress?.emailAddress ?? "no email"})`);
  }
  if (customers.length > 5) console.log(`  ... and ${customers.length - 5} more`);
  process.exit(0);
}

console.log();

// ── Execute ──────────────────────────────────────────────────────────
const failedCustomers: CustomerNode[] = [];
let deleted = 0;

try {
  for (let i = 0; i < customers.length; i += CONCURRENCY) {
    const batch = customers.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(batch.map(deleteOne));

    let anyThrottled = false;
    let lowestAvailable = Infinity;
    let restoreRate = 50;

    for (let k = 0; k < results.length; k++) {
      const settled = results[k];

      if (settled.status === "rejected") {
        console.error(`  ${batch[k].id} — fatal: ${settled.reason}`);
        failedCustomers.push(batch[k]);
        continue;
      }

      const r = settled.value;
      const icon = r.status === "success" ? "OK" : "FAIL";
      console.log(
        `[${i + k + 1}/${customers.length}] ${icon} ${r.customer.id}${r.error ? ` — ${r.error}` : ""}`,
      );

      if (r.status === "success") {
        deleted++;
      } else {
        failedCustomers.push(r.customer);
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
    } else if (i + CONCURRENCY < customers.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone! Deleted: ${deleted}, Failed: ${failedCustomers.length}`);

  if (failedCustomers.length > 0) {
    const failedPath = new URL("./failed-customers.json", import.meta.url);
    writeFileSync(failedPath, JSON.stringify(failedCustomers, null, 2));
    console.log(`Failed customers written to ${failedPath.pathname}`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await disconnect();
}
