import { describe, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";

const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);

describe("reminder diagnostic", () => {
  it("prints reminder gate reasons", () => {
    const inputs = [
      "내일 오후 3시 회의 알려줘",
      "내일 오후 3시 회의 5분 전에 알려줘",
      "내일 오후 3시 회의 10분 전에 알려줘",
      "내일 오후 3시 회의 30분 전에 알려줘",
      "내일 오후 3시 회의 1시간 전에 알려줘",
      "내일 오후 3시 회의 전날 알려줘",
      "내일 오후 3시 회의 알림 끄기",
      "내일 오후 3시 회의 알려주지 마",
    ];
    const rows = inputs.map((input) => {
      const result = evaluateTimedAutoCommit(input, "ko", NOW);
      return {
        input,
        ok: result.ok,
        result: result.ok
          ? { start: result.draft.start.toISOString(), reminder: result.draft.options.reminderMinutes }
          : result.reason,
      };
    });
    console.log(JSON.stringify({ audit: "reminder-gate-diagnostic", rows }));
  });
});
