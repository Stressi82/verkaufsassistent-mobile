import { API_URL } from "../config";
import { AIProviderId } from "../types/ai";
import { PhotoItem } from "../types/listing";
import { PhotoAuditResult } from "../types/photoAudit";

function localFallback(photos: PhotoItem[]): PhotoAuditResult {
  const rows = photos.map((photo, index) => {
    const role = photo.role ?? "general";
    const base =
      role === "cover" ? 90 :
      role === "general" ? Math.max(62, 84 - index * 3) :
      role === "accessories" ? 62 :
      role === "damage" ? 48 :
      role === "typeplate" ? 42 : 55;

    return {
      photoIndex: index,
      qualityScore: base,
      coverScore: base,
      usable: true,
      issues: [],
      notes: [
        "Nur lokaler Fallback: Bildqualität und Privatsphäre wurden nicht visuell durch eine KI geprüft.",
      ],
      privacyRisks: [],
      blockingPrivacyRisk: false,
    };
  });

  const recommendedCoverIndex = rows.reduce((best, row, index, arr) => {
    const bestRow = arr[best];
    return !bestRow || row.coverScore > bestRow.coverScore ? index : best;
  }, 0);

  return {
    source: "local_fallback",
    privacyScanComplete: false,
    overallQualityScore:
      rows.length > 0
        ? Math.round(rows.reduce((sum, row) => sum + row.qualityScore, 0) / rows.length)
        : 0,
    recommendedCoverIndex,
    hasBlockingPrivacyRisk: false,
    blockingIssues: [],
    improvementTips: [
      "Für eine echte Privatsphäre- und Qualitätsprüfung Backend/KI verbinden.",
    ],
    photos: rows,
  };
}

export async function auditPhotos(
  photos: PhotoItem[],
  provider: AIProviderId
): Promise<PhotoAuditResult> {
  if (!photos.length) throw new Error("Keine Fotos vorhanden.");
  if (!API_URL) return localFallback(photos);

  const form = new FormData();
  form.append("provider", provider);
  form.append(
    "photoRoles",
    JSON.stringify(photos.map((photo) => photo.role ?? "general"))
  );

  photos.forEach((photo, index) => {
    form.append(
      "photos",
      {
        uri: photo.uri,
        name: `audit-${index + 1}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob
    );
  });

  try {
    const response = await fetch(`${API_URL}/photo-audit`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload && typeof payload.error === "string"
          ? payload.error
          : `Foto-Check fehlgeschlagen (${response.status})`
      );
    }

    return payload as PhotoAuditResult;
  } catch {
    return localFallback(photos);
  }
}

export function demoPhotoAudit(photoCount: number): PhotoAuditResult {
  const rows = Array.from({ length: photoCount }, (_, index) => ({
    photoIndex: index,
    qualityScore: index === 0 ? 93 : index === 1 ? 82 : 86,
    coverScore: index === 0 ? 96 : index === 1 ? 38 : 72,
    usable: true,
    issues: [],
    notes:
      index === 0
        ? ["Produkt vollständig sichtbar", "ruhiger Hintergrund", "gute Perspektive"]
        : index === 1
          ? ["Typenschild gut lesbar – wichtig für Modellprüfung"]
          : ["Zubehör vollständig sichtbar"],
    privacyRisks: [],
    blockingPrivacyRisk: false,
  }));

  return {
    source: "demo",
    privacyScanComplete: true,
    overallQualityScore: 87,
    recommendedCoverIndex: 0,
    hasBlockingPrivacyRisk: false,
    blockingIssues: [],
    improvementTips: [
      "Zusätzlich ein nahes Foto vorhandener Gebrauchsspuren aufnehmen.",
    ],
    photos: rows,
  };
}
