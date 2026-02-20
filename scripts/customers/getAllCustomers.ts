import { writeFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../shared/shopify-client.js";
import { disconnect } from "../shared/shopify-auth.js";
import type { GetCustomersQuery } from "../../app/types/admin.generated.js";

import { sleep, isTransientError } from "../shared/helpers";

// ── Config ───────────────────────────────────────────────────────────
const CONFIG = {
  pageSize: 250,
  sleepMs: 5,
  maxRetries: 6,
  throttleBudgetThreshold: 100,
};

const DOMAIN_FILTERS = [
  "kaufland",
  "amazon",
  "bol.com",
  "gartentraume",
  "brico",
  "mirakl",
  "praxis",
  "diymaxeda",
  "worten",
  "insightlyservice",
  "allegro",
  "productpine",
  "rakuten",
  "octopia",
];

/** Build one combined regex: /@.*(?:kaufland|amazon|bol\.com|...)$/i */
const DOMAIN_REGEX = new RegExp(
  `@.*(?:${DOMAIN_FILTERS.map((d) => d.replace(/\./g, "\\.")).join("|")})`,
  "i",
);

const CUSTOMERS_QUERY = `#graphql
  query getCustomers($first: Int!, $after: String) {
    customers(first: $first, after: $after) {
      nodes {
        id
        defaultEmailAddress{
          emailAddress
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
` as const;

// ── Throttle-aware page fetch ────────────────────────────────────────
async function fetchPage(after: string | null, page: number) {
  const prefix = `Page ${page}`;

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const result: GraphQLResponse<GetCustomersQuery> = await adminQuery(
        CUSTOMERS_QUERY,
        { first: CONFIG.pageSize, after },
      );

      // Check for GraphQL-level throttling
      if (result.errors) {
        const errMsg = result.errors.map((e) => e.message).join("; ");
        const isThrottled = errMsg.toLowerCase().includes("throttl");

        if (isThrottled && attempt < CONFIG.maxRetries) {
          const backoff =
            Math.min(1000 * Math.pow(2, attempt), 30000) +
            Math.random() * 500;
          console.log(
            `${prefix} — throttled, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${CONFIG.maxRetries})`,
          );
          await sleep(backoff);
          continue;
        }

        throw new Error(`GraphQL errors on ${prefix}: ${errMsg}`);
      }

      // Monitor throttle budget from response extensions
      const ext = result.extensions as
        | { cost?: { throttleStatus?: { currentlyAvailable?: number } } }
        | undefined;
      const available = ext?.cost?.throttleStatus?.currentlyAvailable;
      let throttled = false;

      if (
        available !== undefined &&
        available < CONFIG.throttleBudgetThreshold
      ) {
        console.log(
          `${prefix} — throttle budget low (${available}), sleeping extra 1s`,
        );
        throttled = true;
        await sleep(1000);
      }

      return { data: result.data!, throttled };
    } catch (error) {
      if (isTransientError(error) && attempt < CONFIG.maxRetries) {
        const backoff =
          Math.min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 500;
        console.log(
          `${prefix} — transient error, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${CONFIG.maxRetries})`,
        );
        await sleep(backoff);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`${prefix} — exhausted all ${CONFIG.maxRetries} retries`);
}

// ── Filter customers matching the blocklist ──────────────────────────
function filterCustomers(
  nodes: GetCustomersQuery["customers"]["nodes"],
): GetCustomersQuery["customers"]["nodes"] {
  return nodes.filter(
    (customer) =>
      customer.defaultEmailAddress?.emailAddress &&
      DOMAIN_REGEX.test(customer.defaultEmailAddress.emailAddress),
  );
}

// ── Main ─────────────────────────────────────────────────────────────
console.log("Fetching all customers...");

const filteredCustomers: GetCustomersQuery["customers"]["nodes"] = [];
let after: string | null = null;
let page = 0;
let totalFetched = 0;

try {
  do {
    page++;
    const { data, throttled } = await fetchPage(after, page);
    const { nodes, pageInfo } = data.customers;

    totalFetched += nodes.length;
    const matched = filterCustomers(nodes);
    filteredCustomers.push(...matched);

    console.log(
      `Page ${page}: fetched ${nodes.length} customers, ${matched.length} matched (${totalFetched} total)`,
    );

    after = pageInfo.hasNextPage ? pageInfo.endCursor ?? null : null;

    if (after) {
      await sleep(throttled ? 2000 : CONFIG.sleepMs);
    }
  } while (after);

  console.log(`Filtered ${filteredCustomers.length} matching customers from ${totalFetched} total`);

  const outputPath = new URL("./filtered-customers.json", import.meta.url);
  writeFileSync(outputPath, JSON.stringify(filteredCustomers, null, 2));
  console.log(`Wrote results to ${outputPath.pathname}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await disconnect();
}
