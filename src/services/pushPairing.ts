import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "verkaufsassistent.pushPairing.v1";

export async function loadPushPairingCode(): Promise<string> {
  return (await AsyncStorage.getItem(KEY)) || "";
}

export async function savePushPairingCode(code: string): Promise<void> {
  const trimmed = code.trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, trimmed);
}
