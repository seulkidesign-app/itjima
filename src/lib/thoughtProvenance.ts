import type { BrainMirrorResult } from "@/lib/brainMirror";
import type { InboxItem, RepeatRule } from "@/lib/store";

/** Strip accidental `undefined`/`null` prefixes from legacy `${optional}${text}` saves. */
function sanitizeProvenanceText(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") return "";
  return value.replace(/^(?:undefined|null)(?=\S)/, "").trim();
}

export function inboxSnapshot(item: InboxItem) {
  const text = sanitizeProvenanceText(item.text);
  return {
    text,
    images: item.images ?? [],
    brain_mirror: item.brain_mirror ?? null,
    source_id: item.id,
    raw_text: text,
  };
}

export function scheduleFromInbox(
  item: InboxItem,
  opts: {
    text: string;
    start_time: string;
    end_time: string;
    alarm?: boolean;
    all_day?: boolean;
    repeat?: RepeatRule | null;
  },
) {
  const snap = inboxSnapshot(item);
  return {
    ...opts,
    alarm: opts.alarm ?? false,
    all_day: opts.all_day ?? false,
    repeat: opts.repeat ?? null,
    source_id: item.id,
    raw_text: snap.raw_text,
    brain_mirror: snap.brain_mirror,
    status: "active" as const,
  };
}

export function archiveFromInbox(item: InboxItem) {
  const snap = inboxSnapshot(item);
  return {
    text: snap.text,
    images: snap.images,
    source_id: snap.source_id,
    raw_text: snap.raw_text,
    brain_mirror: snap.brain_mirror,
  };
}

export function scheduleDisplayTitle(item: {
  text: string;
  raw_text?: string | null;
  brain_mirror?: BrainMirrorResult | null;
}): string {
  const bmTitle = item.brain_mirror?.title?.trim();
  if (bmTitle) return bmTitle;
  const line = sanitizeProvenanceText(item.text).split("\n")[0]?.trim();
  const rawLine = sanitizeProvenanceText(item.raw_text).split("\n")[0]?.trim();
  return line || rawLine || sanitizeProvenanceText(item.text);
}

export function rawPreview(
  item: { raw_text?: string | null; text: string },
  max = 60,
): string {
  const raw =
    sanitizeProvenanceText(item.raw_text) ||
    sanitizeProvenanceText(item.text);
  if (!raw) return "";
  if (raw.length <= max) return raw;
  return raw.slice(0, max) + "…";
}
