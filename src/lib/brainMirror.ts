/** Brain Mirror — AI가 긴 생각을 하나의 의도로 읽어 정리한 결과 */
export type BrainMirrorResult = {
  title: string;
  tasks: string[];
  message: string;
};

export function isBrainMirrorCandidate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length >= 50) return true;
  const lineBreaks = (trimmed.match(/\r?\n/g) || []).length;
  return lineBreaks >= 2;
}

export function parseBrainMirrorResult(raw: unknown): BrainMirrorResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string" || typeof o.message !== "string") return null;
  const tasks = Array.isArray(o.tasks) ? o.tasks.filter((t): t is string => typeof t === "string") : [];
  return { title: o.title, tasks, message: o.message };
}

/** Example shape for docs / tests */
export const BRAIN_MIRROR_EXAMPLE: BrainMirrorResult = {
  title: "엄마 생일 준비",
  tasks: ["꽃 구매", "케이크 구매", "병원 예약"],
  message: "잊지 않게 제가 기억해둘게요.",
};
