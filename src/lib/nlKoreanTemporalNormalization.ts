const KO_CLOCK_WORD_TO_HOUR: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10,
  열한: 11,
  열두: 12,
};

// Longest alternatives first so `열한 시` never degrades to `한 시`.
const KO_CLOCK_WORD_RE =
  /(?:(오전|오후)\s*)?(열두|열한|아홉|여덟|일곱|여섯|다섯|열|네|세|두|한)\s*시(?!\s*(?:간|적))/g;

/**
 * Parsing-only normalization for conversational Korean clock words.
 *
 * It never changes persisted/raw user text. Only unambiguous clock-number words
 * are converted, e.g. `오후 세 시` -> `오후 3시` and `열한시 반` -> `11시 반`.
 * Bare 1-12 clocks remain bare after normalization, so the existing AM/PM
 * clarification contract still applies.
 */
export function normalizeKoreanClockWordsForParsing(text: string): string {
  return text.replace(
    KO_CLOCK_WORD_RE,
    (_match, period: string | undefined, word: string) => {
      const hour = KO_CLOCK_WORD_TO_HOUR[word];
      if (!hour) return _match;
      return `${period ? `${period} ` : ""}${hour}시`;
    },
  );
}

/** True when the original text contains a supported spoken Korean clock. */
export function hasKoreanClockWord(text: string): boolean {
  KO_CLOCK_WORD_RE.lastIndex = 0;
  return KO_CLOCK_WORD_RE.test(text);
}
