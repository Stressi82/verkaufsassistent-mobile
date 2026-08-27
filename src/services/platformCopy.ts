import { Share } from "react-native";
import { API_URL } from "../config";
import { AIProviderId } from "../types/ai";
import { ListingDraft } from "../types/listing";
import { SalesPlatformId } from "../types/platform";
import { PlatformCopy, PlatformCopiesResponse } from "../types/platformCopy";
import { SellerProfile } from "../types/seller";
import { sellerLogisticsLines } from "./seller";
import { SALES_PLATFORMS } from "./platforms";

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, limit: number | null): string {
  if (!limit || text.length <= limit) return text;
  return text.slice(0, Math.max(1, limit - 1)).trimEnd() + "…";
}

function titleForPlatform(
  draft: ListingDraft,
  platformId: SalesPlatformId
): { title: string; limit: number | null } {
  const base = compact(draft.title);

  if (platformId === "ebay") {
    return { title: truncate(base, 80), limit: 80 };
  }

  return { title: base, limit: null };
}

function detailsBlock(draft: ListingDraft): string[] {
  const lines: string[] = [];
  if (draft.brand && !draft.brand.toLowerCase().includes("nicht sicher")) {
    lines.push(`Marke: ${draft.brand}`);
  }
  if (draft.model && !draft.model.toLowerCase().includes("nicht sicher")) {
    lines.push(`Modell: ${draft.model}`);
  }
  if (draft.condition) lines.push(`Zustand: ${draft.condition}`);

  const accessories = draft.analysis?.accessories ?? [];
  if (accessories.length > 0) {
    lines.push(`Zubehör: ${accessories.join(", ")}`);
  }

  const defects = draft.analysis?.visibleDefects ?? [];
  if (defects.length > 0) {
    lines.push(`Sichtbare Gebrauchsspuren/Mängel: ${defects.join(", ")}`);
  }

  return lines;
}

function fallbackDescription(
  draft: ListingDraft,
  platformId: SalesPlatformId,
  sellerProfile?: SellerProfile
): { description: string; tips: string[] } {
  const master = draft.description.trim();
  const details = detailsBlock(draft);
  const defects = draft.analysis?.visibleDefects ?? [];
  const logistics = sellerProfile ? sellerLogisticsLines(sellerProfile) : [];
  const logisticsBlock = logistics.length
    ? `\nVersand & Übergabe:\n${logistics.map((line) => `• ${line}`).join("\n")}`
    : "";

  switch (platformId) {
    case "ebay":
      return {
        description: [
          master,
          details.length ? `\nArtikeldetails:\n${details.map((line) => `• ${line}`).join("\n")}` : "",
          logisticsBlock,
        ].filter(Boolean).join("\n"),
        tips: [
          "Titel auf maximal 80 Zeichen begrenzt.",
          "Marke, Modell und Artikelmerkmale möglichst konkret halten.",
          defects.length ? "Erkannte Mängel ausdrücklich beibehalten." : "Zustand vor Veröffentlichung prüfen.",
        ],
      };
    case "vinted":
      return {
        description: [
          master,
          details.length ? `\nDetails:\n${details.map((line) => `• ${line}`).join("\n")}` : "",
          logisticsBlock,
        ].filter(Boolean).join("\n"),
        tips: [
          "Genaue Artikelmerkmale und Zustand nennen.",
          "Keine irrelevanten Marken oder Hashtags ergänzen.",
          defects.length ? "Mängel präzise im Text und auf Fotos zeigen." : "Eventuelle Mängel vor dem Hochladen prüfen.",
        ],
      };
    case "facebook":
      return {
        description: [
          master,
          details.slice(0, 4).length ? `\n${details.slice(0, 4).join(" · ")}` : "",
          logisticsBlock,
        ].filter(Boolean).join("\n"),
        tips: [
          "Kurz und schnell erfassbar formuliert.",
          "Keine Versand- oder Abholangabe erfinden; Nutzer entscheidet selbst.",
        ],
      };
    case "kleinanzeigen":
      return {
        description: [
          master,
          details.length ? `\n${details.map((line) => `• ${line}`).join("\n")}` : "",
          logisticsBlock,
        ].filter(Boolean).join("\n"),
        tips: [
          "Klarer Alltagstext mit Titel, Preis und Beschreibung.",
          "Keine Eigenschaften ergänzen, die aus Fotos/Nutzereingaben nicht belegt sind.",
        ],
      };
    case "willhaben":
      return {
        description: [
          master,
          details.length ? `\nDetails:\n${details.map((line) => `• ${line}`).join("\n")}` : "",
          logisticsBlock,
        ].filter(Boolean).join("\n"),
        tips: [
          "Sachlich und lokal verständlich formuliert.",
          "Abholung/Versand erst ergänzen, wenn der Nutzer es festlegt.",
        ],
      };
    default:
      return {
        description: [
          master,
          details.length ? `\n${details.map((line) => `• ${line}`).join("\n")}` : "",
          logisticsBlock,
        ].filter(Boolean).join("\n"),
        tips: ["Aus dem Master-Entwurf abgeleitete Plattformversion."],
      };
  }
}

