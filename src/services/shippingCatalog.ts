import {
  ShippingDestinationMode,
  ShippingPackageInput,
  ShippingPriority,
  ShippingQuote,
  ShippingRecommendation,
} from "../types/shipping";

type ParsedPackage = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  sorted: [number, number, number];
  longest: number;
  shortest: number;
  longestPlusShortest: number;
  girthCm: number;
};

const CHECKED_AT = "2026-08-26";

const URLS = {
  dhl: "https://www.dhl.de/de/privatkunden/pakete-versenden.html",
  hermes: "https://www.myhermes.de/versenden/paketschein-erstellen/",
  dpd: "https://my.dpd.de/paketversand",
};

function n(value: string): number {
  return Number(value.trim().replace(",", "."));
}

function parsePackage(input: ShippingPackageInput): {
  parsed: ParsedPackage | null;
  messages: string[];
} {
  const weightKg = n(input.weightKg);
  const lengthCm = n(input.lengthCm);
  const widthCm = n(input.widthCm);
  const heightCm = n(input.heightCm);

  const messages: string[] = [];
  if (!Number.isFinite(weightKg) || weightKg <= 0) messages.push("Gewicht");
  if (!Number.isFinite(lengthCm) || lengthCm <= 0) messages.push("Länge");
  if (!Number.isFinite(widthCm) || widthCm <= 0) messages.push("Breite");
  if (!Number.isFinite(heightCm) || heightCm <= 0) messages.push("Höhe");

  if (messages.length) {
    return {
      parsed: null,
      messages: [`Bitte gültig ausfüllen: ${messages.join(" · ")}`],
    };
  }

  const sorted = [lengthCm, widthCm, heightCm].sort((a, b) => b - a) as [
    number,
    number,
    number,
  ];
  const [longest, middle, shortest] = sorted;

  return {
    parsed: {
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      sorted,
      longest,
      shortest,
      longestPlusShortest: longest + shortest,
      girthCm: longest + 2 * middle + 2 * shortest,
    },
    messages: [],
  };
}

function fitsBox(
  p: ParsedPackage,
  weight: number,
  dims: [number, number, number],
  maxGirth?: number
): boolean {
  const sortedMax = [...dims].sort((a, b) => b - a);
  return (
    p.weightKg <= weight &&
    p.sorted.every((value, index) => value <= sortedMax[index]) &&
    (maxGirth == null || p.girthCm <= maxGirth)
  );
}

function quote(
  data: Omit<ShippingQuote, "fit" | "fitReason" | "sourceCheckedAt">
): ShippingQuote {
  return {
    ...data,
    fit: true,
    fitReason: "Maße und Gewicht passen.",
    sourceCheckedAt: CHECKED_AT,
  };
}

