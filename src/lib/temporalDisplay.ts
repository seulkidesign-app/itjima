import { parseCanonicalTemporalModel } from "@/lib/nlTemporalCalendarModel";

export function fuzzyDaypartLabel(
  text: string,
  lang: "ko" | "en",
): string | null {
  const daypart = parseCanonicalTemporalModel(text).daypart;
  if (!daypart) return null;

  const ko: Record<string, string> = {
    morning: "오전",
    afternoon: "오후",
    evening: "저녁",
    night: "밤",
    dawn: "새벽",
    lunch: "점심",
    noon: "정오",
    midnight: "자정",
  };
  const en: Record<string, string> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
    dawn: "Dawn",
    lunch: "Lunch",
    noon: "Noon",
    midnight: "Midnight",
  };

  return lang === "en" ? en[daypart] ?? null : ko[daypart] ?? null;
}

export function replaceAllDayWithFuzzyDaypart(
  whenLabel: string,
  sourceText: string,
  lang: "ko" | "en",
): string {
  if (!(whenLabel.includes("종일") || whenLabel.includes("All day"))) {
    return whenLabel;
  }

  const label = fuzzyDaypartLabel(sourceText, lang);
  if (!label) return whenLabel;

  return whenLabel.replace(
    lang === "ko" ? /하루 종일|종일/g : /All day/g,
    label,
  );
}
