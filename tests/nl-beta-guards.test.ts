import { describe, expect, it, vi, beforeEach } from "vitest";
import { withNlConfirmGuard } from "@/lib/nlConfirmGuard";
import {
  loadAcknowledgedIds,
  pruneAcknowledgedIds,
  saveAcknowledgedIds,
} from "@/lib/nlAckStorage";
import { appendFinalSpeech } from "@/lib/speechInput";
import { isNlDebugEnabled, resetNlDebugCache } from "@/lib/nlDebug";
import {
  trackNlIntentPredicted,
  trackNlThoughtSubmitted,
} from "@/lib/nlAnalytics";
import { track } from "@/lib/analytics";

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

describe("nlConfirmGuard", () => {
  it("prevents duplicate commits for the same item", async () => {
    let count = 0;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 20));
      count += 1;
    };
    const first = withNlConfirmGuard("item-1", run);
    const second = withNlConfirmGuard("item-1", run);
    await Promise.all([first, second]);
    expect(count).toBe(1);
  });
});

describe("nlAckStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists and prunes acknowledged ids", () => {
    const ids = new Set(["a", "b", "gone"]);
    saveAcknowledgedIds("guest", ids);
    expect(loadAcknowledgedIds("guest")).toEqual(new Set(["a", "b", "gone"]));
    const pruned = pruneAcknowledgedIds(ids, new Set(["a", "b"]));
    expect(pruned).toEqual(new Set(["a", "b"]));
  });
});

describe("appendFinalSpeech", () => {
  it("dedupes duplicate final transcripts", () => {
    expect(appendFinalSpeech("hello", "hello")).toBe("hello");
    expect(appendFinalSpeech("hello", "hello world")).toBe("hello world");
    expect(appendFinalSpeech("hello world", "world")).toBe("hello world");
  });
});

describe("isNlDebugEnabled", () => {
  beforeEach(() => {
    localStorage.clear();
    resetNlDebugCache();
  });

  it("is hidden by default", () => {
    window.history.pushState({}, "", "/");
    expect(isNlDebugEnabled()).toBe(false);
  });

  it("enables with query param", () => {
    window.history.pushState({}, "", "/?nlDebug=1");
    expect(isNlDebugEnabled()).toBe(true);
  });
});

describe("nlAnalytics privacy", () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
  });

  it("never sends thought text", () => {
    const secret = "여권 번호 ABCD-1234";
    trackNlThoughtSubmitted({
      textLength: secret.length,
      language: "ko",
      source: "text",
    });
    trackNlIntentPredicted("archive", "high");
    const serialized = JSON.stringify(vi.mocked(track).mock.calls);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("여권");
    expect(serialized).toContain("nl_thought_submitted");
  });
});
