import AsyncStorage from "@react-native-async-storage/async-storage";
import { ListingRecord } from "../types/salesCenter";

const KEY = "verkaufsassistent.listings.v1";

export async function loadListings(): Promise<ListingRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveListings(records: ListingRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
}

export async function upsertListing(
  records: ListingRecord[],
  next: ListingRecord
): Promise<ListingRecord[]> {
  const exists = records.some((record) => record.id === next.id);
  const updated = exists
    ? records.map((record) => (record.id === next.id ? next : record))
    : [next, ...records];

  await saveListings(updated);
  return updated;
}

export async function removeListing(
  records: ListingRecord[],
  id: string
): Promise<ListingRecord[]> {
  const updated = records.filter((record) => record.id !== id);
  await saveListings(updated);
  return updated;
}
