import type { AdminQueries, AdminMutations } from "@shopify/admin-api-client";
import {
  DEFAULT_SHOP,
  getValidAccessToken,
  getSession,
  refreshAccessToken,
  listStores,
  disconnect,
} from "./shopify-auth.js";

const API_VERSION = "2025-07";

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
  extensions?: unknown;
}

// --- GraphQL Execution ---

/** Strip index signatures, keeping only explicit (codegen-generated) keys. */
type StripIndexSignature<T> = {
  [K in keyof T as string extends K ? never : K]: T[K];
};
type Operations = StripIndexSignature<AdminQueries & AdminMutations>;

/** Typed overload — when the query is a known `#graphql` literal, return & variables are inferred. */
export async function adminQuery<Q extends string & keyof Operations>(
  query: Q,
  variables: Operations[Q]["variables"],
  shop?: string,
): Promise<GraphQLResponse<Operations[Q]["return"]>>;
/** Fallback overload — for ad-hoc / dynamic query strings. */
export async function adminQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  shop?: string,
): Promise<GraphQLResponse<T>>;
export async function adminQuery(
  query: string,
  variables?: Record<string, unknown>,
  shop: string = DEFAULT_SHOP,
): Promise<GraphQLResponse> {
  const accessToken = await getValidAccessToken(shop);

  const response = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  // Handle 401 by attempting one refresh + retry. In case the token expired while making the request.
  if (response.status === 401) {
    console.error(`[shopify-admin] Got 401, attempting token refresh...`);
    const session = await getSession(shop);
    const refreshedSession = await refreshAccessToken(shop, session);

    const retryResponse = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": refreshedSession.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      },
    );

    if (!retryResponse.ok) {
      throw new Error(
        `GraphQL request failed after token refresh (${retryResponse.status}): ${await retryResponse.text()}`,
      );
    }

    return retryResponse.json();
  }

  if (!response.ok) {
    throw new Error(
      `GraphQL request failed (${response.status}): ${await response.text()}`,
    );
  }

  return response.json();
}

// --- CLI Mode ---

const isMainModule =
  process.argv[1]?.replace(/\\/g, "/").includes("shopify-admin");

if (isMainModule) {
  const args = process.argv.slice(2);

  // Parse --shop flag
  let shop = DEFAULT_SHOP;
  const shopFlagIndex = args.indexOf("--shop");
  if (shopFlagIndex !== -1) {
    shop = args[shopFlagIndex + 1];
    if (!shop) {
      console.error("--shop requires a value (e.g. --shop my-store.myshopify.com)");
      process.exit(1);
    }
    args.splice(shopFlagIndex, 2);
  }

  // Parse --stores flag to list all installed stores
  if (args.includes("--stores")) {
    try {
      const stores = await listStores();
      if (stores.length === 0) {
        console.log("No stores found. Install the app on a store first.");
      } else {
        console.log("Installed stores:");
        stores.forEach((s) => console.log(`  ${s}`));
      }
    } finally {
      await disconnect();
    }
    process.exit(0);
  }

  const query = args[0];

  if (!query) {
    console.error("Usage:");
    console.error("  npm run gql -- '<graphql query>'");
    console.error("  npm run gql -- --shop other-store.myshopify.com '<graphql query>'");
    console.error("  npm run gql -- --stores");
    console.error("");
    console.error("Examples:");
    console.error('  npm run gql -- "query { shop { name } }"');
    console.error('  npm run gql -- --shop other.myshopify.com "query { shop { name } }"');
    process.exit(1);
  }

  let variables: Record<string, unknown> | undefined;
  if (args[1]) {
    try {
      variables = JSON.parse(args[1]);
    } catch {
      console.error("Failed to parse variables JSON:", args[1]);
      process.exit(1);
    }
  }

  try {
    const result = await adminQuery(query, variables, shop);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await disconnect();
  }
}
