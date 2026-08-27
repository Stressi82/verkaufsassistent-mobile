import { AIProviderId } from "./ai";
import { ListingDraft, PhotoItem } from "./listing";
import { SalesPlatformId } from "./platform";
import { SellerProfile } from "./seller";
import { PhotoAuditResult } from "./photoAudit";
import { ShippingPackageInput, ShippingQuote } from "./shipping";
import { LifecycleEvent, ListingStatus } from "./lifecycle";
import { PlatformPublication, SaleSource } from "./platformCleanup";
import { BuyerMessageState } from "./buyerMessages";

export type PlatformListingStatus = "not_selected" | "prepared" | "online" | "sold" | "removed";

export type PriceHistoryEntry = {
  value: string;
  priceType: "VB" | "Festpreis";
  changedAt: string;
};

export type ListingRecord = {
  id: string;
  draft: ListingDraft;
  photos: PhotoItem[];
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  soldAt?: string | null;
  firstOnlineAt?: string | null;
  priceHistory?: PriceHistoryEntry[];
  selectedProvider: AIProviderId;
  sellerProfile: SellerProfile;
  platformStatuses: Partial<Record<SalesPlatformId, PlatformListingStatus>>;
  photoAudit?: PhotoAuditResult | null;
  privacyAcknowledged?: boolean;
  shippingPackage?: ShippingPackageInput | null;
  shippingSelection?: ShippingQuote | null;
  lifecycleHistory?: LifecycleEvent[];
  platformPublications?: Partial<Record<SalesPlatformId, PlatformPublication>>;
  saleSource?: SaleSource | null;
  buyerMessageState?: BuyerMessageState | null;
};

export type SalesCenterCounts = {
  draft: number;
  online: number;
  sold: number;
};
