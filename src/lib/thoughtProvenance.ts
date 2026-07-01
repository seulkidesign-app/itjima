import type { BrainMirrorResult } from "@/lib/brainMirror";
import type { InboxItem } from "@/lib/store";

export function inboxSnapshot(item: InboxItem) {
  return {
    text: item.text,
    images: item.images ?? [],
    brain_mirror: item.brain_mirror ?? null,
    source_id: item.id,
    raw_text: item.text,
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
    repeat?: null;
    all_day?: boolean;
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
  const line = item.text.split("\n")[0]?.trim();
  return line || item.raw_text?.split("\n")[0]?.trim() || item.text;
}

export function rawPreview(
  item: { raw_text?: string | null; text: string },
  max = 60,
): string {
  const raw = (item.raw_text ?? item.text).trim();
  if (raw.length <= max) return raw;
  return raw.slice(0, max) + "…";
}
