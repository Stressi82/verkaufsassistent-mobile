import {
  PAYMENT_LABELS,
  SellerProfile,
  SHIPPING_LABELS,
} from "../types/seller";

export function sellerProfileReadiness(profile: SellerProfile): string[] {
  const missing: string[] = [];

  if (profile.shippingMode === "unset") missing.push("Abholung/Versand wählen");
  if (!profile.postalCode.trim()) missing.push("PLZ");
  if (!profile.city.trim()) missing.push("Ort");
  if (profile.paymentMethods.length === 0) missing.push("Zahlungsart");

  if (
    (profile.shippingMode === "shipping" || profile.shippingMode === "both") &&
    profile.shippingCostMode === "fixed"
  ) {
    const price = Number(profile.shippingCost.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) missing.push("Versandkosten");
  }

  return missing;
}

export function sellerLogisticsLines(profile: SellerProfile): string[] {
  const lines: string[] = [];
  const place = [profile.postalCode.trim(), profile.city.trim()]
    .filter(Boolean)
    .join(" ");

  if (profile.shippingMode !== "unset") {
    let shipping = SHIPPING_LABELS[profile.shippingMode];

    if (profile.shippingMode === "shipping" || profile.shippingMode === "both") {
      if (profile.shippingCostMode === "free") {
        shipping += " · Versand kostenlos";
      } else if (
        profile.shippingCostMode === "fixed" &&
        profile.shippingCost.trim()
      ) {
        shipping += ` · Versand ${profile.shippingCost.trim()} €`;
      } else if (profile.shippingCostMode === "buyer_pays") {
        shipping += " · Versandkosten trägt Käufer";
      }

      if (profile.carrier.trim()) shipping += ` · ${profile.carrier.trim()}`;
    }

    lines.push(shipping);
  }

  if (
    place &&
    (profile.shippingMode === "pickup" || profile.shippingMode === "both")
  ) {
    lines.push(`Abholung: ${place}`);
  }

  if (profile.paymentMethods.length > 0) {
    lines.push(
      `Zahlung: ${profile.paymentMethods
        .map((method) => PAYMENT_LABELS[method])
        .join(", ")}`
    );
  }

  return lines;
}
