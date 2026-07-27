import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const exchangeCodeForSession = vi.fn();
const onAuthStateChange = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession,
      exchangeCodeForSession,
      onAuthStateChange,
    },
  },
}));

describe("completeAuthCallback", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    exchangeCodeForSession.mockReset();
    onAuthStateChange.mockReset();
    sessionStorage.clear();

    window.history.replaceState({}, "", "/auth/callback?code=test-code");

    onAuthStateChange.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dedupes concurrent callback handling (StrictMode-safe)", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });

    exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });

    onAuthStateChange.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    });

    const { completeAuthCallback } = await import("@/lib/oauth");

    const first = completeAuthCallback("en");
    const second = completeAuthCallback("en");

    expect(first).toBe(second);

    const [resultA, resultB] = await Promise.all([first, second]);
    expect(resultA.ok).toBe(true);
    expect(resultB).toEqual(resultA);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("treats a handled code as success when session already exists", async () => {
    sessionStorage.setItem("itjima.oauth.handledCode", "test-code");
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    const { completeAuthCallback } = await import("@/lib/oauth");
    const result = await completeAuthCallback("en");

    expect(result.ok).toBe(true);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("returns existing session without re-exchanging the code", async () => {
    window.history.replaceState({}, "", "/auth/callback");
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    const { completeAuthCallback } = await import("@/lib/oauth");
    const result = await completeAuthCallback("en");

    expect(result.ok).toBe(true);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
