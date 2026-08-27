export type SalesPlatformId =
  | "kleinanzeigen"
  | "ebay"
  | "facebook"
  | "vinted"
  | "willhaben"
  | "shpock"
  | "quoka"
  | "hood"
  | "markt";

export type PlatformCountry = "DE" | "AT" | "EU";

export type PlatformMode = "api" | "handoff" | "external";

export type SalesPlatform = {
  id: SalesPlatformId;
  name: string;
  countries: PlatformCountry[];
  mode: PlatformMode;
  note: string;
  sellUrl: string;
  categoryHint?: string;
  priority: "primary" | "secondary";
};
