/**
 * Bei echtem Gerät darf "localhost" nicht verwendet werden.
 *
 * Beispiel im gleichen WLAN:
 * EXPO_PUBLIC_API_URL=http://192.168.178.50:8787
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
