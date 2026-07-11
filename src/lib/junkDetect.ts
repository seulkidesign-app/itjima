import type { InboxItem } from "@/lib/store";

const KEYBOARD_MASH =
  /^(asdf|qwer|zxcv|ㅁㄴㅇ|ㅎㅎ|ㅋㅋ|ㅇㅇ|ㅇㅋ|ㄴㄴ|ㄱㄱ|test|aaa+|111+|\.{2,})$/i;
const FRAGMENT = /^[^\p{L}\p{N}]{1,3}$/u;

/** Chat-filler tokens (no real content) — used to gate Brain Mirror too. */
export function isChatFiller(text: string): boolean {
  const norm = text.trim().toLowerCase().replace(/\s+/g, " ");
  return norm.length > 0 && KEYBOARD_MASH.test(norm);
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export type JunkReason =
  | "empty"
  | "single_char"
  | "keyboard_mash"
  | "fragment"
  | "duplicate";

export type JunkCandidate = {
  item: InboxItem;
  reason: JunkReason;
};

export function detectJunk(items: InboxItem[]): JunkCandidate[] {
  const out: JunkCandidate[] = [];
  const seen = new Map<string, number>();

  for (const item of items) {
    const text = item.text.trim();
    const norm = normalize(text);

    if (!text && (!item.images || item.images.length === 0)) {
      out.push({ item, reason: "empty" });
      continue;
    }

    if (text.length === 1 && !item.images?.length) {
      out.push({ item, reason: "single_char" });
      continue;
    }

    if (text.length <= 4 && KEYBOARD_MASH.test(norm)) {
      out.push({ item, reason: "keyboard_mash" });
      continue;
    }

    if (text.length <= 3 && FRAGMENT.test(text) && !item.images?.length) {
      out.push({ item, reason: "fragment" });
      continue;
    }

    if (norm.length >= 2) {
      const prev = seen.get(norm);
      const age = Date.now() - new Date(item.created_at).getTime();
      if (prev !== undefined && age < 5 * 60 * 1000) {
        out.push({ item, reason: "duplicate" });
      } else {
        seen.set(norm, age);
      }
    }
  }

  return out;
}

export function junkReasonLabel(reason: JunkReason, lang: "ko" | "en"): string {
  const ko: Record<JunkReason, string> = {
    empty: "비어 있음",
    single_char: "한 글자",
    keyboard_mash: "실수로 적은 것",
    fragment: "짧은 휴지",
    duplicate: "같은 말을 또",
  };
  const en: Record<JunkReason, string> = {
    empty: "Empty",
    single_char: "Single character",
    keyboard_mash: "Accidental typing",
    fragment: "Tiny fragment",
    duplicate: "Sent twice",
  };
  return lang === "en" ? en[reason] : ko[reason];
}
