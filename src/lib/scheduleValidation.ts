export type ScheduleValidationResult =
  | { ok: true }
  | { ok: false; reason: "past_time_rollover" | "invalid_range" };

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

/**
 * ScheduleChoiceFlow historically moved a past time on today's date to the
 * same month/day next year. Detect that exact silent rollover at the save
 * boundary so v1 never persists an invented year.
 */
export function isAccidentalNextYearRollover(
  start: Date,
  now = new Date(),
): boolean {
  return (
    validDate(start) &&
    start.getFullYear() === now.getFullYear() + 1 &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}

export function validateScheduleRange(
  start: Date,
  end: Date,
  options?: { editMode?: boolean; now?: Date },
): ScheduleValidationResult {
  const now = options?.now ?? new Date();

  if (!validDate(start) || !validDate(end) || end.getTime() <= start.getTime()) {
    return { ok: false, reason: "invalid_range" };
  }

  if (!options?.editMode && isAccidentalNextYearRollover(start, now)) {
    return { ok: false, reason: "past_time_rollover" };
  }

  return { ok: true };
}

export function scheduleValidationMessage(
  reason: Exclude<ScheduleValidationResult, { ok: true }>["reason"],
  lang: "ko" | "en",
): string {
  if (reason === "past_time_rollover") {
    return lang === "en"
      ? "That time has already passed. Choose another time."
      : "선택한 시간이 이미 지났어요. 다른 시간을 골라주세요.";
  }
  return lang === "en"
    ? "Check the start and end time."
    : "시작과 종료 시간을 다시 확인해주세요.";
}