function dhlQuotes(p: ParsedPackage): ShippingQuote[] {
  const rows: ShippingQuote[] = [];

  if (p.weightKg <= 1 && fitsBox(p, 1, [35.3, 25, 5])) {
    rows.push(
      quote({
        id: "dhl-warensendung-1kg",
        carrierId: "dhl",
        carrier: "DHL / Deutsche Post",
        product: "Warensendung bis 1 kg",
        price: 2.70,
        tracking: false,
        liabilityEur: 0,
        deliveryMode: "door",
        estimatedDays: "ca. 4 Werktage",
        purchaseUrl: URLS.dhl,
      })
    );
  }

  if (p.weightKg > 1 && p.weightKg <= 2 && fitsBox(p, 2, [35.3, 25, 5])) {
    rows.push(
      quote({
        id: "dhl-warensendung-2kg",
        carrierId: "dhl",
        carrier: "DHL / Deutsche Post",
        product: "Warensendung bis 2 kg",
        price: 3.55,
        tracking: false,
        liabilityEur: 0,
        deliveryMode: "door",
        estimatedDays: "ca. 4 Werktage",
        purchaseUrl: URLS.dhl,
      })
    );
  }

  if (fitsBox(p, 2, [35, 25, 10])) {
    rows.push(
      quote({
        id: "dhl-paeckchen-s",
        carrierId: "dhl",
        carrier: "DHL",
        product: "Päckchen S bis 2 kg",
        price: 4.19,
        tracking: false,
        liabilityEur: 0,
        deliveryMode: "door",
        estimatedDays: "i. d. R. 1–2 Werktage",
        purchaseUrl: URLS.dhl,
      })
    );
  }

  if (fitsBox(p, 2, [60, 30, 15])) {
    rows.push(
      quote({
        id: "dhl-paeckchen-m",
        carrierId: "dhl",
        carrier: "DHL",
        product: "Päckchen M bis 2 kg",
        price: 5.19,
        tracking: false,
        liabilityEur: 0,
        deliveryMode: "door",
        estimatedDays: "i. d. R. 1–2 Werktage",
        purchaseUrl: URLS.dhl,
      }),
      quote({
        id: "dhl-paket-2kg",
        carrierId: "dhl",
        carrier: "DHL",
        product: "Paket 2 kg",
        price: 6.19,
        tracking: true,
        liabilityEur: 500,
        deliveryMode: "door",
        estimatedDays: "i. d. R. 1–2 Werktage",
        purchaseUrl: URLS.dhl,
      })
    );
  }

  const packageTiers: Array<[number, number]> = [
    [5, 7.69],
    [10, 10.49],
    [20, 18.99],
    [31.5, 23.99],
  ];

  packageTiers.forEach(([maxWeight, price]) => {
    if (fitsBox(p, maxWeight, [120, 60, 60], 300)) {
      rows.push(
        quote({
          id: `dhl-paket-${String(maxWeight).replace(".", "_")}kg`,
          carrierId: "dhl",
          carrier: "DHL",
          product: `Paket ${String(maxWeight).replace(".", ",")} kg`,
          price,
          tracking: true,
          liabilityEur: 500,
          deliveryMode: "door",
          estimatedDays: "i. d. R. 1–2 Werktage",
          purchaseUrl: URLS.dhl,
        })
      );
    }
  });

  return rows;
}

function hermesQuotes(p: ParsedPackage): ShippingQuote[] {
  if (p.weightKg > 25) return [];

  const rows: ShippingQuote[] = [];
  const classes = [
    { id: "paeckchen", name: "Päckchen", sum: 37, shop: 3.99, door: 5.19, liability: 50 },
    { id: "s", name: "S-Paket", sum: 50, shop: 4.89, door: 5.79, liability: 500 },
    { id: "m", name: "M-Paket", sum: 80, shop: 5.90, door: 6.99, liability: 500 },
    { id: "l", name: "L-Paket", sum: 120, shop: 9.90, door: 10.99, liability: 500 },
  ];

  for (const row of classes) {
    if (p.longestPlusShortest <= row.sum) {
      rows.push(
        quote({
          id: `hermes-${row.id}-door`,
          carrierId: "hermes",
          carrier: "Hermes",
          product: `${row.name} · Zustellung Haustür`,
          price: row.door,
          tracking: true,
          liabilityEur: row.liability,
          deliveryMode: "door",
          sourceValidFrom: "2026-03-02",
          purchaseUrl: URLS.hermes,
        }),
        quote({
          id: `hermes-${row.id}-shop`,
          carrierId: "hermes",
          carrier: "Hermes",
          product: `${row.name} · Zustellung PaketShop/Paketstation`,
          price: row.shop,
          tracking: true,
          liabilityEur: row.liability,
          deliveryMode: "shop",
          sourceValidFrom: "2026-03-02",
          purchaseUrl: URLS.hermes,
        })
      );
      break;
    }
  }

  return rows;
}

