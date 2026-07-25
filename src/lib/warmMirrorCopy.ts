import { thoughtFirstLine } from "@/lib/brainMirror";
import { formatSuggestedMoment } from "@/lib/scheduleChoices";
import type { NlIntent, NlScheduleUnderstanding } from "@/lib/nlSchedule";

function topic(text: string) {
  return thoughtFirstLine(text).replace(/[.!?…]+$/u, "").trim();
}

/** Layer 2 — warm interpretation. Never promises an action. */
export function warmMirrorLine(
  text: string,
  nl: NlScheduleUnderstanding,
  lang: "ko" | "en",
): string {
  const raw = text.trim();
  const line = topic(raw);
  const when =
    nl.detectedDate && nl.intent !== "archive" && nl.intent !== "task"
      ? formatSuggestedMoment(nl.detectedDate.start, lang)
      : null;

  if (lang === "en") {
    if (/dentist|dental/i.test(raw)) {
      return when ? `${when} — dentist appointment.` : "Dentist appointment.";
    }
    if (/call|phone|mom|dad|parent/i.test(raw)) {
      return "Something to call about.";
    }
    if (/meet|meeting|coffee|lunch|dinner/i.test(raw)) {
      return when ? `Plans for ${when}.` : "Sounds like a meet-up.";
    }
    if (/buy|shop|grocery|pick up/i.test(raw)) {
      return "Something to buy or pick up.";
    }
    if (/link|read|article|watch/i.test(raw)) {
      return "Something to read later.";
    }
    if (/passport|renew|visa|tax|insurance/i.test(raw)) {
      return "Worth saving for later.";
    }
    switch (nl.intent) {
      case "schedule_exact":
        return when ? `Schedule for ${when}.` : "Sounds like a schedule.";
      case "schedule_clarify":
        return "A schedule — needs a day.";
      case "task":
        return "Something to get done.";
      case "archive":
        return "Worth keeping for later.";
      default:
        return line.length <= 36 ? line : "A note for now.";
    }
  }

  if (/치과|치료|검진/.test(raw)) {
    return when ? `${when} 치과 예약이네요.` : "치과 예약이네요.";
  }
  if (/전화|통화|엄마|아빠|부모/.test(raw)) {
    return "전화할 일이네요.";
  }
  if (/만나|약속|미팅|회의|브런치|저녁|점심/.test(raw)) {
    return when ? `${when} 만날 약속 같아요.` : "만날 약속 같아요.";
  }
  if (/사|장보|구매|주문|픽업/.test(raw)) {
    return "사거나 챙길 것 같아요.";
  }
  if (/링크|기사|영상|볼 것|읽을/.test(raw)) {
    return "나중에 다시 보고 싶은 내용 같아요.";
  }
  if (/여권|갱신|세금|보험|계약/.test(raw)) {
    return "나중을 위해 남겨둘 내용이네요.";
  }
  if (/생일|기념/.test(raw)) {
    return when ? `${when} 챙길 날이네요.` : "챙길 날이네요.";
  }

  switch (nl.intent as NlIntent) {
    case "schedule_exact":
      return when ? `${when} 일정이에요.` : "일정 같아요.";
    case "schedule_clarify":
      return "일정인데, 날짜만 정하면 돼요.";
    case "task":
      return "해야 할 일 같아요.";
    case "archive":
      return "다시 보고 싶은 내용 같아요.";
    default:
      return line.length <= 28 ? `${line}` : "메모로 남긴 내용이에요.";
  }
}

/** Layer 3 supporting hint — literal outcome preview under Brain Mirror. */
export function warmResultHint(
  nl: NlScheduleUnderstanding,
  lang: "ko" | "en",
): string {
  if (lang === "en") {
    switch (nl.intent) {
      case "schedule_exact":
        return "Adds to Schedule";
      case "schedule_clarify":
        return "Pick a day, then adds to Schedule";
      case "task":
        return "Adds as a task with no date";
      case "archive":
        return "Saves to Archive on your device";
      default:
        return "Stays in your inbox";
    }
  }
  switch (nl.intent) {
    case "schedule_exact":
      return "일정에 추가돼요";
    case "schedule_clarify":
      return "날짜를 고르면 일정에 추가돼요";
    case "task":
      return "할 일로 들어가요";
    case "archive":
      return "보관함에 저장돼요";
    default:
      return "던진 곳에 그대로 남아요";
  }
}
