import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/nl-ko-regression.json";
import {
  isSensitiveContent,
  shouldShowNlPrompt,
  understandNaturalLanguage,
} from "@/lib/nlSchedule";
import { buildMirrorDisplay, primaryActionForIntent } from "@/lib/nlMirrorCopy";
import { buildPromiseCard } from "@/lib/promiseCard";

type Fixture = {
  input: string;
  expected_intent: string;
  expected_confidence_tier: string;
  expected_date_presence: boolean;
  expected_time_presence: boolean;
  sensitive: boolean;
  notes: string;
};

const EXPLICIT_ACTIONS = [
  "일정에 추가",
  "할 일로 넣기",
  "보관함에 맡기기",
  "날짜 추가",
  "날짜 고르기",
  "그대로 두기",
];

const VAGUE_ACTIONS = ["맞아요", "확인", "완료", "저장"];

describe("KO NL regression fixture", () => {
  const cases = fixtures as Fixture[];

  it(`has at least 60 examples (${cases.length})`, () => {
    expect(cases.length).toBeGreaterThanOrEqual(60);
  });

  it.each(cases.map((c) => [c.input, c] as const))(
    "routes %s",
    (input, fx) => {
      const nl = understandNaturalLanguage(input, "ko");
      expect(nl.intent, fx.notes).toBe(fx.expected_intent);
      expect(nl.confidence, fx.notes).toBe(fx.expected_confidence_tier);
      expect(!!nl.detectedDate, fx.notes).toBe(fx.expected_date_presence);
      expect(nl.hasExplicitTime, fx.notes).toBe(fx.expected_time_presence);
      expect(isSensitiveContent(input), fx.notes).toBe(fx.sensitive);
    },
  );
});

describe("plain notes avoid false schedule positives", () => {
  const journalCases = [
    "오늘 날씨 좋았다",
    "커피 한 잔 마셨다",
    "오늘이 정말 좋은 하루였다",
    "3개 사과 5개 배 샀다",
    "오늘 하루 정리",
  ];

  it.each(journalCases)("no mirror for %s", (input) => {
    expect(shouldShowNlPrompt(input, "ko")).toBe(false);
  });
});

describe("Brain Mirror copy uses explicit actions", () => {
  const samples = [
    "내일 3시에 치과",
    "다음주쯤 보기",
    "엄마한테 전화하기",
    "여권 번호",
  ];

  it.each(samples)("primary label for %s", (input) => {
    const nl = understandNaturalLanguage(input, "ko");
    const card = buildPromiseCard(input, "ko");
    const primary = primaryActionForIntent(nl.intent, "ko");

    expect(VAGUE_ACTIONS.some((v) => card.primaryActionLabel.includes(v))).toBe(
      false,
    );
    expect(VAGUE_ACTIONS.some((v) => primary.includes(v))).toBe(false);

    if (nl.intent !== "schedule_clarify") {
      expect(EXPLICIT_ACTIONS.some((a) => card.primaryActionLabel.includes(a))).toBe(
        true,
      );
    }
  });

  it("mirror display shows title and result hint", () => {
    const input = "내일 3시에 치과";
    const nl = understandNaturalLanguage(input, "ko");
    const mirror = buildMirrorDisplay(input, nl, "ko");

    expect(mirror.title.length).toBeGreaterThan(0);
    expect(mirror.when).toBeTruthy();
    expect(mirror.resultHint).toContain("일정");
  });
});
