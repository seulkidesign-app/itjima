/** Brain Mirror — quiet reflection of messy thoughts into readable form. */
import { shouldCallBrainMirror } from "@/lib/ruleEngine";

export type BrainMirrorCore = {
  title: string;
  items: string[];
  suggestedDateText: string;
  suggestedAction: string;
  confidence: number;
};

export type BrainMirrorResult = BrainMirrorCore & {
  version: number;
  isCurrent: boolean;
  /** Checklist lines the user marked done in the UI. */
  completedItems?: string[];
};

export function suggestedActionForDate(dateText: string): string {
  if (!dateText) return "";
  if (dateText === "내일") return "내일이에요.";
  if (dateText === "오늘") return "오늘이에요.";
  return `${dateText}이에요.`;
}

/** Multi-intent or structured thoughts worth reflecting. */
export function isBrainMirrorCandidate(text: string): boolean {
  return shouldCallBrainMirror(text);
}

export function thoughtFirstLine(text: string): string {
  return text.split("\n")[0]?.trim() || text.trim();
}

/** Stamp version/isCurrent when persisting a new mirror snapshot. */
export function finalizeBrainMirror(
  result: BrainMirrorCore,
  previous?: BrainMirrorResult | null,
): BrainMirrorResult {
  return {
    ...result,
    version: (previous?.version ?? 0) + 1,
    isCurrent: true,
    completedItems: previous?.completedItems ?? [],
  };
}

export function parseBrainMirrorResult(raw: unknown): BrainMirrorResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string") return null;

  const itemsRaw = o.items ?? o.tasks;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];

  const suggestedAction =
    typeof o.suggestedAction === "string"
      ? o.suggestedAction
      : typeof o.message === "string"
        ? o.message
        : "";

  const suggestedDateText =
    typeof o.suggestedDateText === "string" ? o.suggestedDateText : "";

  const confidence =
    typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1
      ? o.confidence
      : 0.75;

  if (items.length === 0) return null;

  const version =
    typeof o.version === "number" && o.version >= 1 ? Math.floor(o.version) : 1;

  const completedRaw = o.completedItems;
  const completedItems = Array.isArray(completedRaw)
    ? completedRaw.filter((t): t is string => typeof t === "string")
    : [];

  return {
    title: o.title.trim().slice(0, 30),
    items,
    suggestedDateText: suggestedDateText.trim(),
    suggestedAction: suggestedAction.trim(),
    confidence,
    version,
    isCurrent: o.isCurrent !== false,
    ...(completedItems.length ? { completedItems } : {}),
  };
}

function mockSnapshot(core: BrainMirrorCore): BrainMirrorResult {
  return finalizeBrainMirror(core, null);
}

/** Local mock for UX testing when API is unavailable — swap for real API without UI changes. */
export function mockBrainMirror(text: string): BrainMirrorResult | null {
  if (!isBrainMirrorCandidate(text)) return null;

  const hasTomorrow = /내일/.test(text);
  const hasBirthday = /생일/.test(text);
  const dateText = hasTomorrow
    ? "내일"
    : /오늘/.test(text)
      ? "오늘"
      : /다음\s*주|이번\s*주/.test(text)
        ? "다음 주"
        : "";

  if (
    hasBirthday ||
    (/엄마|아빠|부모/.test(text) && /꽃|케이크|병원/.test(text))
  ) {
    const items: string[] = [];
    if (/꽃/.test(text)) items.push("꽃 구매");
    if (/케이크/.test(text)) items.push("케이크 구매");
    if (/병원/.test(text)) items.push("병원 방문");
    if (items.length === 0) items.push("준비하기");

    return mockSnapshot({
      title: hasBirthday ? "엄마 생일 준비 🎂" : "챙길 것들",
      items,
      suggestedDateText: dateText,
      suggestedAction: dateText ? suggestedActionForDate(dateText) : "",
      confidence: 0.88,
    });
  }

  const chunks = text
    .split(/(?:하고|그리고|,|，)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  const items =
    chunks.length >= 2
      ? chunks.slice(0, 5).map((c) => c.replace(/^(내일|오늘)\s*/, "").trim())
      : [];

  const title =
    text.length > 24
      ? `${text.slice(0, 22).trim()}…`
      : text.trim();

  if (items.length === 0) return null;

  return mockSnapshot({
    title,
    items,
    suggestedDateText: dateText,
    suggestedAction: dateText ? suggestedActionForDate(dateText) : "",
    confidence: items.length >= 2 ? 0.78 : 0.68,
  });
}
