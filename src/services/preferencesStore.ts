import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SELLER_PROFILE } from "../types/seller";
import { UserPreferences } from "../types/userPreferences";

const KEY = "verkaufsassistent.preferences.v1";

export const DEFAULT_PREFERENCES: UserPreferences = {
  preferredProvider: "openai",
  preferredPlatforms: ["kleinanzeigen", "ebay", "facebook"],
  salesGoal: "balanced",
  sellerProfile: DEFAULT_SELLER_PROFILE,
};

export async function loadPreferences(): Promise<UserPreferences> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      sellerProfile: {
        ...DEFAULT_SELLER_PROFILE,
        ...(parsed.sellerProfile || {}),
      },
      preferredPlatforms:
        Array.isArray(parsed.preferredPlatforms) &&
        parsed.preferredPlatforms.length > 0
          ? parsed.preferredPlatforms
          : DEFAULT_PREFERENCES.preferredPlatforms,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(
  preferences: UserPreferences
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(preferences));
}
