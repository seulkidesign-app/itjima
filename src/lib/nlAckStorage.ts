const KEY_PREFIX = "itjima.nl.acknowledged.";

function storageKey(userId: string | null): string {
  return `${KEY_PREFIX}${userId ?? "guest"}`;
}

export function loadAcknowledgedIds(userId: string | null): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

export function saveAcknowledgedIds(
  userId: string | null,
  ids: Set<string>,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
}

export function pruneAcknowledgedIds(
  ids: Set<string>,
  activeInboxIds: Set<string>,
): Set<string> {
  const next = new Set<string>();
  for (const id of ids) {
    if (activeInboxIds.has(id)) next.add(id);
  }
  return next;
}
