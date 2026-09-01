import { describe, expect, it } from "vitest";
import { cleanScheduleTitle } from "@/lib/naturalScheduleDraft";

describe("schedule title preservation — semantic collisions", () => {
  it("still strips a normal owned date and clock", () => {
    expect(cleanScheduleTitle("내일 오후 3시 병원")).toBe("병원");
  });

  it("keeps a product/model name that merely contains a clock-looking prefix", () => {
    expect(cleanScheduleTitle("7시리즈 오후 3시 디자인 비교")).toBe(
      "7시리즈 디자인 비교",
    );
  });

  it("keeps a spatial clock-direction phrase while removing the actual meeting time", () => {
    expect(cleanScheduleTitle("3시 방향 출구에서 오후 5시 만나")).toBe(
      "3시 방향 출구에서 만나",
    );
  });

  it("keeps a relative-day word when it is part of a semantic title", () => {
    expect(cleanScheduleTitle("내일이라는 소설 오후 3시 사기")).toBe(
      "내일이라는 소설 사기",
    );
  });

  it("keeps the title surface even when an owned clock comes first", () => {
    expect(cleanScheduleTitle("오후 3시 7시리즈 디자인 비교")).toBe(
      "7시리즈 디자인 비교",
    );
  });
});
