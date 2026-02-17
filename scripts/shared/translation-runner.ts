import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { adminQuery, type GraphQLResponse } from "../shopify-admin.js";
import type { TranslationsRegisterMutation } from "../../app/types/admin.generated.js";
import { disconnect } from "../shopify-auth.js";
import type {
  TranslatableResource,
  ProgressEntry,
} from "./types.js";
import { sleep, sha256, isTransientError } from "./helpers.js";
import {
  progressKey,
  loadProgress,
  saveProgress,
  buildSuccessSet,
} from "./progress.js";

export interface TranslationRunnerConfig {
  locale: string;
  inputCsvPath: string;
  resourcesJsonPath: string;
  progressJsonPath: string;
  dryRun: boolean;
  sleepMs: number;
  maxRetries: number;
  label: string;
  csvKeyMap: Array<{ csvColumn: string; shopifyKey: string }>;
  gidColumn?: string;
}

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
` as const;

function findDigest(
  resource: TranslatableResource,
  key: string,
): string | null {
  const matches = resource.translatableContent.filter((c) => c.key === key);
  if (matches.length === 0) return null;

  // Prefer locale === "en" if multiple exist
  const enMatch = matches.find((c) => c.locale === "en");
  const best = enMatch ?? matches[0];
  return best.digest ?? null;
}

export async function runTranslations(
  config: TranslationRunnerConfig,
): Promise<void> {
  const {
    locale,
    inputCsvPath,
    resourcesJsonPath,
    progressJsonPath,
    dryRun,
    sleepMs,
    maxRetries,
    label,
    csvKeyMap,
  } = config;

  console.log(`=== ${label} Translation Registration ===`);
  console.log(`Locale:   ${locale}`);
  console.log(`CSV:      ${inputCsvPath}`);
  console.log(`Dry run:  ${dryRun}`);
  console.log();

  // 1. Read & parse CSV
  const csvText = readFileSync(inputCsvPath, "utf-8");
  const rows: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  console.log(`Parsed ${rows.length} rows from CSV`);

  // 2. Load resources JSON into Map
  const resourcesJson: TranslatableResource[] = JSON.parse(
    readFileSync(resourcesJsonPath, "utf-8"),
  );
  const resourceMap = new Map<string, TranslatableResource>();
  for (const r of resourcesJson) {
    resourceMap.set(r.resourceId, r);
  }
  console.log(`Loaded ${resourceMap.size} resources from JSON`);

  // 3. Load or init progress
  const progress = loadProgress(progressJsonPath);
  const successSet = buildSuccessSet(progress);
  console.log(
    `Progress: ${successSet.size} successful entries already recorded`,
  );
  console.log();

  // 4. Counters
  let successCount = 0;
  let skippedDone = 0;
  let skippedMissing = 0;
  let failedCount = 0;

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const resourceId = row[config.gidColumn ?? "GID"];
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

      for (const { csvColumn, shopifyKey } of csvKeyMap) {
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
        const pKey = progressKey(resourceId, locale, shopifyKey, digest, vHash);
        if (successSet.has(pKey)) {
          continue; // already done
        }

        translations.push({
          key: shopifyKey,
          locale,
          value,
          translatableContentDigest: digest,
        });
        translationMeta.push({ key: shopifyKey, digest, valueHash: vHash });
      }

      // 5c. Skip if nothing to send
      if (translations.length === 0) {
        console.log(
          `${prefix} — skipped (already done or no translatable keys)`,
        );
        skippedDone++;
        continue;
      }

      // 5d. Dry run
      if (dryRun) {
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

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result: GraphQLResponse<TranslationsRegisterMutation> =
            await adminQuery(REGISTER_MUTATION, {
              resourceId,
              translations,
            });

          // Check for top-level GraphQL errors
          if (result.errors) {
            const errMsg = result.errors.map((e) => e.message).join("; ");
            const isThrottled = errMsg.toLowerCase().includes("throttl");
            if (isThrottled && attempt < maxRetries) {
              const backoff =
                Math.min(1000 * Math.pow(2, attempt), 30000) +
                Math.random() * 500;
              console.log(
                `${prefix} — throttled, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${maxRetries})`,
              );
              await sleep(backoff);
              continue;
            }
            lastError = `GraphQL errors: ${errMsg}`;
            break;
          }

          // Check userErrors
          const { userErrors } = result.data!.translationsRegister!;
          if (userErrors.length > 0) {
            lastError = userErrors
              .map((e: { code?: string | null; message: string }) =>
                `${e.code ?? "ERROR"}: ${e.message}`,
              )
              .join("; ");
            // userErrors are typically non-retryable
            break;
          }

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
          if (isTransientError(error) && attempt < maxRetries) {
            const backoff =
              Math.min(1000 * Math.pow(2, attempt), 30000) +
              Math.random() * 500;
            console.log(
              `${prefix} — transient error, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${maxRetries})`,
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
            locale,
            key: meta.key,
            digest: meta.digest,
            valueHash: meta.valueHash,
            translatedAt: now,
            status: "success",
          };
          progress.entries.push(entry);
          successSet.add(
            progressKey(
              resourceId,
              locale,
              meta.key,
              meta.digest,
              meta.valueHash,
            ),
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
                e.locale === locale &&
                e.key === meta.key &&
                e.status === "failed"
              ),
          );
          const entry: ProgressEntry = {
            resourceId,
            locale,
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
      saveProgress(progressJsonPath, progress);

      // 5h. Throttle between requests
      await sleep(sleepMs);
    }

    // 6. Summary
    console.log();
    console.log(`=== Summary ===`);
    console.log(`Total rows:       ${rows.length}`);
    console.log(`Succeeded:        ${successCount}`);
    console.log(`Skipped (done):   ${skippedDone}`);
    console.log(`Skipped (no res): ${skippedMissing}`);
    console.log(`Failed:           ${failedCount}`);
    console.log(`Progress saved:   ${progressJsonPath}`);
  } finally {
    await disconnect();
  }
}
