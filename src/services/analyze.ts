import { API_URL } from "../config";
import { AIProviderId } from "../types/ai";
import { AnalysisResult, ListingDraft, PhotoItem } from "../types/listing";

const DEMO_RESULT: AnalysisResult = {
  itemName: "Artikel",
  title: "Artikel erkannt – Titel bitte prüfen",
  description:
    "Verkaufe den abgebildeten Artikel. Zustand und Lieferumfang bitte vor Veröffentlichung kontrollieren.\n\nPrivatverkauf.",
  category: "Kategorie noch ermitteln",
  brand: "Nicht sicher erkannt",
  model: "Nicht sicher erkannt",
  condition: "Gebraucht",
  accessories: [],
  visibleDefects: [],
  recognizedText: [],
  searchTerms: [],
  confidence: 0,
  questions: [
    "Backend noch nicht verbunden. Bitte EXPO_PUBLIC_API_URL setzen.",
  ],
};

function toDraft(result: AnalysisResult): ListingDraft {
  return {
    title: result.title,
    description: result.description,
    category: result.category,
    brand: result.brand,
    model: result.model,
    condition: result.condition,
    price: "",
    priceType: "VB",
    analysis: result,
  };
}

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() || "jpg";
}

function mimeFromExtension(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

export async function analyzePhotos(
  photos: PhotoItem[],
  provider: AIProviderId,
  metadata?: { barcode?: string; voiceNotes?: string }
): Promise<ListingDraft> {
  if (!API_URL) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return toDraft({
      ...DEMO_RESULT,
      description:
        `Die App hat ${photos.length} Foto${photos.length === 1 ? "" : "s"} aufgenommen. ` +
        DEMO_RESULT.description,
    });
  }

  const form = new FormData();
  form.append("provider", provider);
  if (metadata?.barcode) form.append("barcode", metadata.barcode);
  if (metadata?.voiceNotes) form.append("voiceNotes", metadata.voiceNotes);
  form.append(
    "photoRoles",
    JSON.stringify(photos.map((photo) => photo.role ?? "general"))
  );

  photos.forEach((photo, index) => {
    const ext = extensionFromUri(photo.uri);
    const file = {
      uri: photo.uri,
      name: `artikel-${index + 1}.${ext}`,
      type: mimeFromExtension(ext),
    };

    // React Native FormData accepts { uri, name, type }.
    // The DOM TypeScript definitions do not know this native shape.
    form.append("photos", file as unknown as Blob);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload && typeof payload.error === "string"
          ? payload.error
          : `Serverfehler ${response.status}`;
      throw new Error(message);
    }

    return toDraft(payload as AnalysisResult);
  } finally {
    clearTimeout(timeout);
  }
}
