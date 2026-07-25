import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  trackNlArchiveCreated,
  trackNlBrainMirrorDismissed,
  trackNlBrainMirrorShown,
  trackNlIntentCorrected,
  trackNlIntentPredicted,
  trackNlManualFallbackUsed,
  trackNlParseFailed,
  trackNlPrimaryActionClicked,
  trackNlScheduleCreated,
  trackNlTaskCreated,
  trackNlThoughtSubmitted,
} from "@/lib/nlAnalytics";

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

import { track } from "@/lib/analytics";

describe("NL analytics privacy", () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
  });

  it("thought submitted sends length only", () => {
    trackNlThoughtSubmitted({
      textLength: 42,
      language: "ko",
      source: "text",
    });
    expect(track).toHaveBeenCalledWith("nl_thought_submitted", {
      text_length: 42,
      language: "ko",
      source: "text",
    });
    const payload = JSON.stringify(vi.mocked(track).mock.calls[0]);
    expect(payload).not.toMatch(/치과|passport|password/i);
  });

  it("intent predicted sends intent and tier only", () => {
    trackNlIntentPredicted("schedule_exact", "high");
    expect(track).toHaveBeenCalledWith("nl_intent_predicted", {
      intent: "schedule_exact",
      confidence_tier: "high",
    });
  });

  it("never includes thought text in any NL event", () => {
    const thought = "여권 번호 M12345678";
    trackNlThoughtSubmitted({
      textLength: thought.length,
      language: "ko",
      source: "voice",
    });
    trackNlBrainMirrorShown("archive");
    trackNlPrimaryActionClicked("archive", "archive");
    trackNlIntentCorrected("archive", "task");
    trackNlManualFallbackUsed("task", "calendar");
    trackNlBrainMirrorDismissed("archive");
    trackNlParseFailed("missing_date");
    trackNlScheduleCreated();
    trackNlTaskCreated();
    trackNlArchiveCreated();

    for (const call of vi.mocked(track).mock.calls) {
      const blob = JSON.stringify(call);
      expect(blob).not.toContain(thought);
      expect(blob).not.toContain("M12345678");
      expect(blob).not.toContain("여권 번호");
    }
  });
});

describe("NL debug mode gating", () => {
  it("is disabled in production without beta flag", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_E2E", "");
    vi.stubEnv("VITE_NL_BETA", "");
    vi.resetModules();
    const { isNlDebugEnabled } = await import("@/lib/nlDebug");
    expect(isNlDebugEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});
