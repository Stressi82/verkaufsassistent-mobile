import { ListingRecord } from "../types/salesCenter";
import {
  BuyerMessageTemplate,
  BuyerMessageTemplateId,
} from "../types/buyerMessages";
import { PAYMENT_LABELS } from "../types/seller";

function money(value: string): string {
  const normalized = String(value || "").trim();
  return normalized ? `${normalized} €` : "";
}

function articleName(record: ListingRecord): string {
  return record.draft.title.trim() || "der Artikel";
}

function availabilityText(record: ListingRecord): string {
  if (record.status === "sold") {
    return `Danke für deine Nachricht. ${articleName(record)} ist leider bereits verkauft.`;
  }
  if (record.status === "reserved") {
    return `Danke für deine Nachricht. ${articleName(record)} ist aktuell reserviert. Falls die Reservierung frei wird, kann ich mich noch einmal melden.`;
  }
  if (record.status === "removed") {
    return `Danke für deine Nachricht. ${articleName(record)} ist aktuell nicht mehr im Verkauf.`;
  }
  return `Ja, ${articleName(record)} ist aktuell noch verfügbar.`;
}

function shippingText(record: ListingRecord): BuyerMessageTemplate {
  const seller = record.sellerProfile;
  const enabled =
    seller.shippingMode === "shipping" || seller.shippingMode === "both";

  if (!enabled) {
    return {
      id: "shipping",
      title: "Versand",
      text: "",
      available: false,
      reason: "Für diesen Artikel ist kein Versand hinterlegt.",
    };
  }

  const selected = record.shippingSelection;
  if (selected) {
    return {
      id: "shipping",
      title: "Versand",
      text:
        `Versand ist möglich. Aktuell ist ${selected.carrier} · ${selected.product} ` +
        `mit ${selected.price.toFixed(2).replace(".", ",")} € Versand hinterlegt.` +
        (selected.tracking ? " Die Sendung ist mit Tracking vorgesehen." : ""),
      available: true,
    };
  }

  if (seller.shippingCostMode === "fixed" && seller.shippingCost) {
    return {
      id: "shipping",
      title: "Versand",
      text:
        `Versand ist möglich. Die hinterlegten Versandkosten betragen ${seller.shippingCost} €.` +
        (seller.carrier ? ` Vorgesehen ist ${seller.carrier}.` : ""),
      available: true,
    };
  }

  return {
    id: "shipping",
    title: "Versand",
    text:
      "Versand ist möglich. Die genaue Versandart und die Kosten können wir passend zum Artikel abstimmen.",
    available: true,
  };
}

function pickupText(record: ListingRecord): BuyerMessageTemplate {
  const seller = record.sellerProfile;
  const enabled =
    seller.shippingMode === "pickup" || seller.shippingMode === "both";

  if (!enabled) {
    return {
      id: "pickup",
      title: "Abholung",
      text: "",
      available: false,
      reason: "Für diesen Artikel ist keine Abholung hinterlegt.",
    };
  }

  const place = [seller.postalCode, seller.city].filter(Boolean).join(" ");
  return {
    id: "pickup",
    title: "Abholung",
    text: place
      ? `Abholung ist in ${place} möglich. Einen genauen Termin und Treffpunkt können wir direkt abstimmen.`
      : "Abholung ist möglich. Einen genauen Termin und Treffpunkt können wir direkt abstimmen.",
    available: true,
  };
}

function paymentText(record: ListingRecord): BuyerMessageTemplate {
  const methods = record.sellerProfile.paymentMethods;
  if (!methods.length) {
    return {
      id: "payment",
      title: "Zahlung",
      text: "",
      available: false,
      reason: "Noch keine Zahlungsart hinterlegt.",
    };
  }

  return {
    id: "payment",
    title: "Zahlung",
    text: `Als Zahlung ist aktuell vorgesehen: ${methods
      .map((method) => PAYMENT_LABELS[method])
      .join(", ")}.`,
    available: true,
  };
}

function priceText(record: ListingRecord): BuyerMessageTemplate {
  const price = money(record.draft.price);

  if (!price) {
    return {
      id: "price",
      title: "Preis",
      text: "",
      available: false,
      reason: "Noch kein Verkaufspreis hinterlegt.",
    };
  }

  if (record.draft.priceType === "VB") {
    return {
      id: "price",
      title: "Preis / VB",
      text: `Der aktuelle Preis liegt bei ${price} VB. Du kannst mir gern ein konkretes Angebot machen.`,
      available: true,
    };
  }

  return {
    id: "price",
    title: "Festpreis",
    text: `Der aktuelle Preis liegt bei ${price} als Festpreis.`,
    available: true,
  };
}

function reservationText(record: ListingRecord): BuyerMessageTemplate {
  if (record.status === "reserved") {
    return {
      id: "reservation",
      title: "Reservierung",
      text: `${articleName(record)} ist aktuell bereits reserviert.`,
      available: true,
    };
  }

  if (record.status !== "online" && record.status !== "prepared") {
    return {
      id: "reservation",
      title: "Reservierung",
      text: "",
      available: false,
      reason: "Der Artikel ist aktuell nicht für eine neue Reservierung vorgesehen.",
    };
  }

  return {
    id: "reservation",
    title: "Reservierung",
    text:
      "Eine Reservierung ist grundsätzlich möglich. Bitte sag mir, bis wann du den Artikel verbindlich abholen bzw. bezahlen möchtest.",
    available: true,
  };
}

function soldText(record: ListingRecord): BuyerMessageTemplate {
  return {
    id: "sold",
    title: "Bereits verkauft",
    text: `Danke für dein Interesse. ${articleName(record)} ist leider bereits verkauft.`,
    available: true,
  };
}

export function buildBuyerMessageTemplates(
  record: ListingRecord
): BuyerMessageTemplate[] {
  return [
    {
      id: "availability",
      title: "Noch verfügbar?",
      text: availabilityText(record),
      available: true,
    },
    shippingText(record),
    pickupText(record),
    paymentText(record),
    priceText(record),
    reservationText(record),
    soldText(record),
  ];
}

export function offerReply(
  record: ListingRecord,
  type: Extract<
    BuyerMessageTemplateId,
    "offer_accept" | "offer_decline" | "offer_counter"
  >,
  buyerOffer: string
): BuyerMessageTemplate {
  const offer = money(buyerOffer);
  const currentPrice = money(record.draft.price);

  if (!offer) {
    return {
      id: type,
      title: "Preisangebot",
      text: "",
      available: false,
      reason: "Bitte zuerst das Angebot des Käufers eintragen.",
    };
  }

  if (type === "offer_accept") {
    return {
      id: type,
      title: "Angebot annehmen",
      text: `Danke für dein Angebot über ${offer}. Das passt für mich. Wir können die weiteren Details jetzt abstimmen.`,
      available: true,
    };
  }

  if (type === "offer_decline") {
    return {
      id: type,
      title: "Angebot ablehnen",
      text: `Danke für dein Angebot über ${offer}. Zu diesem Preis möchte ich den Artikel derzeit nicht verkaufen.`,
      available: true,
    };
  }

  return {
    id: type,
    title: "Gegenangebot",
    text: currentPrice
      ? `Danke für dein Angebot über ${offer}. Ich würde bei ${currentPrice} bleiben.`
      : `Danke für dein Angebot über ${offer}. Ich möchte bei meinem aktuellen Verkaufspreis bleiben.`,
    available: true,
  };
}
