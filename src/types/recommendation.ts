import { SalesPlatformId } from "./platform";

export type ProductGroup =
  | "fashion"
  | "electronics"
  | "home_furniture"
  | "tools_garden"
  | "children"
  | "collectibles"
  | "books_media"
  | "sports"
  | "vehicle_parts"
  | "general";

export type PlatformRecommendation = {
  platformId: SalesPlatformId;
  score: number;
  recommended: boolean;
  reasons: string[];
};

export type RecommendationResult = {
  productGroup: ProductGroup;
  productGroupLabel: string;
  localPickupLikely: boolean;
  shippingFriendlyLikely: boolean;
  recommendations: PlatformRecommendation[];
};
