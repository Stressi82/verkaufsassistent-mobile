export type ShippingPriority = "cheapest" | "tracking" | "insured";
export type ShippingDestinationMode = "door" | "shop" | "either";

export type ShippingPackageInput = {
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  priority: ShippingPriority;
  destinationMode: ShippingDestinationMode;
};

export type ShippingCarrierId = "dhl" | "hermes" | "dpd";

export type ShippingQuote = {
  id: string;
  carrierId: ShippingCarrierId;
  carrier: string;
  product: string;
  price: number;
  tracking: boolean;
  liabilityEur: number;
  deliveryMode: "door" | "shop";
  fit: boolean;
  fitReason: string;
  estimatedDays?: string;
  sourceCheckedAt: string;
  sourceValidFrom?: string;
  purchaseUrl: string;
};

export type ShippingRecommendation = {
  inputValid: boolean;
  validationMessages: string[];
  matches: ShippingQuote[];
  recommendedId: string | null;
  warnings: string[];
};

export const DEFAULT_SHIPPING_PACKAGE: ShippingPackageInput = {
  weightKg: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  priority: "tracking",
  destinationMode: "door",
};
