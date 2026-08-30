import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { shouldShowInlinePromise } from "@/lib/promiseCard";
import {
  hasNaturalRepeatIntent,
  resolveNaturalScheduleStart,
} from "@/lib/naturalScheduleDraft";

const MORNING = new Date(2026, 7, 30, 8, 0, 0); // Sun 2026-08-30 08:00
const EVENING = new Date(2026, 7, 30, 20, 0, 0);

function expectBlocked(text: string, now = MORNING) {
  const decision = evaluateTimedAutoCommit(text, "ko", now);
  expect(decision.ok, text).toBe(false);
  return decision;
}

function expectQuiet(text: string, now = MORNING) {
  expectBlocked(text, now);
  expect(shouldShowInlinePromise(text, "ko"), text).toBe(false);
}

function expectExact(text: string, hour?: number, minute?: number, now = MORNING) {
  const decision = evaluateTimedAutoCommit(text, "ko", now);
  expect(decision.ok, text).toBe(true);
  if (!decision.ok) return;
  expect(decision.draft.options.allDay, text).toBe(false);
  if (hour !== undefined) expect(decision.draft.start.getHours(), text).toBe(hour);
  if (minute !== undefined) expect(decision.draft.start.getMinutes(), text).toBe(minute);
}

describe("NL 36-group safety contract", () => {
  it("1 date-only inputs never fabricate a clock", () => {
    for (const text of [
      "오늘 청소",
      "내일 청소",
      "모레 청소",
      "글피 청소",
      "어제 청소했어",
      "월요일 청소",
      "이번 금요일 청소",
      "다음 주 월요일 청소",
      "다다음 주 월요일 청소",
      "이번 주에 청소",
      "다음 주에 청소",
      "이번 달에 병원 가기",
      "다음 달에 치과 가기",
      "9월 3일 청소",
      "2026년 9월 3일 청소",
      "9/3 청소",
      "9월에 건강검진",
      "이번 달 말에 월세 내기",
      "다음 달 초에 병원 가기",
      "9월 중순에 여행 가기",
      "9월 말에 보험 갱신",
    ]) expectBlocked(text);
  });

  it("2 exact time-only forms can use today only when the clock is resolved", () => {
    expectBlocked("3시에 청소");
    expectExact("오전 10시에 청소", 10);
    expectExact("오후 3시에 청소", 15);
    expectBlocked("10시에 회의");
    expectBlocked("3시 반에 병원");
    expectBlocked("3시 20분에 전화");
    expectBlocked("9시에 출근");
    expectExact("18시에 운동", 18);
    for (const text of ["아침에 운동", "오전에 청소", "오후에 청소", "저녁에 운동", "밤에 약 먹기"]) {
      expectBlocked(text);
    }
  });

  it("2b time-only exact clocks that already passed must not create a past-today schedule", () => {
    for (const text of ["오전 10시에 청소", "오후 3시에 청소", "18시에 운동", "3pm meeting"]) {
      expectBlocked(text, EVENING);
    }
  });

  it("3 date plus exact time commits; daypart-only and bare clocks stay unresolved", () => {
    expectBlocked("오늘 3시에 청소");
    expectExact("오늘 오후 3시에 청소", 15);
    expectBlocked("내일 3시에 치과");
    expectExact("내일 오후 3시에 치과", 15);
    expectExact("모레 오전 10시에 회의", 10);
    expectExact("이번 금요일 오후 2시에 미팅", 14);
    expectExact("다음 주 월요일 오전 9시에 출근", 9);
    expectExact("9월 3일 오후 4시에 치과", 16);
    expectBlocked("9/3 4시 치과");
    expectExact("9월 3일 16시에 치과", 16);
    expectExact("2026년 9월 3일 오후 4시 치과", 16);
    for (const text of [
      "내일 아침에 운동",
      "내일 오전에 병원",
      "내일 오후에 청소",
      "내일 저녁에 친구 만나기",
      "내일 밤에 약 먹기",
    ]) expectBlocked(text);
  });

  it("4 computable relative offsets resolve; vague offsets stay raw", () => {
    const ten = resolveNaturalScheduleStart("10분 뒤에 세탁기 끄기", MORNING);
    expect(ten?.getTime()).toBe(MORNING.getTime() + 10 * 60_000);
    const ninety = resolveNaturalScheduleStart("90분 뒤에 전화", MORNING);
    expect(ninety?.getTime()).toBe(MORNING.getTime() + 90 * 60_000);
    expectExact("10분 뒤에 세탁기 끄기", undefined, undefined, MORNING);
    expectExact("한 시간 뒤에 약 먹기", undefined, undefined, MORNING);
    expectExact("두 시간 후에 운동하기", undefined, undefined, MORNING);
    for (const text of ["조금 있다가 전화하기", "이따가 청소", "잠시 후에 확인하기", "나중에 전화하기"]) {
      expectBlocked(text);
    }
  });

  it("5 now/immediately is not silently converted into an arbitrary schedule", () => {
    for (const text of ["지금 약 먹기", "지금 전화하기", "지금 출발", "바로 전화하기", "지금부터 운동", "지금 회의 시작"]) {
      expectBlocked(text);
    }
  });

  it("6 relative day plus daypart does not fabricate an hour", () => {
    for (const text of [
      "오늘 아침 운동",
      "오늘 오전 회의",
      "오늘 오후 청소",
      "오늘 저녁 친구 만나기",
      "오늘 밤 약 먹기",
      "내일 아침 운동",
      "내일 오전 병원",
      "내일 오후 청소",
      "내일 저녁 약속",
      "내일 밤 출발",
      "모레 아침 출근",
      "다음 주 월요일 오전 미팅",
      "이번 주말 저녁에 영화",
    ]) expectBlocked(text);
  });

  it("7 approximate/before/after qualifiers never become a false exact clock", () => {
    for (const text of [
      "3시쯤 병원",
      "오후 3시쯤 병원",
      "세 시 정도에 출발",
      "3시경 회의",
      "3시쯤 전화하기",
      "3시 전까지 제출",
      "3시 전에 출발",
      "3시 이후에 전화",
      "3시 넘어서 전화",
      "3시부터 회의",
      "3시까지 회의",
    ]) expectBlocked(text);
  });

  it("8 deadline expressions without a resolved deadline clock stay non-exact", () => {
    for (const text of [
      "오늘까지 보고서 제출",
      "내일까지 보고서 제출",
      "금요일까지 포트폴리오 수정",
      "다음 주까지 지원서 작성",
      "9월 3일까지 신청",
      "이번 달 말까지 결제",
      "퇴근 전까지 보고서 보내기",
    ]) expectBlocked(text);
    expectExact("내일 오후 5시까지 제출", 17);
  });

  it("9 only understood ranges may auto-commit; unsupported range syntax must not truncate silently", () => {
    expectBlocked("3시부터 4시까지 회의");
    expectExact("오후 3시부터 5시까지 회의", 15);
    expectExact("월요일 오전 10시부터 11시까지 회의", 10);
    expectExact("9월 3일 14시부터 16시까지 교육", 14);
    expectBlocked("2시-3시 병원");
    expectBlocked("14:00~15:30 미팅");
  });

  it("10 unsupported multi-day durations never collapse to the first date", () => {
    for (const text of [
      "3일 동안 운동",
      "일주일 동안 약 먹기",
      "월요일부터 금요일까지 출근",
      "9월 1일부터 9월 5일까지 여행",
      "오늘부터 금요일까지 휴가",
      "다음 주 내내 출장",
      "이번 주말 여행",
    ]) expectBlocked(text);
  });

  it("11 all recurrence dialects stay out of one-off auto scheduling", () => {
    const recurrence = [
      "매일 운동",
      "매일 아침 운동",
      "매일 오전 8시에 약 먹기",
      "매일 밤 10시에 약 먹기",
      "매주 월요일 운동",
      "매주 금요일 오후 3시 회의",
      "월요일마다 오후 3시 운동",
      "매주 월수금 운동",
      "화요일 목요일마다 수영",
      "이틀에 한 번 오후 3시 운동",
      "3일마다 오후 3시 약 먹기",
      "격주 월요일 오후 3시 회의",
      "2주마다 오후 3시 회의",
      "매달 1일 월세 내기",
      "매월 마지막 날 결제",
      "매년 8월 22일 생일",
    ];
    for (const text of recurrence) expectBlocked(text);
  });

  it("12 frequency words without a real recurrence rule stay raw", () => {
    for (const text of ["가끔 운동하기", "자주 물 마시기", "틈날 때 운동하기", "시간 날 때 청소하기", "생각날 때 엄마한테 전화하기"]) {
      expectBlocked(text);
    }
  });

  it("13 behavior-relative context stays raw rather than becoming a guessed clock", () => {
    for (const text of [
      "밥 먹고 청소",
      "점심 먹고 약 먹기",
      "저녁 먹고 산책",
      "운동 끝나고 샤워",
      "회의 끝나고 전화",
      "병원 갔다 와서 약 사기",
      "일 끝나고 장보기",
      "퇴근하고 운동",
      "집에 가서 빨래",
      "도착하면 전화",
      "출근 전에 약 먹기",
      "자기 전에 약 먹기",
      "밥 먹기 전에 약 먹기",
      "회의 전에 자료 보내기",
      "퇴근 전에 보고서 제출",
    ]) expectBlocked(text);
  });

  it("14-16 unsupported location/person/weather triggers remain quiet even with schedule-like words", () => {
    for (const text of [
      "회사 도착하면 전화",
      "집 도착하면 빨래",
      "병원 가면 보험 물어보기",
      "마트 가면 우유 사기",
      "강남 도착하면 연락하기",
      "집 나갈 때 택배 챙기기",
      "엄마 만나면 이것 물어보기",
      "민수 만나면 돈 주기",
      "팀장님 만나면 휴가 얘기하기",
      "의사 만나면 약 물어보기",
      "비 오면 우산 챙기기",
      "날씨 좋으면 산책하기",
      "눈 오면 차 확인하기",
      "미세먼지 괜찮으면 러닝하기",
    ]) expectQuiet(text);
  });

  it("17-19 colloquial, spacing damage and typos never invent missing date/time", () => {
    for (const text of [
      "낼 3시 병원",
      "금욜 병원",
      "담주 월욜 병원",
      "오후 세시 회의",
      "세시반 병원",
      "내일3시병원",
      "다음주 월요일3시병원",
      "3시반병원",
      "내알 병원",
      "낼 3시 뱡원",
      "오눌 3시 회의",
      "다음주 월요릴 미팅",
      "오후 세시 병웜",
    ]) expectBlocked(text);
    expectExact("오후3시회의", 15);
  });

  it("20 mixed English/Korean exact clocks work while bare Korean clocks stay ambiguous", () => {
    expectExact("내일 3pm 회의", 15);
    expectBlocked("tomorrow 3시 회의");
    expectBlocked("Monday 병원");
    expectBlocked("next Monday 병원");
    expectBlocked("9/3 meeting");
    expectExact("3pm meeting", 15);
    expectBlocked("내일 meeting");
    expectExact("Friday 2pm 회의", 14);
  });

  it("21 mixed meridiem+colon must never invert PM into 03:00", () => {
    const decision = evaluateTimedAutoCommit("오후 03:00 병원", "ko", MORNING);
    if (decision.ok) {
      expect(decision.draft.start.getHours()).toBe(15);
    }
  });

  it("22 bare 1-12 hour remains AM/PM ambiguous", () => {
    for (const text of ["내일 3시 병원", "내일 8시 운동", "오늘 7시 약속", "12시에 밥", "12시 반에 회의"]) {
      expectBlocked(text);
    }
  });

  it("23 explicit past references never roll forward or auto-create", () => {
    for (const text of [
      "어제 오후 3시 병원",
      "지난주 월요일 오후 3시 회의",
      "8월 20일 오후 3시 약 먹기",
      "2025년 9월 3일 오후 4시 치과",
    ]) expectBlocked(text);
  });

  it("24-25 undated and vague-future tasks remain records", () => {
    for (const text of [
      "청소하기",
      "빨래하기",
      "엄마한테 전화하기",
      "책 사기",
      "포트폴리오 수정",
      "병원 예약",
      "나중에 청소",
      "언젠가 여행 가기",
      "조만간 병원 가기",
      "곧 엄마한테 전화",
      "기회 되면 운동",
      "시간 되면 전화",
      "이번에 한번 병원 가야겠다",
    ]) expectBlocked(text);
  });

  it("25b vague future plus an exact-looking clock does not pin the event to today", () => {
    for (const text of ["나중에 오후 3시 청소", "언젠가 오후 3시 여행 계획", "시간 되면 오후 3시 전화"]) {
      expectBlocked(text);
    }
  });

  it("26 exact schedule keeps semantic title information", () => {
    for (const [text, words] of [
      ["내일 오후 3시 강남에서 치과", ["강남", "치과"]],
      ["내일 오후 3시 김원장님 치과", ["김원장님", "치과"]],
      ["내일 오후 3시 치과 가서 스케일링", ["치과", "스케일링"]],
      ["내일 오후 2시 회사에서 팀 미팅", ["회사", "팀 미팅"]],
    ] as const) {
      const decision = evaluateTimedAutoCommit(text, "ko", MORNING);
      expect(decision.ok, text).toBe(true);
      if (decision.ok) for (const word of words) expect(decision.draft.text).toContain(word);
    }
  });

  it("27-28 multiple times or dates do not silently choose the first one", () => {
    for (const text of [
      "내일 3시에 병원 갔다가 5시에 민수 만나기",
      "2시에 회의하고 4시에 병원",
      "월요일 병원 화요일 미팅",
      "오늘 청소하고 내일 빨래",
      "이번 주 금요일 회의 다음 주 월요일 발표",
      "9월 3일 병원, 9월 5일 미팅",
    ]) expectBlocked(text);
  });

  it("29 one resolved clock with multiple related actions stays one schedule, not verb-split", () => {
    const decision = evaluateTimedAutoCommit("내일 오후 3시에 병원하고 약국 가기", "ko", MORNING);
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.draft.text).toContain("병원");
      expect(decision.draft.text).toContain("약국");
    }
  });

  it("30 edit/cancel-like utterances never create a new schedule", () => {
    for (const text of [
      "아니 내일 말고 모레",
      "3시 말고 4시",
      "오후야",
      "오전 10시로",
      "다음 주 월요일로 바꿔줘",
      "그거 취소",
      "아까 일정 삭제",
      "병원 일정 오후 4시로 변경",
    ]) expectQuiet(text);
  });

  it("31 negation/cancellation never creates or recommends a new schedule", () => {
    for (const text of [
      "내일 병원 안 가",
      "오늘 청소 안 해",
      "금요일 회의 취소",
      "내일 운동하지 말기",
      "3시 약속 없어짐",
      "내일 오후 3시 병원 안 가",
    ]) expectQuiet(text);
  });

  it("32 schedule questions are retrieval intent, never capture intent", () => {
    for (const text of [
      "내일 일정 뭐지?",
      "내일 병원 몇 시였지?",
      "금요일에 뭐 있었지?",
      "3시에 뭐 하지?",
      "다음 주 일정 보여줘",
      "내일 오후 3시에 뭐 하지?",
    ]) expectQuiet(text);
  });

  it("33 tentative/possible plans never become confident schedules", () => {
    for (const text of [
      "내일 병원 갈까",
      "내일 운동할까",
      "주말에 여행 갈지도",
      "다음 주에 병원 갈 것 같아",
      "오후에 운동할 수도 있음",
      "금요일쯤 미팅 잡을 듯",
      "내일 오후 3시 운동할 수도 있음",
    ]) expectQuiet(text);
  });

  it("34-35 strongly committed/memory-style exact plans may schedule when time is truly resolved", () => {
    expectExact("내일 오후 3시 병원 예약", 15);
    expectExact("내일 오후 3시에 만나기로 했어", 15);
    expectExact("아 맞다 내일 오후 3시 병원", 15);
    expectExact("엄마 병원 내일 오전 10시였음", 10);
  });

  it("36 long exact natural language preserves the non-time meaning", () => {
    const decision = evaluateTimedAutoCommit(
      "아 맞다 내일 오후 3시에 강남 치과 가서 스케일링 받아야 함",
      "ko",
      MORNING,
    );
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.draft.text).toContain("강남 치과");
      expect(decision.draft.text).toContain("스케일링");
      expect(decision.draft.start.getHours()).toBe(15);
    }
  });

  it("broad periods with an exact clock do not invent an arbitrary calendar day", () => {
    for (const text of [
      "이번 주 오후 3시에 청소",
      "다음 주 오후 3시에 청소",
      "이번 달 오후 3시에 병원",
      "다음 달 오후 3시에 치과",
      "9월 중순 오후 3시에 여행 준비",
      "9월 말 오후 3시에 보험 갱신",
      "다다음 주 오후 3시에 청소",
    ]) expectBlocked(text);
  });

  it("recurrence detector recognizes non-매주 dialects that must not collapse to one-off", () => {
    for (const text of [
      "월요일마다 오후 3시 운동",
      "3일마다 오후 3시 약 먹기",
      "격주 월요일 오후 3시 회의",
      "2주마다 오후 3시 회의",
    ]) {
      expect(hasNaturalRepeatIntent(text), text).toBe(true);
    }
  });
});
