import { describe, expect, it } from "vitest";
import { cleanScheduleTitle } from "@/lib/naturalScheduleDraft";

describe("NL title preservation P0-B", () => {
  it("preserves unresolved temporal phrases instead of partially deleting them", () => {
    expect(cleanScheduleTitle("다다음 주 월요일 청소")).toBe("다다음 주 월요일 청소");
    expect(cleanScheduleTitle("1시간 반 뒤에 출발")).toBe("1시간 반 뒤에 출발");
    expect(cleanScheduleTitle("이번 주말 저녁에 영화")).toBe("이번 주말 저녁에 영화");
    expect(cleanScheduleTitle("오전 9시~오후 6시 근무")).toBe("오전 9시~오후 6시 근무");
    expect(cleanScheduleTitle("2026년 9월 3일 청소")).toBe("2026년 9월 3일 청소");
  });

  it("removes fully owned temporal spans atomically", () => {
    expect(cleanScheduleTitle("2026년 9월 3일 오후 4시 청소")).toBe("청소");
    expect(cleanScheduleTitle("내일 엄마 병원 10시에 같이 가기")).toBe("엄마 병원 같이 가기");
  });

  it("keeps existing supported title cleaning intact", () => {
    expect(cleanScheduleTitle("오전 10시에 청소")).toBe("청소");
    expect(cleanScheduleTitle("내일 오후 3시 치과")).toBe("치과");
    expect(cleanScheduleTitle("10분 뒤에 전화")).toBe("전화");
  });
});
