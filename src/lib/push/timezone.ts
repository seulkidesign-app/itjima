/** Resolve IANA timezone for reminder records. */
export function resolveUserTimezone(): string {
  if (typeof Intl === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Convert local Date to UTC ISO for storage. */
export function toUtcIso(local: Date): string {
  return local.toISOString();
}

/** Validate end is not before start. */
export function isValidTimeRange(start: Date, end: Date): boolean {
  return end.getTime() >= start.getTime();
}
