export type BuyerMessageTemplateId =
  | "availability"
  | "shipping"
  | "pickup"
  | "payment"
  | "price"
  | "reservation"
  | "sold"
  | "offer_accept"
  | "offer_decline"
  | "offer_counter";

export type BuyerMessageTemplate = {
  id: BuyerMessageTemplateId;
  title: string;
  text: string;
  available: boolean;
  reason?: string;
};

export type BuyerMessageState = {
  customText: string;
  lastTemplateId?: BuyerMessageTemplateId | null;
  buyerOffer?: string;
  updatedAt: string;
};
