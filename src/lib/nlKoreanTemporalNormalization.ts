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
// Require a clock token boundary so noun stems (`시안`, `시나리오`, …) stay intact.
const KO_CLOCK_WORD_RE =
  /(?:(오전|오후)\s*)?(열두|열한|아홉|여덟|일곱|여섯|다섯|열|네|세|두|한)\s*시(?!\s*(?:간|적))(?=(?:\s*(?:반|\d{1,2}\s*분))?(?:\s|$|[.,!?…]|[에을를이가의은는도만]|부터|까지|쯤|경|무렵|정도))/g;

/**
 * Parsing-only normalization for conversational Korean clock words.
 * It never changes persisted/raw user text.
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

export function hasKoreanClockWord(text: string): boolean {
  KO_CLOCK_WORD_RE.lastIndex = 0;
  return KO_CLOCK_WORD_RE.test(text);
}
