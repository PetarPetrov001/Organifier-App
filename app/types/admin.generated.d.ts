/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

export type PopulateProductMutationVariables = AdminTypes.Exact<{
  product: AdminTypes.ProductCreateInput;
}>;


export type PopulateProductMutation = { productCreate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<(
      Pick<AdminTypes.Product, 'id' | 'title' | 'handle' | 'status'>
      & { variants: { edges: Array<{ node: Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'barcode' | 'createdAt'> }> } }
    )> }> };

export type ShopifyRemixTemplateUpdateVariantMutationVariables = AdminTypes.Exact<{
  productId: AdminTypes.Scalars['ID']['input'];
  variants: Array<AdminTypes.ProductVariantsBulkInput> | AdminTypes.ProductVariantsBulkInput;
}>;


export type ShopifyRemixTemplateUpdateVariantMutation = { productVariantsBulkUpdate?: AdminTypes.Maybe<{ productVariants?: AdminTypes.Maybe<Array<Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'barcode' | 'createdAt'>>> }> };

export type GetTranslatableArticlesQueryVariables = AdminTypes.Exact<{
  resourceType: AdminTypes.TranslatableResourceType;
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetTranslatableArticlesQuery = { translatableResources: { nodes: Array<(
      Pick<AdminTypes.TranslatableResource, 'resourceId'>
      & { translatableContent: Array<Pick<AdminTypes.TranslatableContent, 'digest' | 'key' | 'locale' | 'value'>> }
    )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type GetTranslatableProductsQueryVariables = AdminTypes.Exact<{
  resourceType: AdminTypes.TranslatableResourceType;
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetTranslatableProductsQuery = { translatableResources: { nodes: Array<(
      Pick<AdminTypes.TranslatableResource, 'resourceId'>
      & { translatableContent: Array<Pick<AdminTypes.TranslatableContent, 'digest' | 'key' | 'locale' | 'value'>> }
    )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type TranslationsRegisterMutationVariables = AdminTypes.Exact<{
  resourceId: AdminTypes.Scalars['ID']['input'];
  translations: Array<AdminTypes.TranslationInput> | AdminTypes.TranslationInput;
}>;


export type TranslationsRegisterMutation = { translationsRegister?: AdminTypes.Maybe<{ translations?: AdminTypes.Maybe<Array<Pick<AdminTypes.Translation, 'key' | 'locale' | 'value'>>>, userErrors: Array<Pick<AdminTypes.TranslationUserError, 'code' | 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query getTranslatableArticles(\n    $resourceType: TranslatableResourceType!\n    $first: Int!\n    $after: String\n  ) {\n    translatableResources(first: $first, after: $after, resourceType: $resourceType) {\n      nodes {\n        resourceId\n        translatableContent {\n          digest\n          key\n          locale\n          value\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": {return: GetTranslatableArticlesQuery, variables: GetTranslatableArticlesQueryVariables},
  "#graphql\n  query getTranslatableProducts(\n    $resourceType: TranslatableResourceType!\n    $first: Int!\n    $after: String\n  ) {\n    translatableResources(first: $first, after: $after, resourceType: $resourceType) {\n      nodes {\n        resourceId\n        translatableContent {\n          digest\n          key\n          locale\n          value\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": {return: GetTranslatableProductsQuery, variables: GetTranslatableProductsQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n      mutation populateProduct($product: ProductCreateInput!) {\n        productCreate(product: $product) {\n          product {\n            id\n            title\n            handle\n            status\n            variants(first: 10) {\n              edges {\n                node {\n                  id\n                  price\n                  barcode\n                  createdAt\n                }\n              }\n            }\n          }\n        }\n      }": {return: PopulateProductMutation, variables: PopulateProductMutationVariables},
  "#graphql\n    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {\n      productVariantsBulkUpdate(productId: $productId, variants: $variants) {\n        productVariants {\n          id\n          price\n          barcode\n          createdAt\n        }\n      }\n    }": {return: ShopifyRemixTemplateUpdateVariantMutation, variables: ShopifyRemixTemplateUpdateVariantMutationVariables},
  "#graphql\n  mutation translationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {\n    translationsRegister(resourceId: $resourceId, translations: $translations) {\n      translations {\n        key\n        locale\n        value\n      }\n      userErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n": {return: TranslationsRegisterMutation, variables: TranslationsRegisterMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
