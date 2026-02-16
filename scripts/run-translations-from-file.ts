import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { parse } from "csv-parse/sync";
import { adminQuery, disconnect, GraphQLResponse } from "./shopify-admin.js";

// --- Configuration ---

const LOCALE = "cs";
const INPUT_CSV_PATH = `scripts/translationInputFiles/${LOCALE}.csv`;
const RESOURCES_JSON_PATH = "scripts/product-translation-resources.json";
const PROGRESS_JSON_PATH = `scripts/translationOutputs/${LOCALE}/translated.json`;
const DRY_RUN = false;
const SLEEP_MS_BETWEEN_REQUESTS = 200;
const MAX_RETRIES = 6;

// --- Types ---

interface CsvRow {
  ID: string;
  GID: string;
  Title: string;
  "Body HTML": string;
}

interface TranslatableContent {
  digest: string | null;
  key: string;
  locale: string;
  value: string | null;
}

interface TranslatableResource {
  resourceId: string;
  translatableContent: TranslatableContent[];
}

interface ProgressEntry {
  resourceId: string;
  locale: string;
  key: string;
  digest: string;
  valueHash: string;
  translatedAt: string;
  status: "success" | "failed";
  error?: string;
}

interface ProgressFile {
  version: 1;
  entries: ProgressEntry[];
}

interface TranslationsRegisterResult {
  translationsRegister: {
    translations: Array<{ key: string; locale: string; value: string }> | null;
    userErrors: Array<{
      code: string | null;
      field: string[] | null;
      message: string;
    }>;
  };
}

// --- GraphQL ---

