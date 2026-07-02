import { archiveSearchHaystack } from "@/lib/archiveMeta";
import type { ArchiveItem } from "@/lib/store";

const HANGUL = /[\uAC00-\uD7A3]/g;
const LATIN = /[a-z0-9]+/gi;

export type ArchiveSearchHit = {
  item: ArchiveItem;
  score: number;
  keyword: boolean;
  semantic: boolean;
};

function hangulBigrams(text: string): string[] {
  const runs = text.match(HANGUL);
  if (!runs) return [];
  const out: string[] = [];
  for (const run of runs) {
    if (run.length === 1) {
      out.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  }
  return out;
}

/** Tokenize KO bigrams + EN words — no AI, runs client-side. */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens: string[] = [];
  const latin = lower.match(LATIN);
  if (latin) tokens.push(...latin.filter((w) => w.length > 1));
  tokens.push(...hangulBigrams(lower));
  return tokens;
}

export function archiveDocument(item: ArchiveItem): string {
  return archiveSearchHaystack(item);
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function buildIdf(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const n = docs.length || 1;
  for (const tokens of docs) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, d] of df) {
    idf.set(t, Math.log(1 + n / d));
  }
  return idf;
}

function cosineTfIdf(
  queryTf: Map<string, number>,
  docTf: Map<string, number>,
  idf: Map<string, number>,
): number {
  let dot = 0;
  let qNorm = 0;
  let dNorm = 0;
  const terms = new Set([...queryTf.keys(), ...docTf.keys()]);
  for (const term of terms) {
    const idfW = idf.get(term) ?? 0;
    const q = (queryTf.get(term) ?? 0) * idfW;
    const d = (docTf.get(term) ?? 0) * idfW;
    dot += q * d;
    qNorm += q * q;
    dNorm += d * d;
  }
  if (qNorm === 0 || dNorm === 0) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm));
}

const SEMANTIC_MIN = 0.12;

export function searchArchiveItems(
  items: ArchiveItem[],
  query: string,
): { hits: ArchiveSearchHit[]; usedSemantic: boolean } {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return {
      hits: items.map((item) => ({
        item,
        score: 0,
        keyword: false,
        semantic: false,
      })),
      usedSemantic: false,
    };
  }

  const keywordHits = new Map<string, ArchiveSearchHit>();
  for (const item of items) {
    if (archiveDocument(item).includes(needle)) {
      keywordHits.set(item.id, {
        item,
        score: 1,
        keyword: true,
        semantic: false,
      });
    }
  }

  const qTokens = tokenize(needle);
  const docTokens = items.map((it) => tokenize(archiveDocument(it)));
  const idf = buildIdf(docTokens);
  const qTf = termFreq(qTokens);

  const semanticHits: ArchiveSearchHit[] = [];
  items.forEach((item, i) => {
    if (keywordHits.has(item.id)) return;
    const score = cosineTfIdf(qTf, termFreq(docTokens[i]), idf);
    if (score >= SEMANTIC_MIN) {
      semanticHits.push({
        item,
        score,
        keyword: false,
        semantic: true,
      });
    }
  });

  semanticHits.sort((a, b) => b.score - a.score);
  const hits = [...keywordHits.values(), ...semanticHits];
  return { hits, usedSemantic: semanticHits.length > 0 };
}

export function findRelatedArchiveItems(
  target: ArchiveItem,
  items: ArchiveItem[],
  limit = 4,
): ArchiveSearchHit[] {
  const others = items.filter((it) => it.id !== target.id);
  if (!others.length) return [];

  const targetTokens = tokenize(archiveDocument(target));
  const docTokens = others.map((it) => tokenize(archiveDocument(it)));
  const idf = buildIdf([targetTokens, ...docTokens]);
  const qTf = termFreq(targetTokens);

  const scored = others
    .map((item, i) => ({
      item,
      score: cosineTfIdf(qTf, termFreq(docTokens[i]), idf),
      keyword: false,
      semantic: true,
    }))
    .filter((h) => h.score >= SEMANTIC_MIN * 0.85)
    .sort((a, b) => b.score - a.score);

  if (target.source_id) {
    const lineage = others.filter((it) => it.source_id === target.source_id);
    for (const item of lineage) {
      if (!scored.some((s) => s.item.id === item.id)) {
        scored.unshift({
          item,
          score: 0.95,
          keyword: false,
          semantic: true,
        });
      }
    }
  }

  return scored.slice(0, limit);
}

export function recentArchiveItems(
  items: ArchiveItem[],
  limit = 5,
): ArchiveItem[] {
  return [...items]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit);
}
