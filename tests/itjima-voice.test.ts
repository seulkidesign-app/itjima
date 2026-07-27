import { describe, expect, it } from "vitest";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import { warmMirrorLine, warmResultHint } from "@/lib/warmMirrorCopy";
import { primaryActionForIntent } from "@/lib/nlMirrorCopy";
import { deckCompletionTitle } from "@/lib/deckCompletionCopy";
import { appendFinalSpeech } from "@/lib/speechInput";

describe("Itjima voice — clarity", () => {
  it("uses literal primary action labels", () => {
    expect(primaryActionForIntent("schedule_exact", "ko")).toBe("일정에 추가");
    expect(primaryActionForIntent("task", "ko")).toBe("할 일로 넣기");
    expect(primaryActionForIntent("archive", "ko")).toBe("보관함에 맡기기");
  });

  it("uses warm but non-action interpretation for dentist", () => {
    const nl = understandNaturalLanguage("내일 3시 치과", "ko");
    const line = warmMirrorLine("내일 3시 치과", nl, "ko");
    expect(line).toContain("치과");
    expect(line).not.toContain("맡기");
    expect(line).not.toContain("추가");
  });

  it("uses literal result hints in Korean", () => {
    const nl = understandNaturalLanguage("내일 3시 치과", "ko");
    expect(warmResultHint(nl, "ko")).toMatch(/일정에 추가할게요/);
    const task = understandNaturalLanguage("여권 갱신하기", "ko");
    expect(warmResultHint(task, "ko")).toBe("날짜 없이 할 일에 둘게요.");
  });

  it("does not use ambiguous poetic phrases in result hints", () => {
    const intents = [
      understandNaturalLanguage("내일 3시 치과", "ko"),
      understandNaturalLanguage("장볼 것", "ko"),
      understandNaturalLanguage("비밀번호", "ko"),
    ];
    for (const nl of intents) {
      const hint = warmResultHint(nl, "ko");
      expect(hint).not.toMatch(/맡겨|쉬게|편해|되돌릴게요/);
    }
  });

  it("keeps emotional copy in completion layer only", () => {
    const title = deckCompletionTitle({ today: 1, archive: 0, later: 0 }, "ko");
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toContain("맡기");
  });

  it("interprets phone call thoughts consistently", () => {
    const nl = understandNaturalLanguage("엄마한테 전화", "ko");
    const line = warmMirrorLine("엄마한테 전화", nl, "ko");
    expect(line).toContain("전화");
  });

  it("does not append the same final transcript twice", () => {
    expect(appendFinalSpeech("내일 치과", "내일 치과")).toBe("내일 치과");
    expect(appendFinalSpeech("내일 치과", "내일 치과.")).toBe("내일 치과");
    expect(appendFinalSpeech("내일 치과", "내일  치과")).toBe("내일 치과");
  });

  it("replaces a shorter final transcript with the cumulative phrase", () => {
    expect(appendFinalSpeech("내일", "내일 치과 가기")).toBe("내일 치과 가기");
  });

  it("suppresses repeated trailing speech fragments", () => {
    expect(appendFinalSpeech("내일 치과", "치과")).toBe("내일 치과");
  });

  it("keeps genuinely new consecutive speech", () => {
    expect(appendFinalSpeech("내일 치과", "오후 세 시")).toBe(
      "내일 치과 오후 세 시",
    );
  });
});
