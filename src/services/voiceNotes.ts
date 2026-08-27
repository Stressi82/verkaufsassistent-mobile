import { API_URL } from "../config";
import { AIProviderId } from "../types/ai";

export async function transcribeVoiceNote(
  uri: string,
  provider: AIProviderId
): Promise<string> {
  if (!API_URL) {
    throw new Error("Für automatische Transkription muss das Backend verbunden sein.");
  }

  const form = new FormData();
  form.append("provider", provider);
  form.append(
    "audio",
    {
      uri,
      name: "produktangaben.m4a",
      type: "audio/mp4",
    } as unknown as Blob
  );

  const response = await fetch(`${API_URL}/voice-note/transcribe`, {
    method: "POST",
    body: form,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string"
        ? payload.error
        : `Transkriptionsfehler ${response.status}`
    );
  }

  return typeof payload?.text === "string" ? payload.text : "";
}
