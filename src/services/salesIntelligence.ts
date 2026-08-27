import { ListingRecord } from "../types/salesCenter";
import { PriceSuggestion } from "../types/listing";
import { SalesGoal } from "../types/userPreferences";

export type GoalPrice = {
  value: number;
  priceType: "VB" | "Festpreis";
  label: string;
  explanation: string;
};

export function goalPriceFromSuggestion(
  suggestion: PriceSuggestion,
  goal: SalesGoal
): GoalPrice {
  if (goal === "fast") {
    return {
      value: suggestion.sellFast,
      priceType: "Festpreis",
      label: "Dein Ziel: schnell verkaufen",
      explanation:
        "Die App priorisiert einen attraktiveren Einstiegspreis und kurze Verkaufsdauer.",
    };
  }

  if (goal === "maximize") {
    return {
      value: suggestion.startHigh,
      priceType: "VB",
      label: "Dein Ziel: maximaler Erlös",
      explanation:
        "Die App startet höher und lässt bewusst Verhandlungsspielraum.",
    };
  }

  return {
    value: suggestion.marketTypical,
    priceType: "VB",
    label: "Dein Ziel: guter Marktpreis",
    explanation:
      "Die App orientiert sich am marktüblichen Bereich mit moderatem Verhandlungsspielraum.",
  };
}

export function daysOnline(record: ListingRecord, now = new Date()): number {
  if (!record.firstOnlineAt) return 0;
  const start = new Date(record.firstOnlineAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / 86400000));
}

export type FollowUpSuggestion = {
  level: "info" | "attention" | "strong";
  title: string;
  text: string;
  suggestedPercentReduction?: number;
};

export function followUpSuggestion(
  record: ListingRecord
): FollowUpSuggestion | null {
  if (record.status !== "online") return null;

  const days = daysOnline(record);
  const activePlatforms = Object.values(record.platformStatuses).filter(
    (status) => status === "online"
  ).length;

  if (days >= 14) {
    return {
      level: "strong",
      title: `${days} Tage online`,
      text:
        activePlatforms <= 1
          ? "Preis und Plattformreichweite prüfen. Der Artikel ist lange online und nur auf wenigen Plattformen aktiv."
          : "Preis, Titelbild und Beschreibung neu prüfen. Eine Preisreduzierung von etwa 10–15 % kann sinnvoll sein.",
      suggestedPercentReduction: 12,
    };
  }

  if (days >= 7) {
    return {
      level: "attention",
      title: `${days} Tage online`,
      text:
        activePlatforms <= 1
          ? "Noch nicht lange genug für einen starken Preisnachlass. Zuerst eine weitere passende Plattform erwägen."
          : "Nachfrage beobachten. Titelbild und Preis mit aktuellen Vergleichsangeboten kontrollieren.",
      suggestedPercentReduction: activePlatforms > 1 ? 5 : undefined,
    };
  }

  if (days >= 3 && activePlatforms <= 1) {
    return {
      level: "info",
      title: `${days} Tage online`,
      text: "Der Artikel ist bisher nur auf einer Plattform aktiv. Crossposting könnte die Reichweite erhöhen.",
    };
  }

  return null;
}
