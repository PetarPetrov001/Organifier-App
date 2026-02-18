import { PrismaClient } from "@prisma/client";

export const DEFAULT_SHOP =
  process.env.SHOPIFY_SHOP ?? "ertis-playground.myshopify.com";
const CLIENT_ID =
  process.env.SHOPIFY_API_KEY ?? "23abf99d474f28d199e9e99de8d8f1a8";
const CLIENT_SECRET = process.env.SHOPIFY_API_SECRET;

if (!CLIENT_SECRET) {
  throw new Error(
    "SHOPIFY_API_SECRET env var is required. " +
      "Create a .env file or export it before running scripts.",
  );
}

const prisma = new PrismaClient();

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

// --- Token Management ---
export async function getSession(shop: string): Promise<SessionRecord> {
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

export async function refreshAccessToken(
  shop: string,
  session: SessionRecord,
): Promise<SessionRecord> {
  if (!session.refreshToken) {
    throw new Error(
      "Access token is expired but no refresh token is available. " +
        "Reinstall the app on the store to get fresh tokens.",
    );
  }

  console.error(`[shopify-auth] Token expired for ${shop}, refreshing...`);

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
    `[shopify-auth] Token refreshed. New expiry: ${newExpires.toISOString()}`,
  );

  return updated;
}

// Mutex to prevent concurrent refresh storms when multiple requests
// hit 401 or detect expiry at the same time.
let refreshMutex: Promise<void> = Promise.resolve();

export async function getValidAccessToken(shop: string): Promise<string> {
  let session = await getSession(shop);

  if (isTokenExpired(session)) {
    // Serialize refresh calls: wait for any in-flight refresh, then check again
    await refreshMutex;
    session = await getSession(shop);

    if (isTokenExpired(session)) {
      let releaseMutex!: () => void;
      refreshMutex = new Promise((resolve) => {
        releaseMutex = resolve;
      });
      try {
        session = await refreshAccessToken(shop, session);
      } finally {
        releaseMutex();
      }
    }
  }

  return session.accessToken;
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
