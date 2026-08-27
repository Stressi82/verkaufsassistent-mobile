export type ShippingMode = "unset" | "pickup" | "shipping" | "both";
export type ShippingCostMode = "buyer_pays" | "free" | "fixed";
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "paypal"
  | "platform";

export type SellerProfile = {
  country: "DE" | "AT";
  postalCode: string;
  city: string;
  shippingMode: ShippingMode;
  shippingCostMode: ShippingCostMode;
  shippingCost: string;
  carrier: string;
  paymentMethods: PaymentMethod[];
  privateSeller: boolean;
};

export const DEFAULT_SELLER_PROFILE: SellerProfile = {
  country: "DE",
  postalCode: "",
  city: "",
  shippingMode: "unset",
  shippingCostMode: "buyer_pays",
  shippingCost: "",
  carrier: "",
  paymentMethods: [],
  privateSeller: true,
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Bar bei Abholung",
  bank_transfer: "Überweisung",
  paypal: "PayPal",
  platform: "Plattform-Zahlung",
};

export const SHIPPING_LABELS: Record<ShippingMode, string> = {
  unset: "Noch nicht gewählt",
  pickup: "Nur Abholung",
  shipping: "Nur Versand",
  both: "Abholung oder Versand",
};
