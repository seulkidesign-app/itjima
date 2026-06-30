/** Brain Mirror v0.1 — AI가 먼저 이해하고 보여주는 카드 */
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
};

const DATE_WORDS = /내일|오늘|모레|글피|다음\s*주|이번\s*주|오후|오전/;
const ACTION_PHRASE = /(?:해야|하려|사고|가야|하고|구매|예약|준비|신청|확인|만나|전화|보내|찾아|방문)/g;

/** Journal-like endings: emotional/state reflection, not actionable intent */
const JOURNAL_ENDING =
  /(?:좋았|나빴|피곤|기뻤|슬펐|행복|우울|힘들|즐거|감동|아쉬|후회|그립|설레|짜증|화가|놀랐|재밌|지루|답답|편했|불편|아팠|아프|괜찮|별로|최고|최악|신났|지쳤|멋졌|아쉬웠|그리웠|외로|외롭|심심|뿌듯|만족|불만|실망|기대|걱정|불안|긴장|안도|후련|담담|평온|차분|복잡|혼란|헷갈|당황|감사|고마|미안|죄송|부끄|창피|수치|자랑|뿌옇|맑았|흐렸|춥|덥|시원|따뜻|포근)(?:다|었다|었|어요|네요|습니다|어|아|네|죠|군|구나|더라|더라고|더라구)?(?:[\.\!\?~…\s]|$)/;

export function suggestedActionForDate(dateText: string): string {
  if (!dateText) return "";
  if (dateText === "내일") return "내일과 관련된 생각 같아요.";
  if (dateText === "오늘") return "오늘과 관련된 생각 같아요.";
  return `${dateText}와 관련된 생각 같아요.`;
}

export function isBrainMirrorCandidate(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const actions = trimmed.match(ACTION_PHRASE);
  const actionCount = actions?.length ?? 0;

  if (JOURNAL_ENDING.test(trimmed) && actionCount === 0) return false;
  if (DATE_WORDS.test(trimmed) && actionCount >= 1) return true;
  if (actionCount >= 2) return true;
  if (trimmed.length >= 30 && actionCount >= 1) return true;

  return false;
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

  if (!suggestedAction && items.length === 0) return null;

  const version =
    typeof o.version === "number" && o.version >= 1 ? Math.floor(o.version) : 1;

  return {
    title: o.title.trim().slice(0, 30),
    items,
    suggestedDateText: suggestedDateText.trim(),
    suggestedAction: suggestedAction.trim(),
    confidence,
    version,
    isCurrent: o.isCurrent !== false,
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

  if (hasBirthday || (/엄마|아빠|부모/.test(text) && /꽃|케이크|병원/.test(text))) {
    const items: string[] = [];
    if (/꽃/.test(text)) items.push("꽃 구매");
    if (/케이크/.test(text)) items.push("케이크 구매");
    if (/병원/.test(text)) items.push("병원 방문");
    if (items.length === 0) items.push("준비하기");

    return mockSnapshot({
      title: hasBirthday ? "엄마 생일 준비 🎂" : "챙길 것들",
      items,
      suggestedDateText: dateText,
      suggestedAction: dateText ? suggestedActionForDate(dateText) : "이렇게 기억해둘게요.",
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
    text.length > 24 ? `${text.slice(0, 22).trim()}…` : text.trim() || "이해한 내용";

  return mockSnapshot({
    title,
    items,
    suggestedDateText: dateText,
    suggestedAction: dateText
      ? suggestedActionForDate(dateText)
      : items.length > 0
        ? "이렇게 기억해둘게요."
        : "잊지 않게 제가 기억할게요.",
    confidence: 0.7,
  });
}
