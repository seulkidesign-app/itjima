const KINDS = ["inbox", "schedules", "archive"] as const;
type Kind = (typeof KINDS)[number];

const GUEST_KEY = (kind: Kind) => `itjima.guest.${kind}`;
const BACKUP_KEY = (kind: Kind) => `itjima.guestBackup.${kind}`;

function parseRows(value: string | null): Array<{ id?: unknown }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function idsOf(value: string | null): string[] {
  return parseRows(value)
    .map((row) => (typeof row?.id === "string" ? row.id : null))
    .filter((id): id is string => Boolean(id));
}

function hasUserCopy(storage: Storage, kind: Kind, ids: string[]): boolean {
  if (!ids.length) return false;
  const wanted = new Set(ids);

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (!key.startsWith("itjima.") || !key.endsWith(`.${kind}`)) continue;
    if (key === GUEST_KEY(kind) || key === BACKUP_KEY(kind)) continue;

    const present = new Set(idsOf(storage.getItem(key)));
    if ([...wanted].every((id) => present.has(id))) return true;
  }

  return false;
}

function restoreInterruptedTransfers(storage: Storage) {
  for (const kind of KINDS) {
    const guestKey = GUEST_KEY(kind);
    const backupKey = BACKUP_KEY(kind);
    const guestRows = parseRows(storage.getItem(guestKey));
    const backupRaw = storage.getItem(backupKey);
    const backupRows = parseRows(backupRaw);
    const backupIds = idsOf(backupRaw);

    if (guestRows.length || !backupRows.length) continue;
    if (hasUserCopy(storage, kind, backupIds)) continue;

    storage.setItem(guestKey, JSON.stringify(backupRows));
  }
}

/**
 * Protects guest memories during guest → account migration.
 *
 * The legacy sync writes a user-scoped local copy before clearing the guest
 * bucket. We retain a backup at the clear boundary. On a later app start the
 * backup is restored only when neither the guest bucket nor any user-scoped
 * bucket still contains those ids. This avoids duplicate visible data while
 * preventing interrupted sync or storage churn from destroying the last copy.
 */
export function installGuestDataSafety() {
  if (typeof window === "undefined") return;
  const storage = window.localStorage;
  restoreInterruptedTransfers(storage);

  const originalSetItem = storage.setItem.bind(storage);
  if ((storage.setItem as typeof storage.setItem & { __itjimaSafe?: boolean }).__itjimaSafe) {
    return;
  }

  const safeSetItem = ((key: string, value: string) => {
    const kind = KINDS.find((candidate) => key === GUEST_KEY(candidate));
    if (kind) {
      const previous = storage.getItem(key);
      const previousRows = parseRows(previous);
      const nextRows = parseRows(value);
      if (previousRows.length > 0 && nextRows.length === 0) {
        originalSetItem(BACKUP_KEY(kind), JSON.stringify(previousRows));
      }
    }
    originalSetItem(key, value);
  }) as typeof storage.setItem & { __itjimaSafe?: boolean };

  safeSetItem.__itjimaSafe = true;
  storage.setItem = safeSetItem;
}
