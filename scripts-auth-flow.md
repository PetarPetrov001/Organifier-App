# Shopify Authentication Flow

## Overview

The app uses **two complementary auth mechanisms**: the Remix web app acquires tokens via Token Exchange, and CLI scripts piggyback on the stored session with manual refresh.

## 1. Web App: Token Exchange (Embedded Auth)

In `app/shopify.server.ts`:

```ts
future: {
  unstable_newEmbeddedAuthStrategy: true,   // Token Exchange flow
  expiringOfflineAccessTokens: true,        // Expiring offline tokens
},
```

- **`unstable_newEmbeddedAuthStrategy: true`** enables the **Token Exchange** flow (OAuth 2.0 RFC 8693). App Bridge sends a session token (JWT) from the frontend, and the Remix backend exchanges it for an access token by POSTing to `https://{shop}/admin/oauth/access_token` with `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`. No redirects, no page flickers.

- **`expiringOfflineAccessTokens: true`** means offline access tokens **expire after 1 hour** and come with a **refresh token** (90-day lifetime). This is the newer, more secure model vs. legacy non-expiring tokens.

The `@shopify/shopify-app-remix` library + `PrismaSessionStorage` handle all of this automatically — acquiring tokens, storing them in the `Session` table, etc.

## 2. CLI Scripts: Stored Session + Manual Refresh

Scripts do **not** acquire tokens themselves. They read the **offline session** that the web app already stored in Prisma.

### Token Retrieval (`scripts/shared/shopify-auth.ts`)

- **`getSession()`** — Looks up `offline_{shop}` from the `Session` table. This session was created by the Remix app during installation/token exchange.
- **`isTokenExpired()`** — Checks if the token is expired (with a 5-minute buffer).
- **`refreshAccessToken()`** — If expired, POSTs to `https://{shop}/admin/oauth/access_token` with `grant_type=refresh_token`. Both the access token and refresh token rotate on each refresh. New values are written back to Prisma.
- **`getValidAccessToken()`** — Orchestrates the above with a mutex to prevent concurrent refresh storms.

### Request-Level Fallback (`scripts/shared/shopify-client.ts`)

- If a `401` comes back mid-request, `adminQuery()` triggers a refresh + retry as a fallback.

## Summary

| Concern | Mechanism |
|---|---|
| **Initial token acquisition** | Token Exchange flow (Remix app + App Bridge during install/open) |
| **Token storage** | Prisma SQLite — `Session` table with `offline_{shop}` ID |
| **Token type** | Expiring offline access token (1h TTL) + refresh token (90d TTL) |
| **Token refresh (web app)** | Automatic via `@shopify/shopify-app-remix` |
| **Token refresh (scripts)** | Manual `POST grant_type=refresh_token` in `shopify-auth.ts` |
| **If refresh token expires** | Merchant must re-open the app in Shopify Admin to re-trigger token exchange |

## Key Dependency

The scripts are **not standalone** — they depend on the app having been installed and opened at least once so the Remix app can store the initial offline session. After that, scripts can keep refreshing indefinitely as long as the refresh token doesn't go 90 days without use.
