export type EbayStatus = {
  configured: boolean;
  connected: boolean;
  environment: "sandbox" | "production";
  expiresAt?: string | null;
  message?: string;
  policyStatus?: {
    checked: boolean;
    fulfillmentPolicies: number | null;
    paymentPolicies: number | null;
    returnPolicies: number | null;
  };
};

export type EbayCategorySuggestion = {
  categoryId: string;
  categoryName: string;
  breadcrumb: string;
};

export type EbayPolicy = {
  id: string;
  name: string;
};

export type EbayAspect = {
  name: string;
  required: boolean;
  mode: string;
  values: string[];
  prefilledValue?: string;
};

export type EbayCondition = {
  conditionId: string;
  conditionEnum: string;
  name: string;
  helpText?: string;
};

export type EbayInventoryLocation = {
  merchantLocationKey: string;
  name?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

export type EbayPreflight = {
  connected: boolean;
  marketplaceId: string;
  categoryTreeId: string;
  categories: EbayCategorySuggestion[];
  selectedCategoryId: string;
  aspects: EbayAspect[];
  conditions: EbayCondition[];
  paymentPolicies: EbayPolicy[];
  fulfillmentPolicies: EbayPolicy[];
  returnPolicies: EbayPolicy[];
  locations: EbayInventoryLocation[];
  defaults: {
    sku: string;
    merchantLocationKey: string;
    paymentPolicyId: string;
    fulfillmentPolicyId: string;
    returnPolicyId: string;
    condition: string;
  };
  warnings: string[];
};

export type EbayPublishConfig = {
  categoryId: string;
  sku: string;
  merchantLocationKey: string;
  paymentPolicyId: string;
  fulfillmentPolicyId: string;
  returnPolicyId: string;
  condition: string;
  quantity: number;
  aspects: Record<string, string[]>;
};

export type EbayPublishResult = {
  ok: boolean;
  listingId: string;
  offerId: string;
  sku: string;
  listingUrl: string;
  imageUrls: string[];
};

export type EbayDiagnosticCheck = {
  id: string;
  label: string;
  status: "ok" | "warning" | "error" | "pending";
  detail: string;
};

export type EbayDiagnostics = {
  environment: "sandbox" | "production";
  marketplaceId: string;
  configured: boolean;
  connected: boolean;
  callbackUrl: string | null;
  runameConfigured: boolean;
  applicationKeysValid: boolean | null;
  tokenExpiresAt: string | null;
  inventoryApiReachable: boolean | null;
  inventoryApiVersion: string | null;
  categoryTreeId: string | null;
  fulfillmentPolicies: number | null;
  paymentPolicies: number | null;
  returnPolicies: number | null;
  locations: number | null;
  readyForPreflight: boolean;
  readyForPublish: boolean;
  checks: EbayDiagnosticCheck[];
  statusUrl: string;
  sandboxHelpUrl: string;
};
