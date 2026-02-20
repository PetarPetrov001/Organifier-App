import type { AdminQueries, AdminMutations } from "@shopify/admin-api-client";
import {
  DEFAULT_SHOP,
  getValidAccessToken,
  getSession,
  refreshAccessToken,
} from "./shopify-auth.js";

const API_VERSION = "2025-07";

export interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface QueryCost {
  requestedQueryCost: number;
  actualQueryCost: number;
  throttleStatus: ThrottleStatus;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
  extensions?: { cost?: QueryCost };
}

// GraphQL Execution

// Strip index signatures, keeping only explicit (codegen-generated) keys.
type StripIndexSignature<T> = {
  [K in keyof T as string extends K ? never : K]: T[K];
};
type Operations = StripIndexSignature<AdminQueries & AdminMutations>;

// Typed overloads
export async function adminQuery<Q extends string & keyof Operations>(
  query: Q,
  variables: Operations[Q]["variables"],
  shop?: string,
): Promise<GraphQLResponse<Operations[Q]["return"]>>;
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

  // If token expired while making the request, attempt one refresh + retry.
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
