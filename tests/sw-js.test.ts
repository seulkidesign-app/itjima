import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TS_SYNTAX = [
  /\bdeclare\s+/,
  /ServiceWorkerGlobalScope/,
  /\bas\s+[A-Za-z<]/,
  /\/\/\/\s*<reference/,
  /\?\s*:\s*string/,
  /\|\s*undefined\s*[;}\)]/,
  /\blet\s+\w+\s*:\s*\{/,
  /\bconst\s+\w+\s*:\s*\{/,
];

function assertPlainJavaScript(label: string, source: string) {
  for (const pattern of TS_SYNTAX) {
    expect(source, `${label} must not match ${pattern}`).not.toMatch(pattern);
  }
  expect(() => new Function(source), `${label} must parse as JS`).not.toThrow();
}

describe("service worker (public/sw.js)", () => {
  const publicSw = readFileSync(
    resolve(import.meta.dirname, "../public/sw.js"),
    "utf8",
  );

  it("contains no TypeScript-only syntax", () => {
    assertPlainJavaScript("public/sw.js", publicSw);
  });

  it("registers install, activate, fetch, push, and notificationclick", () => {
    expect(publicSw).toContain('addEventListener("install"');
    expect(publicSw).toContain('addEventListener("activate"');
    expect(publicSw).toContain('addEventListener("fetch"');
    expect(publicSw).toContain('addEventListener("push"');
    expect(publicSw).toContain('addEventListener("notificationclick"');
  });

  it("shows notifications with PNG icons and fallback handling", () => {
    expect(publicSw).toContain("event.waitUntil(showPushNotification");
    expect(publicSw).toContain("self.registration.showNotification");
    expect(publicSw).toContain('icon: NOTIFICATION_ICON');
    expect(publicSw).toContain('"/icons/itjima-512-v3.png"');
    expect(publicSw).toContain('"/icons/badge-72.png"');
    expect(publicSw).toContain("showNotification:fallback_ok");
    expect(publicSw).toContain("sanitizePushLogMessage");
    expect(publicSw).not.toContain("itjima-push-fallback");
    expect(publicSw).toContain("[itjima:sw:push]");
  });
});

describe("service worker (dist/sw.js after build)", () => {
  const distSwPath = resolve(import.meta.dirname, "../dist/sw.js");

  it("exists after vite build and is plain JavaScript", () => {
    if (!existsSync(distSwPath)) {
      return;
    }
    const distSw = readFileSync(distSwPath, "utf8");
    assertPlainJavaScript("dist/sw.js", distSw);
    expect(distSw).toBe(
      readFileSync(resolve(import.meta.dirname, "../public/sw.js"), "utf8"),
    );
  });
});
