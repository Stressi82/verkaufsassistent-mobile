import { SalesPlatformId } from "./platform";

export type PlatformPublication = {
  platformId: SalesPlatformId;
  externalListingId?: string;
  externalOfferId?: string;
  externalSku?: string;
  listingUrl?: string;
  publishedAt: string;
  state: "online" | "removed" | "sold" | "unknown";
  removedAt?: string | null;
};

export type SaleSource = SalesPlatformId | "offline";

export type CleanupResult = {
  platformId: SalesPlatformId;
  ok: boolean;
  mode: "api" | "manual";
  message: string;
};
