import { describe, expect, it } from "vitest";
import { evaluateTemporalDecisionGate } from "@/lib/nlTemporalDecisionGate";

const MORNING = new Date(2026, 7, 30, 8, 0, 0, 0);
const gate = (text: string) => evaluateTemporalDecisionGate(text, MORNING);

describe("P0-H canonical temporal decision gate", () => {
  it("allows an exact clock", () => {
    expect(gate("내일 오후 3시 치과")).toEqual({
      ok: true,
      precision: "exact_clock",
    });
  });

  it("allows a supported relative offset", () => {
    expect(gate("10분 뒤에 전화")).toEqual({
      ok: true,
      precision: "relative_offset",
    });
  });

  it("allows a forward supported range", () => {
    expect(gate("오후 5시부터 6시까지 운동")).toEqual({
      ok: true,
      precision: "range",
    });
  });

  it.each([
    ["내일 오후에 밥먹기", "no_resolved_clock"],
    ["내일 3시 병원", "ambiguity"],
    ["오후 3시쯤 병원", "ambiguity"],
    ["오전 9시~오후 6시 근무", "ambiguity"],
    ["오후 5시까지 제출", "deadline"],
    ["월요일마다 오후 3시 운동", "recurrence"],
  ] as const)("rejects unresolved semantics: %s", (text, reason) => {
    const result = gate(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  });

  it("rejects a reversed supported range even if the parser recognized its syntax", () => {
    const result = gate("오후 5시부터 4시까지 운동");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unsafe_range");
  });
});
