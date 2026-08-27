import { AIProviderId } from "./ai";
import { SalesPlatformId } from "./platform";
import { SellerProfile } from "./seller";

export type SalesGoal = "fast" | "balanced" | "maximize";

export type UserPreferences = {
  preferredProvider: AIProviderId;
  preferredPlatforms: SalesPlatformId[];
  salesGoal: SalesGoal;
  sellerProfile: SellerProfile;
};

export const SALES_GOAL_LABELS: Record<SalesGoal, string> = {
  fast: "Schnell verkaufen",
  balanced: "Guter Marktpreis",
  maximize: "Maximaler Erlös",
};
