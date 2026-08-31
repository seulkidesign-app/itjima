import {
  buildNaturalScheduleDraft,
  type NaturalScheduleDraft,
} from "@/lib/naturalScheduleDraft";
import { adversarialScheduleReason } from "@/lib/nlAdversarialSafety";
import { parseCanonicalTemporalModel } from "@/lib/nlTemporalCalendarModel";
import { hasKoreanClockWordNounCollision } from "@/lib/nlKoreanTemporalNormalization";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import { hasLowConfidenceScheduleTitle } from "@/lib/nlScheduleTitleSafety";
import type { InboxItem } from "@/lib/store";

/**
 * Unicode look-alike clock tokens are intentionally not normalized. If a user
 * typed something that visibly resembles a precise clock but the exact parser
 * did not consume it, date-only completion must stay fail-closed rather than
 * silently dropping the clock.
 */
export function hasUnsupportedClockLikeResidue(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  // Full-width / circled numerals beside Korean or English clock markers.
  if (/[０-９①-⑳]+\s*(?:시|(?:am|pm)\b)/i.test(value)) return true;
  // Emoji keycap digits: 3️⃣시, 8⃣pm, etc.
  if (/\d(?:\uFE0F)?\u20E3\s*(?:시|(?:am|pm)\b)/i.test(value)) return true;
  // Full-width colon in an otherwise clock-shaped token.
  if (/(?:[0-9０-９]+)\s*：\s*(?:[0-9０-９]+)/.test(value)) return true;

  return false;
}

/**
 * Complete only a date/date+daypart plan that the existing parser already
 * understands with high confidence. This is deliberately downstream of the
 * frozen timed auto-commit gate: it never grants exact timestamp authority.
 */
export function buildTemporalCompletionDraft(
  text: string,
  lang: "ko" | "en",
  now = new Date(),
): NaturalScheduleDraft | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (adversarialScheduleReason(trimmed, now)) return null;
  if (hasUnsupportedClockLikeResidue(trimmed)) return null;
  if (hasKoreanClockWordNounCollision(trimmed)) return null;
  // Named exact instants are not fuzzy dayparts. Keep them fail-closed until
  // their exact-clock semantics are explicitly supported.
  if (/(?:정오|자정|\bnoon\b|\bmidnight\b)/i.test(trimmed)) return null;

  const nl = understandNaturalLanguage(trimmed, lang);
  if (
    nl.intent !== "schedule_exact" ||
    nl.confidence !== "high" ||
    !nl.detectedDate
  ) {
    return null;
  }

  const model = parseCanonicalTemporalModel(trimmed, now);
  if (
    !model.date ||
    model.ambiguities.length > 0 ||
    model.deadline ||
    model.recurrence ||
    model.exactClock ||
    model.bareClock ||
    model.relativeOffset ||
    model.range ||
    (model.precision !== "date" && model.precision !== "daypart")
  ) {
    return null;
  }

  const draft = buildNaturalScheduleDraft(
    {
      id: "temporal-completion-eval",
      text: trimmed,
      images: [],
      created_at: now.toISOString(),
    } satisfies InboxItem,
    now,
  );

  if (!draft.options.allDay || !draft.text.trim()) return null;
  if (hasLowConfidenceScheduleTitle(draft.text, lang)) return null;
  // Today remains valid until the represented day ends; never resurrect past days.
  if (draft.end.getTime() <= now.getTime()) return null;

  return draft;
}
