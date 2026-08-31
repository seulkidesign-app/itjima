import type { NaturalScheduleDraft } from "@/lib/naturalScheduleDraft";
import { resolveCanonicalTemporalCandidate } from "@/lib/nlTemporalResolver";

/**
 * Promote the already-audited Canonical Temporal candidate to timestamp
 * authority while leaving title, reminder, all-day, and duration policy on the
 * existing draft. For explicit ranges the Canonical model owns both ends.
 */
export function applyCanonicalTemporalAuthority(
  text: string,
  legacyDraft: NaturalScheduleDraft,
  now = new Date(),
): NaturalScheduleDraft | null {
  const candidate = resolveCanonicalTemporalCandidate(text, now);
  if (!candidate) return null;

  const start = new Date(candidate.start);
  const legacyDurationMs = Math.max(
    0,
    legacyDraft.end.getTime() - legacyDraft.start.getTime(),
  );
  const end = candidate.end
    ? new Date(candidate.end)
    : new Date(start.getTime() + legacyDurationMs);

  if (end.getTime() <= start.getTime()) return null;

  return {
    ...legacyDraft,
    start,
    end,
  };
}
