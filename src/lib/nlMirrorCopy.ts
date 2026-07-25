import { thoughtFirstLine } from "@/lib/brainMirror";
import { formatSuggestedMoment } from "@/lib/scheduleChoices";
import type { NlIntent, NlScheduleUnderstanding } from "@/lib/nlSchedule";

export type MirrorDisplay = {
  title: string;
  when: string | null;
  resultHint: string;
};

export function buildMirrorDisplay(
  text: string,
  nl: NlScheduleUnderstanding,
  lang: "ko" | "en",
): MirrorDisplay {
  const topic = thoughtFirstLine(text);
  const when =
    nl.detectedDate && nl.intent !== "archive" && nl.intent !== "task"
      ? formatSuggestedMoment(nl.detectedDate.start, lang)
      : null;

  switch (nl.intent) {
    case "schedule_exact":
      return {
        title: topic,
        when,
        resultHint:
          lang === "en"
            ? "Adds to Schedule"
            : "일정에 추가돼요",
      };
    case "schedule_clarify":
      return {
        title: topic,
        when: null,
        resultHint:
          lang === "en"
            ? "Pick a day, then add to Schedule"
            : "날짜를 고르면 일정에 추가돼요",
      };
    case "task":
      return {
        title: topic,
        when: null,
        resultHint:
          lang === "en"
            ? "Adds as a task with no date"
            : "날짜 없이 할 일로 들어가요",
      };
    case "archive":
      return {
        title: topic,
        when: null,
        resultHint:
          lang === "en"
            ? "Saves to Archive on your device"
            : "보관함에만 저장돼요",
      };
    default:
      return {
        title: topic,
        when: null,
        resultHint:
          lang === "en"
            ? "Stays in your inbox"
            : "던진 곳에 그대로 남아요",
      };
  }
}

export function primaryActionForIntent(
  intent: NlIntent,
  lang: "ko" | "en",
): string {
  const ko: Record<NlIntent, string> = {
    schedule_exact: "일정에 추가",
    schedule_clarify: "날짜 고르기",
    task: "할 일로 넣기",
    archive: "보관함에 맡기기",
    keep: "그대로 두기",
  };
  const en: Record<NlIntent, string> = {
    schedule_exact: "Add to schedule",
    schedule_clarify: "Pick a date",
    task: "Add as task",
    archive: "Save to vault",
    keep: "Keep here",
  };
  return lang === "en" ? en[intent] : ko[intent];
}
