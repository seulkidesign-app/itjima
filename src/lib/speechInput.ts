/** Normalize and dedupe speech segments before committing to composer text. */
export function normalizeSpeechSegment(segment: string) {
  return segment
    .normalize("NFKC")
    .replace(/[.,!?。！？]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function comparable(segment: string) {
  return normalizeSpeechSegment(segment)
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
}

export function appendFinalSpeech(prev: string, segment: string) {
  const trimmed = normalizeSpeechSegment(segment);
  if (!trimmed) return prev;

  const prevNorm = normalizeSpeechSegment(prev);
  if (!prevNorm) return trimmed;

  const prevKey = comparable(prevNorm);
  const nextKey = comparable(trimmed);

  // Browsers may emit the same final result again with punctuation or spacing
  // differences, or emit a cumulative final phrase after a shorter phrase.
  if (prevKey === nextKey) return prev;
  if (prevKey.endsWith(nextKey)) return prev;
  if (nextKey.startsWith(prevKey)) return trimmed;

  // Also suppress a repeated trailing phrase such as
  // "내일 치과" + "치과" or a cumulative overlap across result indexes.
  const maxOverlap = Math.min(prevKey.length, nextKey.length);
  for (let overlap = maxOverlap; overlap >= 2; overlap -= 1) {
    if (prevKey.slice(-overlap) === nextKey.slice(0, overlap)) {
      const normalizedNext = normalizeSpeechSegment(trimmed);
      const suffixRatio = overlap / nextKey.length;
      if (suffixRatio >= 0.6) return prev;
      break;
    }
  }

  return `${prevNorm} ${trimmed}`;
}