function fallbackCopies(
  draft: ListingDraft,
  platformIds: SalesPlatformId[],
  provider?: AIProviderId,
  sellerProfile?: SellerProfile
): PlatformCopiesResponse {
  const priceText = draft.price
    ? `${draft.price} € ${draft.priceType}`
    : "Preis noch festlegen";

  const copies: PlatformCopy[] = platformIds.map((platformId) => {
    const platform = SALES_PLATFORMS.find((item) => item.id === platformId);
    const { title, limit } = titleForPlatform(draft, platformId);
    const { description, tips } = fallbackDescription(draft, platformId, sellerProfile);

    return {
      platformId,
      platformName: platform?.name ?? platformId,
      title,
      description,
      priceText,
      titleLimit: limit,
      tips,
      generatedBy: "fallback",
      provider,
    };
  });

  return { copies, generatedBy: "fallback", provider };
}

export async function generatePlatformCopies(
  draft: ListingDraft,
  platformIds: SalesPlatformId[],
  provider: AIProviderId,
  sellerProfile?: SellerProfile
): Promise<PlatformCopiesResponse> {
  if (!API_URL) return fallbackCopies(draft, platformIds, provider, sellerProfile);

  try {
    const response = await fetch(`${API_URL}/platform-copies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        platformIds,
        draft,
        sellerProfile,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !Array.isArray(payload?.copies)) {
      return fallbackCopies(draft, platformIds, provider);
    }

    const platformMap = new Map(SALES_PLATFORMS.map((item) => [item.id, item]));
    const copies: PlatformCopy[] = payload.copies
      .filter((copy: any) => platformIds.includes(copy.platformId))
      .map((copy: any) => ({
        platformId: copy.platformId,
        platformName: platformMap.get(copy.platformId)?.name ?? copy.platformId,
        title: String(copy.title ?? ""),
        description: String(copy.description ?? ""),
        priceText: String(copy.priceText ?? ""),
        titleLimit:
          Number(copy.titleLimit) > 0 ? Number(copy.titleLimit) : null,
        tips: Array.isArray(copy.tips) ? copy.tips.map(String) : [],
        generatedBy: "ai" as const,
        provider,
      }));

    if (copies.length === 0) return fallbackCopies(draft, platformIds, provider, sellerProfile);
    return { copies, generatedBy: "ai", provider };
  } catch {
    return fallbackCopies(draft, platformIds, provider, sellerProfile);
  }
}

export async function sharePlatformCopy(copy: PlatformCopy): Promise<void> {
  await Share.share({
    title: copy.title,
    message: [copy.title, "", copy.priceText, "", copy.description]
      .filter(Boolean)
      .join("\n"),
  });
}
