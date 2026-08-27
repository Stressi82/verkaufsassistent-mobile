export type PhotoRole = "general" | "cover" | "typeplate" | "damage" | "accessories";

export type PhotoItem = {
  id: string;
  uri: string;
  role?: PhotoRole;
};

export type AnalysisResult = {
  itemName: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  condition: string;
  accessories: string[];
  visibleDefects: string[];
  recognizedText: string[];
  searchTerms: string[];
  confidence: number;
  questions: string[];
};

export type ListingDraft = {
  title: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  condition: string;
  price: string;
  priceType: "VB" | "Festpreis";
  barcode?: string;
  voiceNotes?: string;
  analysis?: AnalysisResult;
};

export type ComparableListing = {
  title?: string;
  price: number;
  platform: "kleinanzeigen" | "ebay" | "other";
};

export type SearchQuery = {
  platform: "kleinanzeigen" | "ebay";
  query: string;
  url: string;
};

export type PriceSuggestion = {
  sellFast: number;
  marketTypical: number;
  startHigh: number;
  currency: "EUR";
  confidence: number;
  basedOn: "manual_comparables" | "ai_estimate";
  sourceCount: number;
  reasoning: string;
  suggestedPriceType: "VB" | "Festpreis";
  searchQueries: SearchQuery[];
};
