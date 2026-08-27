import { API_URL } from "../config";
import {
  EbayAspect,
  EbayPreflight,
  EbayPublishConfig,
  EbayPublishResult,
} from "../types/ebay";
import { ListingDraft, PhotoItem } from "../types/listing";
import { PlatformCopy } from "../types/platformCopy";
import { SellerProfile } from "../types/seller";

function assertApi(): string {
  if (!API_URL) throw new Error("Backend ist noch nicht verbunden.");
  return API_URL;
}

async function jsonOrThrow(response: Response): Promise<any> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string"
        ? payload.error
        : `eBay-Serverfehler ${response.status}`
    );
  }
  return payload;
}

export async function prepareEbayListing(
  draft: ListingDraft,
  sellerProfile: SellerProfile,
  categoryId?: string
): Promise<EbayPreflight> {
  const base = assertApi();
  const response = await fetch(`${base}/ebay/preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, sellerProfile, categoryId }),
  });
  return (await jsonOrThrow(response)) as EbayPreflight;
}

export async function loadEbayCategoryDetails(
  categoryId: string,
  draft: ListingDraft
): Promise<{ aspects: EbayAspect[]; conditions: EbayPreflight["conditions"] }> {
  const base = assertApi();
  const response = await fetch(`${base}/ebay/category-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, draft }),
  });
  return await jsonOrThrow(response);
}

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() || "jpg";
}

function mimeFromExtension(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

export async function uploadEbayImages(photos: PhotoItem[]): Promise<string[]> {
  const base = assertApi();
  if (photos.length === 0) throw new Error("Mindestens ein Foto ist erforderlich.");

  const form = new FormData();
  photos.forEach((photo, index) => {
    const ext = extensionFromUri(photo.uri);
    form.append(
      "photos",
      {
        uri: photo.uri,
        name: `ebay-${index + 1}.${ext}`,
        type: mimeFromExtension(ext),
      } as unknown as Blob
    );
  });

  const response = await fetch(`${base}/ebay/media/images`, {
    method: "POST",
    body: form,
  });
  const payload = await jsonOrThrow(response);
  return Array.isArray(payload?.imageUrls) ? payload.imageUrls : [];
}

export async function publishEbayListing(args: {
  draft: ListingDraft;
  platformCopy?: PlatformCopy;
  sellerProfile: SellerProfile;
  config: EbayPublishConfig;
  imageUrls: string[];
}): Promise<EbayPublishResult> {
  const base = assertApi();
  const response = await fetch(`${base}/ebay/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return (await jsonOrThrow(response)) as EbayPublishResult;
}

export async function withdrawEbayOffer(
  offerId: string
): Promise<{ ok: boolean; listingId?: string; warnings?: string[] }> {
  const base = assertApi();
  const response = await fetch(`${base}/ebay/offer/${encodeURIComponent(offerId)}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return await jsonOrThrow(response);
}
