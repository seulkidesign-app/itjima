import { describe, expect, it } from "vitest";
import { appendFinalSpeech, normalizeSpeechSegment } from "@/lib/speechInput";

describe("voice input deduplication", () => {
  it("normalizes whitespace", () => {
    expect(normalizeSpeechSegment("  hello   world  ")).toBe("hello world");
  });

  it("does not append duplicate final segment", () => {
    expect(appendFinalSpeech("내일 3시 치과", "내일 3시 치과")).toBe(
      "내일 3시 치과",
    );
  });

  it("does not append when prev ends with segment", () => {
    expect(appendFinalSpeech("내일 3시에 치과", "치과")).toBe(
      "내일 3시에 치과",
    );
  });

  it("replaces when final extends partial", () => {
    expect(appendFinalSpeech("내일", "내일 3시에 치과")).toBe(
      "내일 3시에 치과",
    );
  });

  it("appends distinct segments", () => {
    expect(appendFinalSpeech("안녕", "하세요")).toBe("안녕 하세요");
  });
});

describe("capture idempotency guards", () => {
  it("empty segment does not change text", () => {
    expect(appendFinalSpeech("existing", "   ")).toBe("existing");
  });
});
