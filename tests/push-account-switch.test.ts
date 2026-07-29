import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const getSessionMock = vi.fn();
const getSubscriptionMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/lib/swReminders", () => ({
  registerServiceWorker: vi.fn(async () => ({
    pushManager: {
      getSubscription: getSubscriptionMock,
      subscribe: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/push/detectPushPlatform", () => ({
  detectPushPlatform: () => "mac-chrome",
  detectPlatform: () => "web",
  requiresStandalonePwaForPush: () => false,
}));

describe("push account switch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "test-vapid-public-key");
    rpcMock.mockReset();
    fromMock.mockReset();
    getSessionMock.mockReset();
    getSubscriptionMock.mockReset();
    unsubscribeMock.mockReset();

    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(globalThis, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    getSubscriptionMock.mockResolvedValue({
      toJSON: () => ({
        endpoint: "https://push.example/device-1",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      }),
      unsubscribe: unsubscribeMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers via RPC even when a browser subscription already exists", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "user-b" } } },
    });
    rpcMock.mockResolvedValue({ error: null });

    const { subscribePush } = await import("@/lib/push/pushSubscription");
    const result = await subscribePush("user-b");

    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: "https://push.example/device-1",
      p_p256dh: "p256dh-key",
      p_auth: "auth-key",
      p_platform: "mac-chrome",
    });
    expect(getSubscriptionMock).toHaveBeenCalled();
  });

  it("rejects subscribe when caller userId does not match JWT", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "user-b" } } },
    });

    const { subscribePush } = await import("@/lib/push/pushSubscription");
    const result = await subscribePush("user-a");

    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_authenticated");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("reports device registration only when endpoint matches active row", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "user-b" } } },
    });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({ data: { id: "row-1" }, error: null }),
            }),
          }),
        }),
      }),
    });

    const { isDevicePushRegisteredForCurrentUser } = await import(
      "@/lib/push/pushSubscriptionAccount"
    );
    await expect(isDevicePushRegisteredForCurrentUser()).resolves.toBe(true);
  });

  it("revokes server subscription and unsubscribes browser on sign-out", async () => {
    rpcMock.mockResolvedValue({ error: null });
    unsubscribeMock.mockResolvedValue(true);

    const { revokePushBeforeSignOut } = await import("@/lib/push/pushSignOut");
    await revokePushBeforeSignOut();

    expect(rpcMock).toHaveBeenCalledWith("revoke_push_subscription", {
      p_endpoint: "https://push.example/device-1",
    });
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});

describe("push account switch source contracts", () => {
  it("wires auth sync, RPC register, and sign-out cleanup", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const read = (path: string) =>
      readFileSync(resolve(process.cwd(), path), "utf8");

    expect(read("src/lib/push/pushSubscriptionAccount.ts")).toContain(
      "register_push_subscription",
    );
    expect(read("src/lib/push/pushSubscription.ts")).toContain(
      "ensurePushSubscriptionForCurrentUser",
    );
    expect(read("src/lib/push/pushAuthSync.ts")).toContain("SIGNED_IN");
    expect(read("src/lib/push/pushSignOut.ts")).toContain(
      "revokePushBeforeSignOut",
    );
    expect(read("src/components/SettingsSheet.tsx")).toContain(
      "signOutWithPushCleanup",
    );
    expect(read("supabase/migrations/20260729120000_push_subscription_account_switch.sql")).toContain(
      "user_id <> v_user_id",
    );
  });
});
