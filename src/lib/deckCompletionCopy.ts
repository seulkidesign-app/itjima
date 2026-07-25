import type { DecisionOutcome } from "@/lib/store";

export type SessionCounts = Record<DecisionOutcome, number>;

export function deckCompletionTitle(
  counts: SessionCounts,
  lang: "ko" | "en",
): string {
  const total = counts.today + counts.archive + counts.later;

  if (lang === "en") {
    if (total === 1 && counts.today === 1) return "One less thing to remember.";
    if (total === 1 && counts.archive === 1) return "Tucked away safely.";
    if (total === 1 && counts.later === 1) return "Still here when you need it.";
    if (counts.later === total) return "You kept them close today.";
    if (counts.today > 0 && counts.archive === 0)
      return "Your schedule feels clearer.";
    return "Your mind feels a little tidier.";
  }

  if (total === 1 && counts.today === 1) return "하나 덜 기억해도 돼요.";
  if (total === 1 && counts.archive === 1) return "보관함에 넣었어요.";
  if (total === 1 && counts.later === 1) return "그대로, 가까이 뒀어요.";
  if (counts.later === total) return "오늘은 그대로 두셨네요.";
  if (counts.today > 0 && counts.archive === 0) return "일정이 조금 정돈됐어요.";
  return "머릿속이 조금 정돈됐네요.";
}

export function deckCompletionSubtitle(
  counts: SessionCounts,
  lang: "ko" | "en",
): string | null {
  const total = counts.today + counts.archive + counts.later;
  if (total <= 1) return null;

  if (lang === "en") {
    return "Today's thoughts, sorted.";
  }
  return "오늘 떠오른 생각, 정리했어요.";
}
