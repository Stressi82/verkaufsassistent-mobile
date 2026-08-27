export type AIProviderId = "openai" | "anthropic" | "gemini";

export type AIProviderInfo = {
  id: AIProviderId;
  name: string;
  description: string;
  configured: boolean;
  model: string;
};

export const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  gemini: "Gemini",
};
