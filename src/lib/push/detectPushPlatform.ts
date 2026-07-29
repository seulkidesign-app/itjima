/** Granular push subscription platform label for device-level diagnostics. */

export type PushPlatformLabel =
  | "ios-pwa"
  | "ios-safari"
  | "ipad-pwa"
  | "ipad-safari"
  | "mac-safari"
  | "mac-chrome"
  | "mac-firefox"
  | "mac-edge"
  | "windows-edge"
  | "windows-chrome"
  | "windows-firefox"
  | "android-chrome"
  | "android-samsung"
  | "android-firefox"
  | "linux-chrome"
  | "linux-firefox"
  | "web-unknown";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

function browserToken(ua: string): string {
  if (/Edg\//i.test(ua)) return "edge";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/CriOS/i.test(ua)) return "chrome";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "chrome";
  if (/Firefox/i.test(ua)) return "firefox";
  if (/Safari/i.test(ua)) return "safari";
  return "unknown";
}

function osToken(ua: string, platform: string): string {
  if (/iPhone|iPod/i.test(ua)) return "ios";
  if (/iPad/i.test(ua)) return "ipad";
  if (/Android/i.test(ua)) return "android";
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) return "mac";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return "linux";
  return "web";
}

/** Human-readable platform slug stored on push_subscriptions.platform */
export function detectPushPlatform(): PushPlatformLabel {
  if (typeof navigator === "undefined") return "web-unknown";

  const ua = navigator.userAgent;
  const platform = navigator.platform || "";
  const os = osToken(ua, platform);
  const browser = browserToken(ua);
  const standalone = isStandalonePwa();

  if (os === "ios") {
    return standalone ? "ios-pwa" : "ios-safari";
  }
  if (os === "ipad") {
    return standalone ? "ipad-pwa" : "ipad-safari";
  }
  if (os === "mac") {
    if (browser === "safari") return "mac-safari";
    if (browser === "chrome") return "mac-chrome";
    if (browser === "firefox") return "mac-firefox";
    if (browser === "edge") return "mac-edge";
    return "mac-safari";
  }
  if (os === "windows") {
    if (browser === "edge") return "windows-edge";
    if (browser === "chrome") return "windows-chrome";
    if (browser === "firefox") return "windows-firefox";
    return "windows-chrome";
  }
  if (os === "android") {
    if (browser === "samsung") return "android-samsung";
    if (browser === "firefox") return "android-firefox";
    return "android-chrome";
  }
  if (os === "linux") {
    if (browser === "firefox") return "linux-firefox";
    return "linux-chrome";
  }
  return "web-unknown";
}

/** iOS/iPadOS require Home Screen PWA for Web Push. */
export function requiresStandalonePwaForPush(): boolean {
  const platform = detectPushPlatform();
  return platform === "ios-pwa" || platform === "ios-safari" ||
    platform === "ipad-pwa" || platform === "ipad-safari";
}

/** @deprecated Use detectPushPlatform — kept for callers expecting ios/android/web. */
export function detectPlatform(): "ios" | "android" | "web" {
  const label = detectPushPlatform();
  if (label.startsWith("ios") || label.startsWith("ipad")) return "ios";
  if (label.startsWith("android")) return "android";
  return "web";
}
