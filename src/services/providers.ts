import { API_URL } from "../config";
import { AIProviderId, AIProviderInfo } from "../types/ai";

const FALLBACK: AIProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Bildanalyse und strukturierte Anzeigenerstellung",
    configured: false,
    model: "Server nicht verbunden",
  },
  {
    id: "anthropic",
    name: "Claude",
    description: "Alternative multimodale Bildanalyse",
    configured: false,
    model: "Server nicht verbunden",
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Alternative multimodale Bildanalyse",
    configured: false,
    model: "Server nicht verbunden",
  },
];

export async function getProviders(): Promise<AIProviderInfo[]> {
  if (!API_URL) return FALLBACK;

  const response = await fetch(`${API_URL}/providers`);
  if (!response.ok) return FALLBACK;

  const payload = await response.json();
  return Array.isArray(payload?.providers) ? payload.providers : FALLBACK;
}

export function getProviderById(
  providers: AIProviderInfo[],
  id: AIProviderId
): AIProviderInfo | undefined {
  return providers.find((provider) => provider.id === id);
}
