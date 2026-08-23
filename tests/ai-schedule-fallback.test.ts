import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isFaithfulScheduleNormalization,
  parseAiSchedulePayload,
  shouldTryAiScheduleFallback,
  tryAiScheduleFallback,
} from "@/lib/aiScheduleFallback";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";

describe("AI schedule normalization fallback", () => {
  const now = new Date("2026-08-23T10:00:00+09:00");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks unknown date shorthand before a recognized clock can become today", () => {
    const decision = evaluateTimedAutoCommit(
      "담주 금욜 저녁 7시 치과",
      "ko",
      now,
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toBe("unresolved_date_language");
    }
  });

  it("only escalates a timed input whose date language the local parser could not resolve", () => {
    expect(
      shouldTryAiScheduleFallback(
        "담주 금욜 저녁 7시 치과",
        "unresolved_date_language",
      ),
    ).toBe(true);
    expect(
      shouldTryAiScheduleFallback("내일 오후 3시 치과", "clarify_intent"),
    ).toBe(false);
    expect(shouldTryAiScheduleFallback("에어팟 소독", "no_clock")).toBe(false);
  });

  it("never asks the model to infer AM/PM for a bare 1-12 clock", () => {
    expect(
      shouldTryAiScheduleFallback(
        "담주 금욜 7시 치과",
        "unresolved_date_language",
      ),
    ).toBe(false);
    expect(
      shouldTryAiScheduleFallback(
        "담주 금욜 저녁 7시 치과",
        "unresolved_date_language",
      ),
    ).toBe(true);
  });

  it("accepts only the small structured response contract", () => {
    expect(
      parseAiSchedulePayload({
        decision: "normalized",
        normalizedText: "다음 주 금요일 오후 7시 치과",
        confidence: "high",
        ambiguity: "",
      }),
    ).toEqual({
      decision: "normalized",
      normalizedText: "다음 주 금요일 오후 7시 치과",
      confidence: "high",
      ambiguity: "",
    });

    expect(
      parseAiSchedulePayload({
        decision: "normalized",
        normalizedText: "다음 주 금요일 오후 7시 치과",
        confidence: "medium",
      }),
    ).toBeNull();
  });

  it("rejects model rewrites that add scheduling facts", () => {
    expect(
      isFaithfulScheduleNormalization(
        "담주 금욜 7시 치과",
        "다음 주 금요일 오후 7시 치과",
      ),
    ).toBe(false);
    expect(
      isFaithfulScheduleNormalization(
        "담주 금욜 7시 치과",
        "다음 주 금요일 19:00 치과",
      ),
    ).toBe(false);
    expect(
      isFaithfulScheduleNormalization(
        "담주 금욜 저녁 7시 치과",
        "다음 주 금요일 오후 7시 치과 1시간 전 알려줘",
      ),
    ).toBe(false);
    expect(
      isFaithfulScheduleNormalization(
        "담주 금욜 저녁 7시 치과",
        "다음 주 금요일 오후 7시 치과",
      ),
    ).toBe(true);
  });

  it("lets the model normalize shorthand but requires the local gate to approve it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            decision: "normalized",
            normalizedText: "다음 주 금요일 오후 7시 치과",
            confidence: "high",
            ambiguity: "",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await tryAiScheduleFallback(
      "담주 금욜 저녁 7시 치과",
      "ko",
      now,
    );
    expect(result.status).toBe("safe");
    if (result.status === "safe") {
      expect(result.normalizedText).toBe("다음 주 금요일 오후 7시 치과");
      expect(result.draft.text).toBe("치과");
      expect(result.draft.start.getDay()).toBe(5);
      expect(result.draft.start.getHours()).toBe(19);
    }
  });

  it("fails closed when the model adds an unsupported fact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            decision: "normalized",
            normalizedText: "다음 주 금요일 오후 7시 치과 1시간 전 알려줘",
            confidence: "high",
            ambiguity: "",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await tryAiScheduleFallback(
      "담주 금욜 저녁 7시 치과",
      "ko",
      now,
    );
    expect(result).toMatchObject({
      status: "not_safe",
      reason: "unfaithful_normalization",
    });
  });

  it("fails closed when the API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("disabled", { status: 404 })),
    );

    await expect(
      tryAiScheduleFallback("담주 금욜 저녁 7시 치과", "ko", now),
    ).resolves.toEqual({ status: "unavailable" });
  });
});
