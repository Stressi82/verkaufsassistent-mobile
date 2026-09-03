import { API_URL } from "../config";
import {
  ComparableListing,
  ListingDraft,
  PriceSuggestion,
  SearchQuery,
} from "../types/listing";

function buildQueryText(draft: ListingDraft): string {
  const terms = draft.analysis?.searchTerms?.filter(Boolean) ?? [];
  if (terms.length > 0) return terms.join(" ");
  return [draft.brand, draft.model, draft.title].filter(Boolean).join(" ").trim();
}

function buildSearchQueries(draft: ListingDraft): SearchQuery[] {
  const query = buildQueryText(draft);
  const encoded = encodeURIComponent(query);

  return [
    {
      platform: "kleinanzeigen",
      query,
      url: `https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${encoded}`,
    },
    {
      platform: "ebay",
      query,
      url: `https://www.ebay.de/sch/i.html?_nkw=${encoded}`,
    },
  ];
}

function calculateFromComparables(
  draft: ListingDraft,
  comparables: ComparableListing[]
): PriceSuggestion {
  const sorted = comparables
    .map((entry) => entry.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return {
      sellFast: 0,
      marketTypical: 0,
      startHigh: 0,
      currency: "EUR",
      confidence: 0.2,
      basedOn: "ai_estimate",
      sourceCount: 0,
      reasoning:
        "Noch keine Vergleichspreise vorhanden. Öffne zuerst die Suchlinks oder trage manuelle Vergleichspreise ein.",
      suggestedPriceType: "VB",
      searchQueries: buildSearchQueries(draft),
    };
  }

  const upperIndex = Math.floor(sorted.length / 2);
  const upper = sorted[upperIndex] ?? 0;
  const lower = sorted[Math.max(0, upperIndex - 1)] ?? upper;
  const median = sorted.length % 2 === 1 ? upper : (lower + upper) / 2;

  const sellFast = Math.max(1, Math.round(median * 0.85));
  const marketTypical = Math.max(1, Math.round(median));
  const startHigh = Math.max(1, Math.round(median * 1.12));

  return {
    sellFast,
    marketTypical,
    startHigh,
    currency: "EUR",
    confidence: Math.min(0.9, 0.45 + sorted.length * 0.08),
    basedOn: "manual_comparables",
    sourceCount: sorted.length,
    reasoning:
      `Die Empfehlung basiert auf ${sorted.length} manuell eingetragenen Vergleichspreis` +
      `${sorted.length === 1 ? "" : "en"}. ` +
      `Median ${marketTypical} €. Schnell verkaufen eher bei ${sellFast} €, höher ansetzen eher ${startHigh} € VB.`,
    suggestedPriceType: "VB",
    searchQueries: buildSearchQueries(draft),
  };
}

export async function suggestPrice(
  draft: ListingDraft,
  comparables: ComparableListing[]
): Promise<PriceSuggestion> {
  if (!API_URL) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return calculateFromComparables(draft, comparables);
  }

  const response = await fetch(`${API_URL}/price-suggest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      analysis: draft.analysis,
      title: draft.title,
      category: draft.category,
      condition: draft.condition,
      comparables,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : `Serverfehler ${response.status}`;
    throw new Error(message);
  }

  return payload as PriceSuggestion;
}
