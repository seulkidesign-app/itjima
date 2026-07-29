import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  detectPlatform,
  detectPushPlatform,
  requiresStandalonePwaForPush,
} from "@/lib/push/detectPushPlatform";

function mockNavigator(options: {
  ua: string;
  platform?: string;
  standalone?: boolean;
  displayMode?: string;
}) {
  vi.stubGlobal("navigator", {
    userAgent: options.ua,
    platform: options.platform ?? "",
    standalone: options.standalone,
  });
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches:
        query.includes("standalone") &&
        (options.displayMode === "standalone" || options.standalone === true),
    }),
  });
}

describe("detectPushPlatform", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis.window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("labels iOS Home Screen PWA", () => {
    mockNavigator({
      ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      standalone: true,
    });
    expect(detectPushPlatform()).toBe("ios-pwa");
    expect(requiresStandalonePwaForPush()).toBe(true);
  });

  it("labels Windows Edge", () => {
    mockNavigator({
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      platform: "Win32",
    });
    expect(detectPushPlatform()).toBe("windows-edge");
    expect(requiresStandalonePwaForPush()).toBe(false);
  });

  it("labels Android Chrome", () => {
    mockNavigator({
      ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
    });
    expect(detectPushPlatform()).toBe("android-chrome");
  });

  it("keeps legacy detectPlatform buckets", () => {
    mockNavigator({
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      platform: "MacIntel",
    });
    expect(detectPushPlatform()).toBe("mac-chrome");
    expect(detectPlatform()).toBe("web");
  });
});