function dpdQuotes(p: ParsedPackage): ShippingQuote[] {
  if (p.weightKg > 20 || p.longest > 100) return [];

  const rows: ShippingQuote[] = [];
  const classes = [
    { id: "xs", name: "XS", sum: 35, shop2shop: 3.59, classic: 5.15 },
    { id: "s", name: "S", sum: 50, shop2shop: 4.09, classic: 5.45 },
    { id: "m", name: "M", sum: 70, shop2shop: 5.78, classic: 6.95 },
    { id: "l", name: "L", sum: 90, shop2shop: 10.79, classic: 10.95 },
  ];

  let matched = false;
  for (const row of classes) {
    if (p.longestPlusShortest <= row.sum && p.girthCm <= 250) {
      rows.push(
        quote({
          id: `dpd-${row.id}-classic`,
          carrierId: "dpd",
          carrier: "DPD",
          product: `CLASSIC ${row.name} · Paketshop → Haustür`,
          price: row.classic,
          tracking: true,
          liabilityEur: 520,
          deliveryMode: "door",
          estimatedDays: "i. d. R. 1–2 Werktage",
          purchaseUrl: URLS.dpd,
        }),
        quote({
          id: `dpd-${row.id}-shop2shop`,
          carrierId: "dpd",
          carrier: "DPD",
          product: `Shop2Shop ${row.name}`,
          price: row.shop2shop,
          tracking: true,
          liabilityEur: 265,
          deliveryMode: "shop",
          estimatedDays: "i. d. R. 1–2 Werktage",
          purchaseUrl: URLS.dpd,
        })
      );
      matched = true;
      break;
    }
  }

  if (!matched && p.girthCm <= 250) {
    rows.push(
      quote({
        id: "dpd-xl-classic",
        carrierId: "dpd",
        carrier: "DPD",
        product: "CLASSIC XL · Paketshop → Haustür",
        price: 18.69,
        tracking: true,
        liabilityEur: 520,
        deliveryMode: "door",
        estimatedDays: "i. d. R. 1–2 Werktage",
        purchaseUrl: URLS.dpd,
      })
    );
  }

  return rows;
}

function filterDestination(
  quotes: ShippingQuote[],
  destinationMode: ShippingDestinationMode
): ShippingQuote[] {
  if (destinationMode === "either") return quotes;
  return quotes.filter((quote) => quote.deliveryMode === destinationMode);
}

function rank(
  quote: ShippingQuote,
  priority: ShippingPriority,
  itemValue: number
): number {
  let score = quote.price;

  if (priority === "tracking" && !quote.tracking) score += 50;
  if (priority === "insured" && quote.liabilityEur < Math.max(itemValue, 1)) score += 100;

  if (itemValue > 50 && !quote.tracking) score += 30;
  if (itemValue > quote.liabilityEur && quote.liabilityEur > 0) score += 15;

  return score;
}

export function calculateShipping(
  input: ShippingPackageInput,
  itemValue = 0
): ShippingRecommendation {
  const { parsed, messages } = parsePackage(input);

  if (!parsed) {
    return {
      inputValid: false,
      validationMessages: messages,
      matches: [],
      recommendedId: null,
      warnings: [],
    };
  }

  let matches = [
    ...dhlQuotes(parsed),
    ...hermesQuotes(parsed),
    ...dpdQuotes(parsed),
  ];

  matches = filterDestination(matches, input.destinationMode);

  matches.sort(
    (a, b) =>
      rank(a, input.priority, itemValue) -
      rank(b, input.priority, itemValue)
  );

  const warnings: string[] = [];

  if (!matches.length) {
    warnings.push(
      "Für diese Maße/Gewichtskombination wurde in den hinterlegten Standardtarifen kein sicher passender Tarif gefunden. Sperrgut oder individueller Versand prüfen."
    );
  }

  if (itemValue > 50 && matches.some((quote) => !quote.tracking)) {
    warnings.push(
      "Bei höherem Artikelwert sind ungetrackte Versandarten riskanter."
    );
  }

  if (
    itemValue > 500 &&
    matches.length > 0 &&
    matches.every((quote) => quote.liabilityEur < itemValue)
  ) {
    warnings.push(
      "Der Artikelwert liegt über der Standardhaftung der gefundenen Tarife. Zusatzversicherung oder spezielle Versandlösung prüfen."
    );
  }

  return {
    inputValid: true,
    validationMessages: [],
    matches,
    recommendedId: matches[0]?.id ?? null,
    warnings,
  };
}
