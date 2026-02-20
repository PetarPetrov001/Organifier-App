import { readFileSync } from "fs";
import { adminQuery, type GraphQLResponse } from "../../shared/shopify-client.js";
import { disconnect } from "../../shared/shopify-auth.js";
import { sleep } from "../../shared/helpers.js";
import type { CollectionUpdateMutation } from "../../../app/types/admin.generated.js";

interface EnCollectionEntry {
  id: string;
  title: string;
  handle: string;
  description: string;
  parentId: string | null;
  count: number;
}

const COLLECTION_UPDATE_MUTATION = `#graphql
  mutation collectionUpdate($input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection {
        id
        title
        handle
        descriptionHtml
      }
      userErrors {
        field
        message
      }
    }
  }
` as const;

function descriptionToHtml(description: string): string {
  return description
    .split("\n\n")
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

async function main() {
  const collections: EnCollectionEntry[] = JSON.parse(
    readFileSync(new URL("./en.json", import.meta.url), "utf-8"),
  );

  console.log(`=== Override Collections from EN ===`);
  console.log(`Total collections: ${collections.length}`);
  console.log();

  let successCount = 0;
  let failedCount = 0;

  try {
    for (let i = 0; i < collections.length; i++) {
      const col = collections[i];
      const prefix = `[${i + 1}/${collections.length}] ${col.handle}`;

      const result: GraphQLResponse<CollectionUpdateMutation> = await adminQuery(COLLECTION_UPDATE_MUTATION, {
        input: {
          id: col.id,
          title: col.title,
          handle: col.handle,
          descriptionHtml: descriptionToHtml(col.description),
          redirectNewHandle: true,
        },
      });

      if (result.errors) {
        console.error(
          `${prefix} — GraphQL errors:`,
          result.errors.map((e) => e.message).join("; "),
        );
        failedCount++;
        await sleep(200);
        continue;
      }

      const { userErrors, collection } = result.data!.collectionUpdate!;
      if (userErrors.length > 0) {
        console.error(
          `${prefix} — userErrors:`,
          userErrors.map((e) => `${e.field}: ${e.message}`).join("; "),
        );
        failedCount++;
        await sleep(10);
        continue;
      }

      console.log(`${prefix} — updated (${collection!.handle})`);
      successCount++;
      await sleep(200);
    }
  } finally {
    await disconnect();
  }

  console.log();
  console.log(`=== Summary ===`);
  console.log(`Succeeded: ${successCount}`);
  console.log(`Failed:    ${failedCount}`);
  console.log(`Total:     ${collections.length}`);
}

main();
