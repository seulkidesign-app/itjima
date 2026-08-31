import { describe, expect, it } from "vitest";
import { parseNlTemporalModel } from "@/lib/nlTemporalModel";

const NOW = new Date(2026, 7, 30, 8, 0, 0, 0);
const parse = (text: string) => parseNlTemporalModel(text, NOW);

describe("P0-G temporal model unsupported Korean clock ranges", () => {
  it("does not extract the first clock from a Korean meridiem tilde range", () => {
    const model = parse("오전 9시~오후 6시 근무");

    expect(model.range).toMatchObject({
      supportedSyntax: false,
      resolved: false,
      start: null,
      end: null,
    });
    expect(model.exactClock).toBeNull();
    expect(model.bareClock).toBeNull();
    expect(model.ambiguities).toContain("unsupported_range");
    expect(model.precision).toBe("ambiguous");
  });

  it("keeps Korean meridiem dash ranges unsupported", () => {
    const model = parse("오후 3시-오후 5시 회의");

    expect(model.range?.supportedSyntax).toBe(false);
    expect(model.exactClock).toBeNull();
    expect(model.ambiguities).toContain("unsupported_range");
  });

  it("keeps the supported Korean from-to range resolved", () => {
    const model = parse("오후 5시부터 6시까지 운동");

    expect(model.range?.supportedSyntax).toBe(true);
    expect(model.range?.resolved).toBe(true);
    expect(model.range?.start).toMatchObject({ kind: "exact", hour24: 17, minute: 0 });
    expect(model.range?.end).toMatchObject({ kind: "exact", hour24: 18, minute: 0 });
    expect(model.ambiguities).not.toContain("unsupported_range");
    expect(model.precision).toBe("range");
  });

  it("does not mistake duration words containing 시간 for clock ranges", () => {
    const model = parse("오후 2시간~3시간 영화 보기");

    expect(model.range).toBeNull();
  });
});
