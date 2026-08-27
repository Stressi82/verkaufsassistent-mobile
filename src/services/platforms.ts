import { Share } from "react-native";
import { ListingDraft } from "../types/listing";
import { SalesPlatform } from "../types/platform";

export const SALES_PLATFORMS: SalesPlatform[] = [
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    countries: ["DE"],
    mode: "handoff",
    priority: "primary",
    sellUrl: "https://www.kleinanzeigen.de/p-anzeige-aufgeben.html",
    note: "Großer deutscher Kleinanzeigenmarkt. Anzeige vorbereiten und zum Inserieren übergeben.",
  },
  {
    id: "ebay",
    name: "eBay",
    countries: ["DE", "AT", "EU"],
    mode: "api",
    priority: "primary",
    sellUrl: "https://www.ebay.de/sl/sell",
    note: "Offizielle Sell-APIs vorhanden; Direkt-Posting kann nach OAuth/Verkäufer-Konfiguration ergänzt werden.",
  },
  {
    id: "facebook",
    name: "Facebook Marketplace",
    countries: ["DE", "AT", "EU"],
    mode: "handoff",
    priority: "primary",
    sellUrl: "https://www.facebook.com/marketplace/create/item",
    note: "Lokaler Marktplatz in Facebook. Daten vorbereiten und Marketplace zum Einstellen öffnen.",
  },
  {
    id: "vinted",
    name: "Vinted",
    countries: ["DE", "AT", "EU"],
    mode: "handoff",
    priority: "primary",
    sellUrl: "https://www.vinted.de/items/new",
    categoryHint: "Besonders sinnvoll für Mode, Accessoires und von Vinted zugelassene Secondhand-Kategorien.",
    note: "Verkaufsentwurf vorbereiten und Vinted zum Einstellen öffnen.",
  },
  {
    id: "willhaben",
    name: "willhaben",
    countries: ["AT"],
    mode: "handoff",
    priority: "primary",
    sellUrl: "https://www.willhaben.at/iad/kaufen-und-verkaufen",
    note: "Sehr großer österreichischer Marktplatz mit privaten Anzeigen.",
  },
  {
    id: "shpock",
    name: "Shpock",
    countries: ["DE", "AT", "EU"],
    mode: "handoff",
    priority: "secondary",
    sellUrl: "https://www.shpock.com/de-de",
    note: "Lokaler Secondhand-Marktplatz für private Käufer und Verkäufer.",
  },
  {
    id: "quoka",
    name: "Quoka",
    countries: ["DE"],
    mode: "handoff",
    priority: "secondary",
    sellUrl: "https://www.quoka.de/anzeigen/",
    note: "Deutsches Kleinanzeigenportal mit privaten Inseraten.",
  },
  {
    id: "hood",
    name: "Hood.de",
    countries: ["DE"],
    mode: "handoff",
    priority: "secondary",
    sellUrl: "https://www.hood.de/",
    note: "Deutscher Online-Marktplatz; private Verkäufer werden unterstützt.",
  },
  {
    id: "markt",
    name: "markt.de",
    countries: ["DE"],
    mode: "handoff",
    priority: "secondary",
    sellUrl: "https://www.markt.de/",
    note: "Regionaler deutscher Kleinanzeigenmarkt für private und gewerbliche Anzeigen.",
  },
];

export function buildListingShareText(draft: ListingDraft): string {
  const price = draft.price
    ? `${draft.price} € ${draft.priceType}`
    : "Preis noch nicht festgelegt";

  return [
    draft.title,
    "",
    `Preis: ${price}`,
    draft.category ? `Kategorie: ${draft.category}` : "",
    draft.condition ? `Zustand: ${draft.condition}` : "",
    "",
    draft.description,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function shareListingDraft(draft: ListingDraft): Promise<void> {
  await Share.share({
    title: draft.title || "Verkaufsanzeige",
    message: buildListingShareText(draft),
  });
}

export function listingReadiness(draft: ListingDraft): string[] {
  const missing: string[] = [];
  if (!draft.title.trim()) missing.push("Titel");
  if (!draft.description.trim()) missing.push("Beschreibung");
  if (!draft.price.trim()) missing.push("Preis");
  return missing;
}
