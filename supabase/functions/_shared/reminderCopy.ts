export type ReminderLanguage = "ko" | "en";

export function reminderLanguageForText(
  text: string | null | undefined,
): ReminderLanguage {
  return /[가-힣]/.test(text ?? "") ? "ko" : "en";
}

export function safeReminderTimeZone(
  timeZone: string | null | undefined,
): string {
  const candidate = timeZone?.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

export function formatReminderTime(
  iso: string,
  timeZone: string | null | undefined,
  language: ReminderLanguage,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ko-KR", {
    timeZone: safeReminderTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function reminderBody(options: {
  startIso: string;
  timeZone: string | null | undefined;
  language: ReminderLanguage;
  allDay: boolean;
}): string {
  const { startIso, timeZone, language, allDay } = options;
  if (allDay) {
    return language === "en" ? "Scheduled for today." : "예정된 일정이에요.";
  }

  const timeLabel = formatReminderTime(startIso, timeZone, language);
  if (!timeLabel) {
    return language === "en" ? "Scheduled reminder." : "예정된 일정이에요.";
  }
  return language === "en"
    ? `Starts at ${timeLabel}.`
    : `${timeLabel} 일정이에요.`;
}
