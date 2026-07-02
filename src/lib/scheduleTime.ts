/** Countdown ring + remaining-time helpers for Schedule v0.3 */

export type RemainingParts = {
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
};

export function remainingUntil(target: Date, now = new Date()): RemainingParts {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) {
    return {
      ms: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      past: true,
    };
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { ms, days, hours, minutes, seconds, past: false };
}

/** 0→1 fill as the event approaches (Apple-style urgency ring). */
export function countdownRingProgress(
  startIso: string,
  createdIso?: string,
  now = Date.now(),
): number {
  const start = new Date(startIso).getTime();
  if (start <= now) return 1;
  const created = createdIso ? new Date(createdIso).getTime() : now;
  const windowMs = Math.min(
    24 * 3600_000,
    Math.max(3600_000, start - Math.min(created, start - 3600_000)),
  );
  const windowStart = start - windowMs;
  const elapsed = now - windowStart;
  return Math.min(1, Math.max(0, elapsed / windowMs));
}

export function formatRemainingCompact(
  target: Date,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const r = remainingUntil(target, now);
  if (r.past) return lang === "en" ? "Started" : "시작됨";
  if (r.days > 0) {
    return lang === "en"
      ? `${r.days}d ${r.hours}h`
      : `${r.days}일 ${r.hours}시간`;
  }
  if (r.hours > 0) {
    return lang === "en"
      ? `${r.hours}h ${r.minutes}m`
      : `${r.hours}시간 ${r.minutes}분`;
  }
  if (r.minutes > 0) {
    return lang === "en" ? `${r.minutes}m` : `${r.minutes}분`;
  }
  return lang === "en" ? `${r.seconds}s` : `${r.seconds}초`;
}

export function formatRemainingLong(
  target: Date,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const r = remainingUntil(target, now);
  if (r.past) return lang === "en" ? "Started" : "시작됨";
  if (r.days > 0) {
    return lang === "en"
      ? `${r.days}d ${r.hours}h left`
      : `${r.days}일 ${r.hours}시간 남음`;
  }
  if (r.hours > 0) {
    return lang === "en"
      ? `${r.hours}h ${r.minutes}m left`
      : `${r.hours}시간 ${r.minutes}분 남음`;
  }
  if (r.minutes > 0) {
    return lang === "en" ? `${r.minutes}m left` : `${r.minutes}분 남음`;
  }
  return lang === "en" ? `${r.seconds}s left` : `${r.seconds}초 남음`;
}

export function nextWeekendMorning(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getDay();
  let add = (6 - day + 7) % 7;
  if (day === 6 && d.getHours() < 10) add = 0;
  else if (add === 0 && day !== 6) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function tonightAt(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
  }
  return d;
}
