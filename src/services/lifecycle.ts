import {
  LifecycleEvent,
  ListingStatus,
  canTransition,
} from "../types/lifecycle";
import { ListingRecord } from "../types/salesCenter";

function eventId(): string {
  return `lifecycle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createInitialLifecycle(
  status: ListingStatus,
  createdAt: string
): LifecycleEvent[] {
  return [
    {
      id: eventId(),
      from: null,
      to: status,
      changedAt: createdAt,
      note: "Artikel angelegt",
    },
  ];
}

export function createLifecycleForStatus(
  status: ListingStatus,
  createdAt: string
): LifecycleEvent[] {
  const path: ListingStatus[] =
    status === "draft"
      ? ["draft"]
      : status === "prepared"
        ? ["draft", "prepared"]
        : status === "online"
          ? ["draft", "prepared", "online"]
          : status === "reserved"
            ? ["draft", "prepared", "online", "reserved"]
            : status === "sold"
              ? ["draft", "prepared", "online", "sold"]
              : ["draft", "removed"];

  return path.map((to, index) => ({
    id: eventId(),
    from: index === 0 ? null : path[index - 1],
    to,
    changedAt: createdAt,
    note: index === 0 ? "Artikel angelegt" : "Lebenszyklus initialisiert",
  }));
}

export function transitionListing(
  record: ListingRecord,
  to: ListingStatus,
  note?: string
): ListingRecord {
  if (!canTransition(record.status, to)) {
    throw new Error(
      `Statuswechsel von ${record.status} zu ${to} ist nicht erlaubt.`
    );
  }

  const now = new Date().toISOString();
  const nextHistory: LifecycleEvent[] = [
    ...(record.lifecycleHistory || createInitialLifecycle(record.status, record.createdAt)),
    {
      id: eventId(),
      from: record.status,
      to,
      changedAt: now,
      note,
    },
  ];

  return {
    ...record,
    status: to,
    updatedAt: now,
    firstOnlineAt:
      record.firstOnlineAt || (to === "online" ? now : null),
    soldAt:
      to === "sold"
        ? now
        : record.status === "sold" &&
            ["online", "prepared", "draft", "reserved"].includes(to)
          ? null
          : record.soldAt || null,
    lifecycleHistory: nextHistory,
  };
}
