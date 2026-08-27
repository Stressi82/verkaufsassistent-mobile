import { Linking } from "react-native";
import { API_URL } from "../config";
import { EbayDiagnostics } from "../types/ebay";

export async function getEbayDiagnostics(): Promise<EbayDiagnostics> {
  if (!API_URL) {
    throw new Error("Backend ist noch nicht verbunden.");
  }

  const response = await fetch(`${API_URL}/ebay/diagnostics`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string"
        ? payload.error
        : `Diagnosefehler ${response.status}`
    );
  }

  return payload as EbayDiagnostics;
}

export async function openExternalUrl(url: string): Promise<void> {
  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error("Link konnte nicht geöffnet werden.");
  await Linking.openURL(url);
}
