import { buildPromiseCard } from "@/lib/promiseCard";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import type { NlDebugSnapshot } from "@/lib/nlDebug";

type Props = {
  text: string;
  lang: "ko" | "en";
  acknowledged: boolean;
};

export function NlDebugPanel({ text, lang, acknowledged }: Props) {
  const nl = understandNaturalLanguage(text, lang);
  const card = buildPromiseCard(text, lang);
  const snap: NlDebugSnapshot = {
    intent: nl.intent,
    confidenceTier: nl.confidence,
    hasDate: !!nl.detectedDate,
    hasTime: nl.hasExplicitTime,
    sensitive: nl.isSensitive,
    parsingPath: "rule",
    acknowledged,
  };

  return (
    <div
      className="mt-2 w-full rounded-[10px] border border-dashed border-amber-400/60 bg-amber-50/80 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-amber-950"
      data-testid="nl-debug-panel"
    >
      <div className="font-semibold">NL debug</div>
      <div>intent: {snap.intent}</div>
      <div>confidence: {snap.confidenceTier}</div>
      <div>hasDate: {String(snap.hasDate)}</div>
      <div>hasTime: {String(snap.hasTime)}</div>
      <div>sensitive: {String(snap.sensitive)}</div>
      <div>path: {snap.parsingPath}</div>
      <div>ack: {String(snap.acknowledged)}</div>
      <div>showCard: {String(card.nlIntent !== "keep" && nl.confidence !== "low")}</div>
    </div>
  );
}