const REGISTER_MUTATION = `#graphql
  mutation translationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
    translationsRegister(resourceId: $resourceId, translations: $translations) {
      translations {
        key
        locale
        value
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

// --- Helpers ---

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf-8").digest("hex");
}

function progressKey(
  resourceId: string,
  locale: string,
  key: string,
  digest: string,
  valueHash: string,
): string {
  return `${resourceId}|${locale}|${key}|${digest}|${valueHash}`;
}

function resolvePath(relativePath: string): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = dirname(scriptDir);
  return `${projectRoot}/${relativePath}`;
}

function loadProgress(path: string): ProgressFile {
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as ProgressFile;
  }
  return { version: 1, entries: [] };
}

function saveProgress(path: string, progress: ProgressFile): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(progress, null, 2));
}

function buildSuccessSet(progress: ProgressFile): Set<string> {
  const set = new Set<string>();
  for (const entry of progress.entries) {
    if (entry.status === "success") {
      set.add(
        progressKey(
          entry.resourceId,
          entry.locale,
          entry.key,
          entry.digest,
          entry.valueHash,
        ),
      );
    }
  }
  return set;
}

function findDigest(resource: TranslatableResource, key: string): string | null {
  const matches = resource.translatableContent.filter((c) => c.key === key);
  if (matches.length === 0) return null;

  // Prefer locale === "en" if multiple exist
  const enMatch = matches.find((c) => c.locale === "en");
  const best = enMatch ?? matches[0];
  return best.digest;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("503") ||
      msg.includes("502") ||
      msg.includes("500") ||
      msg.includes("throttl") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed")
    );
  }
  return false;
}

// --- Main ---

const CSV_KEY_MAP: Array<{ csvColumn: keyof CsvRow; shopifyKey: string }> = [
  { csvColumn: "Title", shopifyKey: "title" },
  { csvColumn: "Body HTML", shopifyKey: "body_html" },
];

console.log(`=== Translation Registration ===`);
console.log(`Locale:   ${LOCALE}`);
console.log(`CSV:      ${INPUT_CSV_PATH}`);
console.log(`Dry run:  ${DRY_RUN}`);
console.log();

// 1. Read & parse CSV
const csvPath = resolvePath(INPUT_CSV_PATH);
const csvText = readFileSync(csvPath, "utf-8");
const rows: CsvRow[] = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});
console.log(`Parsed ${rows.length} rows from CSV`);

// 2. Load resources JSON into Map
const resourcesPath = resolvePath(RESOURCES_JSON_PATH);
const resourcesJson: TranslatableResource[] = JSON.parse(
  readFileSync(resourcesPath, "utf-8"),
);
const resourceMap = new Map<string, TranslatableResource>();
for (const r of resourcesJson) {
  resourceMap.set(r.resourceId, r);
}
console.log(`Loaded ${resourceMap.size} resources from JSON`);

// 3. Load or init progress
const progressPath = resolvePath(PROGRESS_JSON_PATH);
const progress = loadProgress(progressPath);
const successSet = buildSuccessSet(progress);
console.log(`Progress: ${successSet.size} successful entries already recorded`);
console.log();

// 4. Counters
let successCount = 0;
let skippedDone = 0;
let skippedMissing = 0;
let failedCount = 0;

try {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const resourceId = row.GID;
    const prefix = `[${i + 1}/${rows.length}] ${resourceId}`;

    // 5a. Find resource
    const resource = resourceMap.get(resourceId);
    if (!resource) {
      console.log(`${prefix} — skipped (no matching resource)`);
      skippedMissing++;
      continue;
    }

    // 5b. Build translations array
    const translations: Array<{
      key: string;
      locale: string;
      value: string;
      translatableContentDigest: string;
    }> = [];
    const translationMeta: Array<{
      key: string;
      digest: string;
      valueHash: string;
    }> = [];

    for (const { csvColumn, shopifyKey } of CSV_KEY_MAP) {
      const value = row[csvColumn];
      if (!value || value.trim() === "") {
        continue;
      }

      const digest = findDigest(resource, shopifyKey);
      if (!digest) {
        console.log(`${prefix} — skipped key "${shopifyKey}" (no digest)`);
        continue;
      }

      const vHash = sha256(value);

      // Check idempotency
      const pKey = progressKey(resourceId, LOCALE, shopifyKey, digest, vHash);
      if (successSet.has(pKey)) {
        continue; // already done
      }

      translations.push({
        key: shopifyKey,
        locale: LOCALE,
        value,
        translatableContentDigest: digest,
      });
      translationMeta.push({ key: shopifyKey, digest, valueHash: vHash });
    }

    // 5c. Skip if nothing to send
    if (translations.length === 0) {
      console.log(`${prefix} — skipped (already done or no translatable keys)`);
      skippedDone++;
      continue;
    }

    // 5d. Dry run
    if (DRY_RUN) {
      console.log(
        `${prefix} — DRY RUN: would send ${translations.length} key(s): ${translations.map((t) => t.key).join(", ")}`,
      );
      continue;
    }

    // 5e. Call mutation with retries
    console.log(
      `${prefix} — sending ${translations.length} key(s): ${translations.map((t) => t.key).join(", ")}`,
    );

    let lastError: string | null = null;
    let mutationSucceeded = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result: GraphQLResponse<TranslationsRegisterResult> =
          await adminQuery(REGISTER_MUTATION, { resourceId, translations });

        // Check for top-level GraphQL errors
        if (result.errors) {
          const errMsg = result.errors.map((e) => e.message).join("; ");
          const isThrottled = errMsg.toLowerCase().includes("throttl");
          if (isThrottled && attempt < MAX_RETRIES) {
            const backoff =
              Math.min(1000 * Math.pow(2, attempt), 30000) +
              Math.random() * 500;
            console.log(
              `${prefix} — throttled, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
            );
            await sleep(backoff);
            continue;
          }
          lastError = `GraphQL errors: ${errMsg}`;
          break;
        }

        // Check userErrors
        const { userErrors } = result.data!.translationsRegister;
        if (userErrors.length > 0) {
          lastError = userErrors
            .map((e) => `${e.code ?? "ERROR"}: ${e.message}`)
            .join("; ");
          // userErrors are typically non-retryable
          break;
        }

        // Success!
        mutationSucceeded = true;

        // Throttle awareness: check extensions
        const ext = result.extensions as
          | {
              cost?: {
                throttleStatus?: { currentlyAvailable?: number };
              };
            }
          | undefined;
        const available = ext?.cost?.throttleStatus?.currentlyAvailable;
        if (available !== undefined && available < 100) {
          console.log(
            `${prefix} — throttle budget low (${available}), sleeping extra 1s`,
          );
          await sleep(1000);
        }

        break;
      } catch (error) {
        if (isTransientError(error) && attempt < MAX_RETRIES) {
          const backoff =
            Math.min(1000 * Math.pow(2, attempt), 30000) +
            Math.random() * 500;
          console.log(
            `${prefix} — transient error, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await sleep(backoff);
          continue;
        }
        lastError = error instanceof Error ? error.message : String(error);
        break;
      }
    }

    // 5f. Record results
    const now = new Date().toISOString();

    if (mutationSucceeded) {
      for (const meta of translationMeta) {
        const entry: ProgressEntry = {
          resourceId,
          locale: LOCALE,
          key: meta.key,
          digest: meta.digest,
          valueHash: meta.valueHash,
          translatedAt: now,
          status: "success",
        };
        progress.entries.push(entry);
        successSet.add(
          progressKey(resourceId, LOCALE, meta.key, meta.digest, meta.valueHash),
        );
      }
      successCount++;
    } else {
      console.log(`${prefix} — FAILED: ${lastError}`);
      // Remove previous failed entries for this combo to avoid duplicates
      for (const meta of translationMeta) {
        progress.entries = progress.entries.filter(
          (e) =>
            !(
              e.resourceId === resourceId &&
              e.locale === LOCALE &&
              e.key === meta.key &&
              e.status === "failed"
            ),
        );
        const entry: ProgressEntry = {
          resourceId,
          locale: LOCALE,
          key: meta.key,
          digest: meta.digest,
          valueHash: meta.valueHash,
          translatedAt: now,
          status: "failed",
          error: lastError ?? "Unknown error",
        };
        progress.entries.push(entry);
      }
      failedCount++;
    }

    // 5g. Persist progress immediately
    saveProgress(progressPath, progress);

    // 5h. Throttle between requests
    await sleep(SLEEP_MS_BETWEEN_REQUESTS);
  }

  // 6. Summary
  console.log();
  console.log(`=== Summary ===`);
  console.log(`Total rows:       ${rows.length}`);
  console.log(`Succeeded:        ${successCount}`);
  console.log(`Skipped (done):   ${skippedDone}`);
  console.log(`Skipped (no res): ${skippedMissing}`);
  console.log(`Failed:           ${failedCount}`);
  console.log(`Progress saved:   ${progressPath}`);
} finally {
  await disconnect();
}
