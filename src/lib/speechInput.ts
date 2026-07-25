/** Normalize and dedupe speech segments before committing to composer text. */
export function normalizeSpeechSegment(segment: string) {
  return segment.replace(/\s+/g, " ").trim();
}

export function appendFinalSpeech(prev: string, segment: string) {
  const trimmed = normalizeSpeechSegment(segment);
  if (!trimmed) return prev;
  const prevNorm = normalizeSpeechSegment(prev);
  if (prevNorm === trimmed) return prev;
  if (prevNorm.endsWith(trimmed)) return prev;
  if (trimmed.startsWith(prevNorm) && prevNorm.length > 0) return trimmed;
  return prevNorm ? `${prevNorm} ${trimmed}` : trimmed;
}
