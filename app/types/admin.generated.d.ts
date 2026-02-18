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

export type CollectionUpdateMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.CollectionInput;
}>;


export type CollectionUpdateMutation = { collectionUpdate?: AdminTypes.Maybe<{ collection?: AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id' | 'title' | 'handle' | 'descriptionHtml'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type GetTranslatableCollectionsQueryVariables = AdminTypes.Exact<{
  resourceType: AdminTypes.TranslatableResourceType;
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetTranslatableCollectionsQuery = { translatableResources: { nodes: Array<(
      Pick<AdminTypes.TranslatableResource, 'resourceId'>
      & { translatableContent: Array<Pick<AdminTypes.TranslatableContent, 'digest' | 'key' | 'locale' | 'value'>> }
    )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type GetOrdersQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetOrdersQuery = { orders: { nodes: Array<Pick<AdminTypes.Order, 'id' | 'email'>>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type TagsAddMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  tags: Array<AdminTypes.Scalars['String']['input']> | AdminTypes.Scalars['String']['input'];
}>;


export type TagsAddMutation = { tagsAdd?: AdminTypes.Maybe<{ node?: AdminTypes.Maybe<Pick<AdminTypes.AbandonedCheckout, 'id'> | Pick<AdminTypes.AbandonedCheckoutLineItem, 'id'> | Pick<AdminTypes.Abandonment, 'id'> | Pick<AdminTypes.AddAllProductsOperation, 'id'> | Pick<AdminTypes.AdditionalFee, 'id'> | Pick<AdminTypes.App, 'id'> | Pick<AdminTypes.AppCatalog, 'id'> | Pick<AdminTypes.AppCredit, 'id'> | Pick<AdminTypes.AppInstallation, 'id'> | Pick<AdminTypes.AppPurchaseOneTime, 'id'> | Pick<AdminTypes.AppRevenueAttributionRecord, 'id'> | Pick<AdminTypes.AppSubscription, 'id'> | Pick<AdminTypes.AppUsageRecord, 'id'> | Pick<AdminTypes.Article, 'id'> | Pick<AdminTypes.BasicEvent, 'id'> | Pick<AdminTypes.Blog, 'id'> | Pick<AdminTypes.BulkOperation, 'id'> | Pick<AdminTypes.BusinessEntity, 'id'> | Pick<AdminTypes.CalculatedOrder, 'id'> | Pick<AdminTypes.CartTransform, 'id'> | Pick<AdminTypes.CashTrackingAdjustment, 'id'> | Pick<AdminTypes.CashTrackingSession, 'id'> | Pick<AdminTypes.CatalogCsvOperation, 'id'> | Pick<AdminTypes.Channel, 'id'> | Pick<AdminTypes.ChannelDefinition, 'id'> | Pick<AdminTypes.ChannelInformation, 'id'> | Pick<AdminTypes.CheckoutProfile, 'id'> | Pick<AdminTypes.Collection, 'id'> | Pick<AdminTypes.Comment, 'id'> | Pick<AdminTypes.CommentEvent, 'id'> | Pick<AdminTypes.Company, 'id'> | Pick<AdminTypes.CompanyAddress, 'id'> | Pick<AdminTypes.CompanyContact, 'id'> | Pick<AdminTypes.CompanyContactRole, 'id'> | Pick<AdminTypes.CompanyContactRoleAssignment, 'id'> | Pick<AdminTypes.CompanyLocation, 'id'> | Pick<AdminTypes.CompanyLocationCatalog, 'id'> | Pick<AdminTypes.CompanyLocationStaffMemberAssignment, 'id'> | Pick<AdminTypes.ConsentPolicy, 'id'> | Pick<AdminTypes.CurrencyExchangeAdjustment, 'id'> | Pick<AdminTypes.Customer, 'id'> | Pick<AdminTypes.CustomerAccountAppExtensionPage, 'id'> | Pick<AdminTypes.CustomerAccountNativePage, 'id'> | Pick<AdminTypes.CustomerPaymentMethod, 'id'> | Pick<AdminTypes.CustomerSegmentMembersQuery, 'id'> | Pick<AdminTypes.CustomerVisit, 'id'> | Pick<AdminTypes.DeliveryCarrierService, 'id'> | Pick<AdminTypes.DeliveryCondition, 'id'> | Pick<AdminTypes.DeliveryCountry, 'id'> | Pick<AdminTypes.DeliveryCustomization, 'id'> | Pick<AdminTypes.DeliveryLocationGroup, 'id'> | Pick<AdminTypes.DeliveryMethod, 'id'> | Pick<AdminTypes.DeliveryMethodDefinition, 'id'> | Pick<AdminTypes.DeliveryParticipant, 'id'> | Pick<AdminTypes.DeliveryProfile, 'id'> | Pick<AdminTypes.DeliveryProfileItem, 'id'> | Pick<AdminTypes.DeliveryPromiseParticipant, 'id'> | Pick<AdminTypes.DeliveryPromiseProvider, 'id'> | Pick<AdminTypes.DeliveryProvince, 'id'> | Pick<AdminTypes.DeliveryRateDefinition, 'id'> | Pick<AdminTypes.DeliveryZone, 'id'> | Pick<AdminTypes.DiscountAutomaticBxgy, 'id'> | Pick<AdminTypes.DiscountAutomaticNode, 'id'> | Pick<AdminTypes.DiscountCodeNode, 'id'> | Pick<AdminTypes.DiscountNode, 'id'> | Pick<AdminTypes.DiscountRedeemCodeBulkCreation, 'id'> | Pick<AdminTypes.Domain, 'id'> | Pick<AdminTypes.DraftOrder, 'id'> | Pick<AdminTypes.DraftOrderLineItem, 'id'> | Pick<AdminTypes.DraftOrderTag, 'id'> | Pick<AdminTypes.Duty, 'id'> | Pick<AdminTypes.ExchangeLineItem, 'id'> | Pick<AdminTypes.ExchangeV2, 'id'> | Pick<AdminTypes.ExternalVideo, 'id'> | Pick<AdminTypes.Fulfillment, 'id'> | Pick<AdminTypes.FulfillmentConstraintRule, 'id'> | Pick<AdminTypes.FulfillmentEvent, 'id'> | Pick<AdminTypes.FulfillmentHold, 'id'> | Pick<AdminTypes.FulfillmentLineItem, 'id'> | Pick<AdminTypes.FulfillmentOrder, 'id'> | Pick<AdminTypes.FulfillmentOrderDestination, 'id'> | Pick<AdminTypes.FulfillmentOrderLineItem, 'id'> | Pick<AdminTypes.FulfillmentOrderMerchantRequest, 'id'> | Pick<AdminTypes.GenericFile, 'id'> | Pick<AdminTypes.GiftCard, 'id'> | Pick<AdminTypes.GiftCardCreditTransaction, 'id'> | Pick<AdminTypes.GiftCardDebitTransaction, 'id'> | Pick<AdminTypes.InventoryAdjustmentGroup, 'id'> | Pick<AdminTypes.InventoryItem, 'id'> | Pick<AdminTypes.InventoryItemMeasurement, 'id'> | Pick<AdminTypes.InventoryLevel, 'id'> | Pick<AdminTypes.InventoryQuantity, 'id'> | Pick<AdminTypes.InventoryShipment, 'id'> | Pick<AdminTypes.InventoryShipmentLineItem, 'id'> | Pick<AdminTypes.InventoryTransfer, 'id'> | Pick<AdminTypes.InventoryTransferLineItem, 'id'> | Pick<AdminTypes.LineItem, 'id'> | Pick<AdminTypes.LineItemGroup, 'id'> | Pick<AdminTypes.Location, 'id'> | Pick<AdminTypes.MailingAddress, 'id'> | Pick<AdminTypes.Market, 'id'> | Pick<AdminTypes.MarketCatalog, 'id'> | Pick<AdminTypes.MarketRegionCountry, 'id'> | Pick<AdminTypes.MarketWebPresence, 'id'> | Pick<AdminTypes.MarketingActivity, 'id'> | Pick<AdminTypes.MarketingEvent, 'id'> | Pick<AdminTypes.MediaImage, 'id'> | Pick<AdminTypes.Menu, 'id'> | Pick<AdminTypes.Metafield, 'id'> | Pick<AdminTypes.MetafieldDefinition, 'id'> | Pick<AdminTypes.Metaobject, 'id'> | Pick<AdminTypes.MetaobjectDefinition, 'id'> | Pick<AdminTypes.Model3d, 'id'> | Pick<AdminTypes.OnlineStoreTheme, 'id'> | Pick<AdminTypes.Order, 'id'> | Pick<AdminTypes.OrderAdjustment, 'id'> | Pick<AdminTypes.OrderDisputeSummary, 'id'> | Pick<AdminTypes.OrderTransaction, 'id'> | Pick<AdminTypes.Page, 'id'> | Pick<AdminTypes.PaymentCustomization, 'id'> | Pick<AdminTypes.PaymentMandate, 'id'> | Pick<AdminTypes.PaymentSchedule, 'id'> | Pick<AdminTypes.PaymentTerms, 'id'> | Pick<AdminTypes.PaymentTermsTemplate, 'id'> | Pick<AdminTypes.PointOfSaleDevice, 'id'> | Pick<AdminTypes.PriceList, 'id'> | Pick<AdminTypes.PriceRule, 'id'> | Pick<AdminTypes.PriceRuleDiscountCode, 'id'> | Pick<AdminTypes.Product, 'id'> | Pick<AdminTypes.ProductBundleOperation, 'id'> | Pick<AdminTypes.ProductDeleteOperation, 'id'> | Pick<AdminTypes.ProductDuplicateOperation, 'id'> | Pick<AdminTypes.ProductFeed, 'id'> | Pick<AdminTypes.ProductOption, 'id'> | Pick<AdminTypes.ProductOptionValue, 'id'> | Pick<AdminTypes.ProductSetOperation, 'id'> | Pick<AdminTypes.ProductTaxonomyNode, 'id'> | Pick<AdminTypes.ProductVariant, 'id'> | Pick<AdminTypes.ProductVariantComponent, 'id'> | Pick<AdminTypes.Publication, 'id'> | Pick<AdminTypes.PublicationResourceOperation, 'id'> | Pick<AdminTypes.QuantityPriceBreak, 'id'> | Pick<AdminTypes.Refund, 'id'> | Pick<AdminTypes.RefundShippingLine, 'id'> | Pick<AdminTypes.Return, 'id'> | Pick<AdminTypes.ReturnLineItem, 'id'> | Pick<AdminTypes.ReturnableFulfillment, 'id'> | Pick<AdminTypes.ReverseDelivery, 'id'> | Pick<AdminTypes.ReverseDeliveryLineItem, 'id'> | Pick<AdminTypes.ReverseFulfillmentOrder, 'id'> | Pick<AdminTypes.ReverseFulfillmentOrderDisposition, 'id'> | Pick<AdminTypes.ReverseFulfillmentOrderLineItem, 'id'> | Pick<AdminTypes.SaleAdditionalFee, 'id'> | Pick<AdminTypes.SavedSearch, 'id'> | Pick<AdminTypes.ScriptTag, 'id'> | Pick<AdminTypes.Segment, 'id'> | Pick<AdminTypes.SellingPlan, 'id'> | Pick<AdminTypes.SellingPlanGroup, 'id'> | Pick<AdminTypes.ServerPixel, 'id'> | Pick<AdminTypes.Shop, 'id'> | Pick<AdminTypes.ShopAddress, 'id'> | Pick<AdminTypes.ShopPolicy, 'id'> | Pick<AdminTypes.ShopifyPaymentsAccount, 'id'> | Pick<AdminTypes.ShopifyPaymentsBalanceTransaction, 'id'> | Pick<AdminTypes.ShopifyPaymentsBankAccount, 'id'> | Pick<AdminTypes.ShopifyPaymentsDispute, 'id'> | Pick<AdminTypes.ShopifyPaymentsDisputeEvidence, 'id'> | Pick<AdminTypes.ShopifyPaymentsDisputeFileUpload, 'id'> | Pick<AdminTypes.ShopifyPaymentsDisputeFulfillment, 'id'> | Pick<AdminTypes.ShopifyPaymentsPayout, 'id'> | Pick<AdminTypes.StaffMember, 'id'> | Pick<AdminTypes.StandardMetafieldDefinitionTemplate, 'id'> | Pick<AdminTypes.StoreCreditAccount, 'id'> | Pick<AdminTypes.StoreCreditAccountCreditTransaction, 'id'> | Pick<AdminTypes.StoreCreditAccountDebitRevertTransaction, 'id'> | Pick<AdminTypes.StoreCreditAccountDebitTransaction, 'id'> | Pick<AdminTypes.StorefrontAccessToken, 'id'> | Pick<AdminTypes.SubscriptionBillingAttempt, 'id'> | Pick<AdminTypes.SubscriptionContract, 'id'> | Pick<AdminTypes.SubscriptionDraft, 'id'> | Pick<AdminTypes.TaxonomyAttribute, 'id'> | Pick<AdminTypes.TaxonomyCategory, 'id'> | Pick<AdminTypes.TaxonomyChoiceListAttribute, 'id'> | Pick<AdminTypes.TaxonomyMeasurementAttribute, 'id'> | Pick<AdminTypes.TaxonomyValue, 'id'> | Pick<AdminTypes.TenderTransaction, 'id'> | Pick<AdminTypes.TransactionFee, 'id'> | Pick<AdminTypes.UnverifiedReturnLineItem, 'id'> | Pick<AdminTypes.UrlRedirect, 'id'> | Pick<AdminTypes.UrlRedirectImport, 'id'> | Pick<AdminTypes.Validation, 'id'> | Pick<AdminTypes.Video, 'id'> | Pick<AdminTypes.WebPixel, 'id'> | Pick<AdminTypes.WebhookSubscription, 'id'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type GetProductsDescriptionQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetProductsDescriptionQuery = { products: { nodes: Array<Pick<AdminTypes.Product, 'id' | 'descriptionHtml'>>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type GetProductsQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetProductsQuery = { products: { nodes: Array<(
      Pick<AdminTypes.Product, 'id'>
      & { variants: { nodes: Array<Pick<AdminTypes.ProductVariant, 'sku'>> } }
    )>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type ProductUpdateMutationVariables = AdminTypes.Exact<{
  product: AdminTypes.ProductUpdateInput;
}>;


export type ProductUpdateMutation = { productUpdate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id' | 'handle'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

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
  "#graphql\n  query getTranslatableCollections(\n    $resourceType: TranslatableResourceType!\n    $first: Int!\n    $after: String\n  ) {\n    translatableResources(first: $first, after: $after, resourceType: $resourceType) {\n      nodes {\n        resourceId\n        translatableContent {\n          digest\n          key\n          locale\n          value\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": {return: GetTranslatableCollectionsQuery, variables: GetTranslatableCollectionsQueryVariables},
  "#graphql\n  query getOrders($first: Int!, $after: String) {\n    orders(first: $first, after: $after) {\n      nodes {\n        id\n        email\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": {return: GetOrdersQuery, variables: GetOrdersQueryVariables},
  "#graphql\n  query getProductsDescription(\n    $first: Int!\n    $after: String\n  ) {\n    products(first: $first, after: $after) {\n      nodes {\n        id\n        descriptionHtml\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": {return: GetProductsDescriptionQuery, variables: GetProductsDescriptionQueryVariables},
  "#graphql\n  query getProducts(\n    $first: Int!\n    $after: String\n  ) {\n    products(first: $first, after: $after) {\n      nodes {\n        id\n        variants(first: 1) {\n          nodes {\n            sku\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": {return: GetProductsQuery, variables: GetProductsQueryVariables},
  "#graphql\n  query getTranslatableProducts(\n    $resourceType: TranslatableResourceType!\n    $first: Int!\n    $after: String\n  ) {\n    translatableResources(first: $first, after: $after, resourceType: $resourceType) {\n      nodes {\n        resourceId\n        translatableContent {\n          digest\n          key\n          locale\n          value\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": {return: GetTranslatableProductsQuery, variables: GetTranslatableProductsQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n      mutation populateProduct($product: ProductCreateInput!) {\n        productCreate(product: $product) {\n          product {\n            id\n            title\n            handle\n            status\n            variants(first: 10) {\n              edges {\n                node {\n                  id\n                  price\n                  barcode\n                  createdAt\n                }\n              }\n            }\n          }\n        }\n      }": {return: PopulateProductMutation, variables: PopulateProductMutationVariables},
  "#graphql\n    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {\n      productVariantsBulkUpdate(productId: $productId, variants: $variants) {\n        productVariants {\n          id\n          price\n          barcode\n          createdAt\n        }\n      }\n    }": {return: ShopifyRemixTemplateUpdateVariantMutation, variables: ShopifyRemixTemplateUpdateVariantMutationVariables},
  "#graphql\n  mutation collectionUpdate($input: CollectionInput!) {\n    collectionUpdate(input: $input) {\n      collection {\n        id\n        title\n        handle\n        descriptionHtml\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: CollectionUpdateMutation, variables: CollectionUpdateMutationVariables},
  "#graphql\n  mutation tagsAdd($id: ID!, $tags: [String!]!) {\n    tagsAdd(id: $id, tags: $tags) {\n      node {\n        id\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: TagsAddMutation, variables: TagsAddMutationVariables},
  "#graphql\n  mutation productUpdate($product: ProductUpdateInput!) {\n    productUpdate(product: $product) {\n      product {\n        id\n        handle\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: ProductUpdateMutation, variables: ProductUpdateMutationVariables},
  "#graphql\n  mutation translationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {\n    translationsRegister(resourceId: $resourceId, translations: $translations) {\n      translations {\n        key\n        locale\n        value\n      }\n      userErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n": {return: TranslationsRegisterMutation, variables: TranslationsRegisterMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
