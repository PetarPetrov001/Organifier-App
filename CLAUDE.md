# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Organifier-app is a **Shopify app** whose primary purpose is running **Admin API scripts** (`scripts/`). The Remix web app (`app/`) is template-generated scaffolding for OAuth and session management — the real work happens in the CLI scripts.

## Commands

| Task | Command |
|------|---------|
| Run a script | `tsx --env-file=.env scripts/<path>.ts` |
| Ad-hoc GraphQL | `npm run gql -- '<query>'` |
| GraphQL codegen | `npm run graphql-codegen` |
| Dev server | `npm run dev` (runs `shopify app dev`, creates tunnel) |
| Build | `npm run build` |
| Lint | `npm run lint` |
| DB setup | `npm run setup` (prisma generate + migrate deploy) |
| Deploy | `npm run deploy` |

## Architecture

**Scripts (`scripts/`)** — the core of the project. Standalone CLI tools run via `tsx`:
- `shared/shopify-client.ts` — typed GraphQL client with `#graphql` tagged template inference
- `shared/shopify-auth.ts` — session/token management for CLI scripts (separate from app auth)
- `shared/translation-runner.ts` — generic translation processing engine (CSV → GraphQL mutations, with progress tracking, digest-based dedup, retry logic)
- `gql.ts` — CLI entry point for ad-hoc GraphQL queries (`npm run gql`)
- Subdirectories (`articles/`, `collections/`, `products/`, `orders/`) contain domain-specific scripts

**Remix app (`app/`)** — template-generated scaffolding, file-based routing:
- `app.*` routes — authenticated app pages (behind Shopify OAuth)
- `auth.*` routes — OAuth login flow
- `webhooks.app.*` routes — Shopify webhook handlers
- `shopify.server.ts` — Shopify app initialization, auth config, API clients
- `db.server.ts` — Prisma client singleton

## Script Development Workflow

When writing new scripts:
1. Look up the needed GraphQL query/mutation using the **Shopify Dev MCP server** (`shopify-dev-mcp`)
2. Write the query using `#graphql` tagged template literals for type inference
3. Run `npm run graphql-codegen` to generate types into `app/types/`
4. Use `adminQuery()` from `scripts/shared/shopify-client.ts` for typed execution

## Tech Stack

- **Remix 2.16** + Vite 6 + React 18
- **@shopify/shopify-app-remix** for auth, session, API access
- **@shopify/polaris** for UI components
- **Prisma** with SQLite (dev) for session storage
- **GraphQL codegen** (`@shopify/api-codegen-preset`) — types generated to `app/types/`
- **Node** >=20.19 <22 || >=22.12

## GraphQL Type Generation

Types are generated from `#graphql` tagged template literals found in `app/` and `scripts/`. Config is in `.graphqlrc.ts` (uses `ApiVersion.July25`). Run `npm run graphql-codegen` after modifying any GraphQL query/mutation. Generated types go to `app/types/`.

**Important:** Always use the `#graphql` tagged template literal when writing GraphQL queries and mutations. This ensures types are inferred in the IDE and can be processed by graphql-codegen. Avoid writing custom types and interfaces for GraphQL responses where possible — rely on the generated types instead.

## Translation Scripts Pattern

Translation scripts follow a consistent pattern:
1. Read CSV input files from a `data/` subdirectory
2. Use `translation-runner.ts` which handles progress tracking (JSON files), digest-based change detection, dry-run mode, and retry with backoff
3. Execute `translationsRegister` GraphQL mutations against Shopify Admin API
4. Support ~24 languages (bg, cs, da, de, el, es, fi, fr, hr, hu, it, lt, nl, pl, pt-pt, ro, sk, sl, sv)

## Shopify App Config

- **Client ID:** defined in `shopify.app.toml`
- **Scopes:** products, translations, metaobjects, orders, customers, online_store_navigation (read+write)
- **Webhook subscriptions:** `app/uninstalled`, `app/scopes_update`
- **Embedded:** true (renders inside Shopify Admin)
