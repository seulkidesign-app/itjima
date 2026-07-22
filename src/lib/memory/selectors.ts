import { localDateInTimezone, precisionFromMemory } from "./validation";
import type { Memory, MemoryTemporalState } from "./types";

export function isMemoryDue(
  memory: Memory,
  now = new Date(),
  timezone = memory.resurface_timezone,
): boolean {
  if (memory.status !== "waiting") return false;
  const precision = precisionFromMemory(memory);
  if (precision === "exact" && memory.resurface_at) {
    return new Date(memory.resurface_at).getTime() <= now.getTime();
  }
  if (precision === "day" && memory.resurface_on) {
    const today = localDateInTimezone(now, timezone);
    return memory.resurface_on <= today;
  }
  return false;
}

export function isMemoryDueToday(
  memory: Memory,
  now = new Date(),
  timezone = memory.resurface_timezone,
): boolean {
  if (memory.status !== "waiting") return false;
  const precision = precisionFromMemory(memory);
  if (precision === "exact" && memory.resurface_at) {
    const dueAt = new Date(memory.resurface_at);
    if (dueAt.getTime() > now.getTime()) return false;
    const dueDay = localDateInTimezone(dueAt, timezone);
    const today = localDateInTimezone(now, timezone);
    return dueDay === today;
  }
  if (precision === "day" && memory.resurface_on) {
    const today = localDateInTimezone(now, timezone);
    return memory.resurface_on === today;
  }
  return false;
}

export function getMemoryTemporalState(
  memory: Memory,
  now = new Date(),
  timezone = memory.resurface_timezone,
): MemoryTemporalState {
  if (memory.status !== "waiting") return "not_due";

  const precision = precisionFromMemory(memory);
  if (precision === "exact" && memory.resurface_at) {
    const dueAt = new Date(memory.resurface_at);
    if (dueAt.getTime() > now.getTime()) return "not_due";
    if (isMemoryDueToday(memory, now, timezone)) return "due_today";
    const dueDay = localDateInTimezone(dueAt, timezone);
    const today = localDateInTimezone(now, timezone);
    return dueDay < today ? "overdue" : "due";
  }

  if (precision === "day" && memory.resurface_on) {
    const today = localDateInTimezone(now, timezone);
    if (memory.resurface_on > today) return "not_due";
    if (memory.resurface_on === today) return "due_today";
    return "overdue";
  }

  return "not_due";
}
