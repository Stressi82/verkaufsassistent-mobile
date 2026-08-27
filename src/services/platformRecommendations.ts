import { ListingDraft } from "../types/listing";
import { PlatformCountry, SalesPlatformId } from "../types/platform";
import {
  PlatformRecommendation,
  ProductGroup,
  RecommendationResult,
} from "../types/recommendation";
import { SALES_PLATFORMS } from "./platforms";

type Region = PlatformCountry | "ALL";

const GROUP_LABELS: Record<ProductGroup, string> = {
  fashion: "Mode & Accessoires",
  electronics: "Elektronik",
  home_furniture: "Möbel & Haushalt",
  tools_garden: "Werkzeug & Garten",
  children: "Baby & Kind",
  collectibles: "Sammlerstücke",
  books_media: "Bücher & Medien",
  sports: "Sport & Freizeit",
  vehicle_parts: "Fahrzeugteile & Zubehör",
  general: "Allgemeiner Artikel",
};

const KEYWORDS: Record<ProductGroup, string[]> = {
  fashion: [
    "kleid", "jacke", "hose", "jeans", "shirt", "pullover", "schuh", "sneaker",
    "stiefel", "tasche", "rucksack", "mode", "bekleidung", "accessoire", "uhr",
    "schmuck", "parfum", "beauty",
  ],
  electronics: [
    "handy", "smartphone", "iphone", "samsung", "tablet", "ipad", "laptop",
    "notebook", "computer", "pc", "monitor", "fernseher", "tv", "kamera",
    "objektiv", "kopfhörer", "lautsprecher", "konsole", "playstation", "xbox",
    "nintendo", "drucker", "router", "elektronik",
  ],
  home_furniture: [
    "sofa", "couch", "schrank", "kommode", "tisch", "stuhl", "bett", "matratze",
    "regal", "möbel", "lampe", "teppich", "küche", "haushalt", "kaffeemaschine",
    "staubsauger", "mikrowelle", "geschirr", "deko",
  ],
  tools_garden: [
    "bohrer", "bohrmaschine", "akkuschrauber", "werkzeug", "säge", "schleifer",
    "bosch", "makita", "dewalt", "metabo", "rasenmäher", "heckenschere",
    "gartengerät", "garten", "werkstatt", "kompressor",
  ],
  children: [
    "baby", "kind", "kinder", "spielzeug", "lego", "duplo", "puppe", "buggy",
    "kinderwagen", "kindersitz", "maxi cosi", "tonie", "tonies", "schulranzen",
    "kinderkleidung",
  ],
  collectibles: [
    "sammler", "sammlung", "antik", "vintage", "münze", "briefmarke", "figur",
    "pokemon", "karte", "trading card", "rarität", "limitierte", "signiert",
    "modellauto",
  ],
  books_media: [
    "buch", "bücher", "roman", "comic", "manga", "dvd", "blu-ray", "cd",
    "schallplatte", "vinyl", "spiel", "brettspiel", "hörbuch",
  ],
  sports: [
    "fahrrad", "e-bike", "mountainbike", "rennrad", "fitness", "hantel",
    "ski", "snowboard", "sport", "tennis", "golf", "camping", "zelt",
  ],
  vehicle_parts: [
    "autoteil", "ersatzteil", "felge", "reifen", "stoßstange", "scheinwerfer",
    "motorradteil", "kfz", "auto zubehör", "anhängerkupplung",
  ],
  general: [],
};

const BULKY_KEYWORDS = [
  "sofa", "couch", "schrank", "bett", "matratze", "tisch", "kommode", "regal",
  "kinderwagen", "fahrrad", "e-bike", "rasenmäher", "grill", "waschmaschine",
  "trockner", "kühlschrank", "gefrierschrank",
];

const SHIPPING_FRIENDLY_KEYWORDS = [
  "handy", "smartphone", "tablet", "kamera", "objektiv", "uhr", "schmuck",
  "kleid", "jacke", "hose", "shirt", "schuh", "tasche", "buch", "comic",
  "manga", "dvd", "cd", "vinyl", "figur", "münze", "karte", "lego",
];

function normalize(draft: ListingDraft): string {
  return [
    draft.title,
    draft.category,
    draft.brand,
    draft.model,
    draft.condition,
    draft.description,
    ...(draft.analysis?.searchTerms ?? []),
    ...(draft.analysis?.recognizedText ?? []),
  ].join(" ").toLowerCase();
}

function countMatches(text: string, words: string[]): number {
  return words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
}

