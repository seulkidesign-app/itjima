/** Brain Mirror v0.1 — AI가 먼저 이해하고 보여주는 카드 */
export type BrainMirrorResult = {
  title: string;
  items: string[];
  suggestedDateText: string;
  suggestedAction: string;
  confidence: number;
};

const DATE_WORDS = /내일|오늘|모레|글피|다음\s*주|이번\s*주|오후|오전/;
const ACTION_PHRASE = /(?:해야|하려|사고|가야|하고|구매|예약|준비|신청|확인|만나|전화|보내|찾아|방문)/g;

export function isBrainMirrorCandidate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length >= 30) return true;
  if (DATE_WORDS.test(trimmed)) return true;
  const actions = trimmed.match(ACTION_PHRASE);
  return (actions?.length ?? 0) >= 2;
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

  if (!suggestedAction && items.length === 0) return null;

  return {
    title: o.title.trim().slice(0, 30),
    items,
    suggestedDateText: suggestedDateText.trim(),
    suggestedAction: suggestedAction.trim(),
    confidence,
  };
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

  if (hasBirthday || (/엄마|아빠|부모/.test(text) && /꽃|케이크|병원/.test(text))) {
    const items: string[] = [];
    if (/꽃/.test(text)) items.push("꽃 구매");
    if (/케이크/.test(text)) items.push("케이크 구매");
    if (/병원/.test(text)) items.push("병원 방문");
    if (items.length === 0) items.push("준비하기");

    return {
      title: hasBirthday ? "엄마 생일 준비 🎂" : "챙길 것들",
      items,
      suggestedDateText: dateText,
      suggestedAction: dateText
        ? `${dateText} 일정으로 넣어둘게요.`
        : "일정으로 넣어둘게요.",
      confidence: 0.88,
    };
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
    text.length > 24 ? `${text.slice(0, 22).trim()}…` : text.trim() || "이해한 내용";

  return {
    title,
    items,
    suggestedDateText: dateText,
    suggestedAction: dateText
      ? `${dateText} 일정으로 넣어둘게요.`
      : items.length > 0
        ? "이렇게 기억해둘게요."
        : "잊지 않게 제가 기억할게요.",
    confidence: 0.7,
  };
}
