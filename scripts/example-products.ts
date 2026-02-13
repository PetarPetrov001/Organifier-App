import { adminQuery, disconnect } from "./shopify-admin.js";

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          status
        }
      }
    }
  }
`;

try {
  // Default store (from SHOPIFY_SHOP env or ertis-playground.myshopify.com)
  const result = await adminQuery(PRODUCTS_QUERY, { first: 5 });

  // To target a different store, pass it as the 3rd argument:
  // const result = await adminQuery(PRODUCTS_QUERY, { first: 5 }, "other-store.myshopify.com");

  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    process.exit(1);
  }

  console.log(JSON.stringify(result.data, null, 2));
} finally {
  await disconnect();
}
