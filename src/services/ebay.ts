import { Linking } from "react-native";
import { API_URL } from "../config";
import { EbayStatus } from "../types/ebay";

const FALLBACK_STATUS: EbayStatus = {
  configured: false,
  connected: false,
  environment: "sandbox",
  message: "Backend oder eBay-Zugang noch nicht konfiguriert.",
};

export async function getEbayStatus(): Promise<EbayStatus> {
  if (!API_URL) return FALLBACK_STATUS;

  try {
    const response = await fetch(`${API_URL}/ebay/status`);
    const payload = await response.json();
    if (!response.ok) return FALLBACK_STATUS;
    return payload as EbayStatus;
  } catch {
    return FALLBACK_STATUS;
  }
}

export async function connectEbay(): Promise<void> {
  if (!API_URL) throw new Error("Backend ist noch nicht verbunden.");

  const response = await fetch(`${API_URL}/ebay/oauth/start`);
  const payload = await response.json();

  if (!response.ok || typeof payload?.authUrl !== "string") {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : "eBay-Verknüpfung konnte nicht gestartet werden."
    );
  }

  const supported = await Linking.canOpenURL(payload.authUrl);
  if (!supported) throw new Error("eBay-Anmeldeseite konnte nicht geöffnet werden.");

  await Linking.openURL(payload.authUrl);
}

export async function disconnectEbay(): Promise<void> {
  if (!API_URL) return;
  await fetch(`${API_URL}/ebay/disconnect`, { method: "POST" });
}
