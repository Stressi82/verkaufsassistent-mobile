import { AIProviderId } from "./ai";
import { SalesPlatformId } from "./platform";

export type PlatformCopy = {
  platformId: SalesPlatformId;
  platformName: string;
  title: string;
  description: string;
  priceText: string;
  titleLimit: number | null;
  tips: string[];
  generatedBy: "ai" | "fallback";
  provider?: AIProviderId;
};

export type PlatformCopiesResponse = {
  copies: PlatformCopy[];
  generatedBy: "ai" | "fallback";
  provider?: AIProviderId;
};
