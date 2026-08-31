import { normalizeKoreanClockWordsForParsing } from "@/lib/nlKoreanTemporalNormalization";
import {
  scheduleConfirmationReason,
  type ScheduleConfirmationReason,
} from "@/lib/nlScheduleSafety";
import { shouldShowInlinePromise } from "@/lib/promiseCard";
import type { ClarificationState } from "@/lib/store";

export type NlClarificationPresentation = {
  confirmationText: string;
  confirmationReason: ScheduleConfirmationReason | null;
  parserRequestedConfirmation: boolean;
  shouldSurface: boolean;
};

/**
 * Bridge parser safety state to the Home clarification surface.
 *
 * The parser may correctly fail closed before generic promise heuristics consider
 * the text a schedule. Once that happens, the durable clarification_state is the
 * authority that a user-visible question is required. Korean clock-word
 * normalization is parsing/display-only and never mutates the raw record.
 */
export function getNlClarificationPresentation(
  text: string,
  lang: "ko" | "en",
  clarificationState?: ClarificationState | null,
): NlClarificationPresentation {
  const confirmationText = normalizeKoreanClockWordsForParsing(text.trim());
  const confirmationReason = scheduleConfirmationReason(confirmationText);
  const parserRequestedConfirmation =
    clarificationState === "pending" && confirmationReason !== null;

  return {
    confirmationText,
    confirmationReason,
    parserRequestedConfirmation,
    shouldSurface:
      parserRequestedConfirmation || shouldShowInlinePromise(text, lang),
  };
}
