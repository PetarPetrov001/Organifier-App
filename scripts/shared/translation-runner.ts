import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { adminQuery, type GraphQLResponse } from "../shopify-admin.js";
import type { TranslationsRegisterMutation } from "../../app/types/admin.generated.js";
import { disconnect } from "../shopify-auth.js";
import type {
  TranslatableResource,
  ProgressEntry,
} from "./types.js";
import { sleep, sha256, isTransientError, chunk } from "./helpers.js";
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
  concurrency?: number;
  /** Optional map to remap CSV GIDs to resource GIDs (e.g. Product → Metafield) */
  gidMap?: Record<string, string>;
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

interface WorkItem {
  index: number;
  resourceId: string;
  translations: Array<{
    key: string;
    locale: string;
    value: string;
    translatableContentDigest: string;
  }>;
  translationMeta: Array<{
    key: string;
    digest: string;
    valueHash: string;
  }>;
}

interface WorkResult {
  item: WorkItem;
  succeeded: boolean;
  error: string | null;
  throttled: boolean;
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
  const concurrency = Math.max(1, config.concurrency ?? 1);

  console.log(`=== ${label} Translation Registration ===`);
  console.log(`Locale:      ${locale}`);
  console.log(`CSV:         ${inputCsvPath}`);
  console.log(`Dry run:     ${dryRun}`);
  console.log(`Concurrency: ${concurrency}`);
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

  // 5. Build work items (sequential, no API calls)
  const workItems: WorkItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const csvGid = row[config.gidColumn ?? "GID"];
    const resourceId = config.gidMap?.[csvGid] ?? csvGid;
    const prefix = `[${i + 1}/${rows.length}] ${resourceId}`;

    const resource = resourceMap.get(resourceId);
    if (!resource) {
      console.log(`${prefix} — skipped (no matching resource)`);
      skippedMissing++;
      continue;
    }

    const translations: WorkItem["translations"] = [];
    const translationMeta: WorkItem["translationMeta"] = [];

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

      const pKey = progressKey(resourceId, locale, shopifyKey, digest, vHash);
      if (successSet.has(pKey)) {
        continue;
      }

      translations.push({
        key: shopifyKey,
        locale,
        value,
        translatableContentDigest: digest,
      });
      translationMeta.push({ key: shopifyKey, digest, valueHash: vHash });
    }

    if (translations.length === 0) {
      console.log(
        `${prefix} — skipped (already done or no translatable keys)`,
      );
      skippedDone++;
      continue;
    }

    if (dryRun) {
      console.log(
        `${prefix} — DRY RUN: would send ${translations.length} key(s): ${translations.map((t) => t.key).join(", ")}`,
      );
      continue;
    }

    workItems.push({ index: i, resourceId, translations, translationMeta });
  }

  if (dryRun || workItems.length === 0) {
    console.log();
    console.log(`=== Summary ===`);
    console.log(`Total rows:       ${rows.length}`);
    console.log(`To process:       ${workItems.length}`);
    console.log(`Skipped (done):   ${skippedDone}`);
    console.log(`Skipped (no res): ${skippedMissing}`);
    await disconnect();
    return;
  }

  console.log(`Work items to process: ${workItems.length}`);
  console.log();

  // 6. Process work items in batches
  async function processOne(item: WorkItem): Promise<WorkResult> {
    const prefix = `[${item.index + 1}/${rows.length}] ${item.resourceId}`;
    console.log(
      `${prefix} — sending ${item.translations.length} key(s): ${item.translations.map((t) => t.key).join(", ")}`,
    );

    let lastError: string | null = null;
    let mutationSucceeded = false;
    let throttled = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result: GraphQLResponse<TranslationsRegisterMutation> =
          await adminQuery(REGISTER_MUTATION, {
            resourceId: item.resourceId,
            translations: item.translations,
          });

        if (result.errors) {
          const errMsg = result.errors.map((e) => e.message).join("; ");
          const isThrottled = errMsg.toLowerCase().includes("throttl");
          if (isThrottled && attempt < maxRetries) {
            throttled = true;
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

        const { userErrors } = result.data!.translationsRegister!;
        if (userErrors.length > 0) {
          lastError = userErrors
            .map((e: { code?: string | null; message: string }) =>
              `${e.code ?? "ERROR"}: ${e.message}`,
            )
            .join("; ");
          break;
        }

        mutationSucceeded = true;

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
          throttled = true;
          await sleep(1000);
        }

        break;
      } catch (error) {
        if (isTransientError(error) && attempt < maxRetries) {
          throttled = true;
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

    return {
      item,
      succeeded: mutationSucceeded,
      error: lastError,
      throttled,
    };
  }

  try {
    const batches = chunk(workItems, concurrency);

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];

      const results = await Promise.allSettled(batch.map(processOne));

      // Collect results and update progress
      const now = new Date().toISOString();
      let batchThrottled = false;

      for (const settled of results) {
        if (settled.status === "rejected") {
          // Unexpected — processOne catches internally, but guard anyway
          console.log(`Unexpected batch error: ${settled.reason}`);
          failedCount++;
          continue;
        }

        const { item, succeeded, error, throttled } = settled.value;
        const prefix = `[${item.index + 1}/${rows.length}] ${item.resourceId}`;

        if (throttled) batchThrottled = true;

        if (succeeded) {
          for (const meta of item.translationMeta) {
            const entry: ProgressEntry = {
              resourceId: item.resourceId,
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
                item.resourceId,
                locale,
                meta.key,
                meta.digest,
                meta.valueHash,
              ),
            );
          }
          successCount++;
        } else {
          console.log(`${prefix} — FAILED: ${error}`);
          for (const meta of item.translationMeta) {
            progress.entries = progress.entries.filter(
              (e) =>
                !(
                  e.resourceId === item.resourceId &&
                  e.locale === locale &&
                  e.key === meta.key &&
                  e.status === "failed"
                ),
            );
            const entry: ProgressEntry = {
              resourceId: item.resourceId,
              locale,
              key: meta.key,
              digest: meta.digest,
              valueHash: meta.valueHash,
              translatedAt: now,
              status: "failed",
              error: error ?? "Unknown error",
            };
            progress.entries.push(entry);
          }
          failedCount++;
        }
      }

      // Save progress once per batch
      saveProgress(progressJsonPath, progress);

      // Throttle-aware delay between batches
      if (b < batches.length - 1) {
        if (batchThrottled) {
          console.log(`Batch ${b + 1}/${batches.length} — throttle detected, cooling down 2s`);
          await sleep(2000);
        } else {
          await sleep(sleepMs);
        }
      }
    }

    // 7. Summary
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
