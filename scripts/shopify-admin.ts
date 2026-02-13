import { PrismaClient } from "@prisma/client";

// --- Configuration ---

const DEFAULT_SHOP =
  process.env.SHOPIFY_SHOP ?? "ertis-playground.myshopify.com";
const CLIENT_ID =
  process.env.SHOPIFY_API_KEY ?? "23abf99d474f28d199e9e99de8d8f1a8";
const CLIENT_SECRET = process.env.SHOPIFY_API_SECRET;
const API_VERSION = "2025-01";

if (!CLIENT_SECRET) {
  throw new Error(
    "SHOPIFY_API_SECRET env var is required. " +
      "Create a .env file or export it before running scripts.",
  );
}

// --- Prisma Client ---

const prisma = new PrismaClient();

// --- Types ---

interface SessionRecord {
  id: string;
  shop: string;
  accessToken: string;
  refreshToken: string | null;
  expires: Date | null;
  refreshTokenExpires: Date | null;
}

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope: string;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
  extensions?: unknown;
}

// --- Token Management ---

async function getSession(shop: string): Promise<SessionRecord> {
  const sessionId = `offline_${shop}`;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error(
      `No offline session found for ${shop}. ` +
        `Expected session ID: ${sessionId}. ` +
        `Has the app been installed on this store?`,
    );
  }

  return session;
}

function isTokenExpired(session: SessionRecord): boolean {
  if (!session.expires) return false;
  // Refresh 5 minutes early to avoid race conditions
  const bufferMs = 5 * 60 * 1000;
  return new Date(session.expires).getTime() - bufferMs < Date.now();
}

async function refreshAccessToken(
  shop: string,
  session: SessionRecord,
): Promise<SessionRecord> {
  if (!session.refreshToken) {
    throw new Error(
      "Access token is expired but no refresh token is available. " +
        "Reinstall the app on the store to get fresh tokens.",
    );
  }

  console.error(`[shopify-admin] Token expired for ${shop}, refreshing...`);

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data: TokenRefreshResponse = await response.json();

  const now = new Date();
  const newExpires = new Date(now.getTime() + data.expires_in * 1000);
  const newRefreshExpires = new Date(
    now.getTime() + data.refresh_token_expires_in * 1000,
  );

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expires: newExpires,
      refreshTokenExpires: newRefreshExpires,
    },
  });

  console.error(
    `[shopify-admin] Token refreshed. New expiry: ${newExpires.toISOString()}`,
  );

  return updated;
}

async function getValidAccessToken(shop: string): Promise<string> {
  let session = await getSession(shop);

  if (isTokenExpired(session)) {
    session = await refreshAccessToken(shop, session);
  }

  return session.accessToken;
}

// --- GraphQL Execution ---

export async function adminQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  shop: string = DEFAULT_SHOP,
): Promise<GraphQLResponse<T>> {
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

  // Handle 401 by attempting one refresh + retry
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

// --- Utilities ---

export async function listStores(): Promise<string[]> {
  const sessions = await prisma.session.findMany({
    where: { isOnline: false },
    select: { shop: true },
  });
  return sessions.map((s) => s.shop);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
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
