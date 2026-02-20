import { adminQuery } from "./shared/shopify-client.js";
import { DEFAULT_SHOP, listStores, disconnect } from "./shared/shopify-auth.js";

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