function detectGroup(text: string): ProductGroup {
  const candidates = (Object.keys(KEYWORDS) as ProductGroup[])
    .filter((group) => group !== "general")
    .map((group) => ({ group, score: countMatches(text, KEYWORDS[group]) }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.score > 0 ? candidates[0].group : "general";
}

function baseScore(id: SalesPlatformId, group: ProductGroup, region: Region): number {
  const generic: Record<SalesPlatformId, number> = {
    kleinanzeigen: region === "AT" ? 0 : 82,
    ebay: 70,
    facebook: 72,
    vinted: 45,
    willhaben: region === "DE" ? 0 : 88,
    shpock: 55,
    quoka: region === "AT" ? 0 : 48,
    hood: region === "AT" ? 0 : 45,
    markt: region === "AT" ? 0 : 45,
  };

  const overrides: Partial<Record<ProductGroup, Partial<Record<SalesPlatformId, number>>>> = {
    fashion: { vinted: 96, ebay: 70, facebook: 68, kleinanzeigen: 70, willhaben: 80, shpock: 65 },
    electronics: { ebay: 92, kleinanzeigen: 89, facebook: 78, willhaben: 92, vinted: 66, shpock: 62, hood: 58 },
    home_furniture: { kleinanzeigen: 96, facebook: 91, willhaben: 97, quoka: 68, markt: 65, shpock: 62, ebay: 48, vinted: 42 },
    tools_garden: { kleinanzeigen: 95, ebay: 84, facebook: 82, willhaben: 95, quoka: 64, hood: 55, shpock: 58 },
    children: { kleinanzeigen: 92, vinted: 90, facebook: 84, willhaben: 94, shpock: 66, ebay: 64 },
    collectibles: { ebay: 97, kleinanzeigen: 78, facebook: 68, willhaben: 82, hood: 62, vinted: 62 },
    books_media: { vinted: 88, ebay: 82, kleinanzeigen: 77, willhaben: 82, facebook: 64, hood: 58 },
    sports: { kleinanzeigen: 91, facebook: 84, willhaben: 94, ebay: 74, vinted: 70, shpock: 64 },
    vehicle_parts: { ebay: 94, kleinanzeigen: 91, facebook: 78, willhaben: 93, quoka: 62, markt: 58 },
  };

  return overrides[group]?.[id] ?? generic[id];
}

function regionAllows(platformId: SalesPlatformId, region: Region): boolean {
  if (region === "ALL") return true;
  const platform = SALES_PLATFORMS.find((entry) => entry.id === platformId);
  return Boolean(platform?.countries.includes(region));
}

export function recommendPlatforms(draft: ListingDraft, region: Region = "DE"): RecommendationResult {
  const text = normalize(draft);
  const productGroup = detectGroup(text);
  const localPickupLikely = countMatches(text, BULKY_KEYWORDS) > 0;
  const shippingFriendlyLikely = !localPickupLikely && countMatches(text, SHIPPING_FRIENDLY_KEYWORDS) > 0;
  const branded = draft.brand.trim().length > 1 && !draft.brand.toLowerCase().includes("nicht sicher");

  const recommendations: PlatformRecommendation[] = SALES_PLATFORMS
    .filter((platform) => regionAllows(platform.id, region))
    .map((platform) => {
      let score = baseScore(platform.id, productGroup, region);
      const reasons: string[] = [];

      reasons.push(
        productGroup !== "general"
          ? `passt gut zu ${GROUP_LABELS[productGroup]}`
          : "breiter Marktplatz für allgemeine Artikel"
      );

      if (localPickupLikely) {
        if (["kleinanzeigen", "facebook", "willhaben", "quoka", "markt", "shpock"].includes(platform.id)) {
          score += 8;
          reasons.push("lokale Abholung ist bei diesem Artikel wahrscheinlich");
        }
        if (platform.id === "ebay") score -= 8;
      }

      if (shippingFriendlyLikely && ["ebay", "vinted"].includes(platform.id)) {
        score += 5;
        reasons.push("Artikel ist wahrscheinlich gut versendbar");
      }

      if (branded && platform.id === "ebay") {
        score += 4;
        reasons.push("Marke/Modell erleichtern überregionale Produktsuche");
      }

      if (productGroup === "fashion" && platform.id === "vinted") reasons.push("starker Secondhand-Fokus");
      if (productGroup === "collectibles" && platform.id === "ebay") reasons.push("überregionale Käufersuche ist bei Sammlerstücken hilfreich");
      if (region === "AT" && platform.id === "willhaben") reasons.push("besonders relevant für den österreichischen Markt");
      if (region === "DE" && platform.id === "kleinanzeigen") reasons.push("besonders relevant für den deutschen Privatmarkt");

      score = Math.max(0, Math.min(100, score));
      return { platformId: platform.id, score, recommended: score >= 78, reasons };
    })
    .sort((a, b) => b.score - a.score);

  let selectedCount = 0;
  for (const recommendation of recommendations) {
    if (recommendation.recommended && selectedCount < 4) selectedCount += 1;
    else recommendation.recommended = false;
  }

  return {
    productGroup,
    productGroupLabel: GROUP_LABELS[productGroup],
    localPickupLikely,
    shippingFriendlyLikely,
    recommendations,
  };
}
