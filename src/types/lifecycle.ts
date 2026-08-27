export type ListingStatus =
  | "draft"
  | "prepared"
  | "online"
  | "reserved"
  | "sold"
  | "removed";

export type LifecycleEvent = {
  id: string;
  from: ListingStatus | null;
  to: ListingStatus;
  changedAt: string;
  note?: string;
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Entwurf",
  prepared: "Vorbereitet",
  online: "Online",
  reserved: "Reserviert",
  sold: "Verkauft",
  removed: "Entfernt",
};

export const LISTING_STATUS_ORDER: ListingStatus[] = [
  "draft",
  "prepared",
  "online",
  "reserved",
  "sold",
  "removed",
];

export function canTransition(
  from: ListingStatus,
  to: ListingStatus
): boolean {
  if (from === to) return false;

  const allowed: Record<ListingStatus, ListingStatus[]> = {
    draft: ["prepared", "removed"],
    prepared: ["draft", "online", "removed"],
    online: ["prepared", "reserved", "sold", "removed"],
    reserved: ["online", "sold", "removed"],
    sold: ["online", "removed"],
    removed: ["draft", "prepared"],
  };

  return allowed[from].includes(to);
}
