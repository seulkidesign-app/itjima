import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractBuildFingerprint } from "@/lib/swReminders";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("service worker update safety", () => {
  const worker = source("public/sw.js");
  const registration = source("src/lib/swReminders.ts");
  const updateNotice = source("src/components/AppUpdateNotice.tsx");
  const appEntry = source("src/main.tsx");
  const vercel = JSON.parse(source("vercel.json")) as {
    headers?: Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
  };

  it("uses a new shell cache and removes previous cache versions", () => {
    expect(worker).toContain('const CACHE = "itjima-shell-v3"');
    expect(worker).toContain("keys.filter((key) => key !== CACHE)");
  });

  it("does not force an update during installation", () => {
    const installBlock = worker.slice(
      worker.indexOf('self.addEventListener("install"'),
      worker.indexOf('self.addEventListener("activate"'),
    );
    expect(installBlock).not.toContain("skipWaiting");
    expect(worker).toContain('event.data?.type === "SKIP_WAITING"');
  });

  it("keeps navigation fresh and never caches same-origin API responses", () => {
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('cache: "no-store"');
    expect(worker).toContain('caches.match("/index.html")');
  });

  it("asks the browser to bypass HTTP cache when checking the worker", () => {
    expect(registration).toContain('updateViaCache: "none"');
    expect(registration).toContain("APP_UPDATE_READY_EVENT");
    expect(registration).toContain('waiting.postMessage({ type: "SKIP_WAITING" })');
  });

  it("does not lose an update event that fires before React mounts", () => {
    expect(registration).toContain("pendingUpdateStrategy = strategy");
    expect(registration).toContain("getPendingAppUpdateStrategy");
    expect(registration).toContain("clearPendingAppUpdateStrategy");
    expect(updateNotice).toContain("getPendingAppUpdateStrategy()");
    expect(appEntry).toContain("<AppUpdateNotice />");
  });

  it("lets the user activate a waiting version instead of forcing a mid-session reload", () => {
    expect(updateNotice).toContain("APP_UPDATE_READY_EVENT");
    expect(updateNotice).toContain("activateWaitingServiceWorker");
    expect(updateNotice).toContain("window.location.reload()");
    expect(updateNotice).toContain("새 버전이 준비됐어요.");
  });

  it("detects regular web deploys when the service worker file is unchanged", () => {
    expect(registration).toContain("__itjima_update_check");
    expect(registration).toContain('cache: "no-store"');
    expect(registration).toContain('emitUpdateReady("reload")');

    const oldBuild = extractBuildFingerprint(`
      <!doctype html>
      <link rel="stylesheet" href="/assets/app-old.css" />
      <script type="module" src="/assets/app-old.js"></script>
    `);
    const newBuild = extractBuildFingerprint(`
      <!doctype html>
      <link rel="stylesheet" href="/assets/app-new.css" />
      <script type="module" src="/assets/app-new.js"></script>
    `);

    expect(oldBuild).toBe("/assets/app-old.css|/assets/app-old.js");
    expect(newBuild).toBe("/assets/app-new.css|/assets/app-new.js");
    expect(newBuild).not.toBe(oldBuild);
  });

  it("serves the worker with revalidation headers", () => {
    const swRule = vercel.headers?.find((rule) => rule.source === "/sw.js");
    const cacheControl = swRule?.headers.find(
      (header) => header.key === "Cache-Control",
    );
    expect(cacheControl?.value).toContain("no-store");
    expect(
      swRule?.headers.some(
        (header) =>
          header.key === "Service-Worker-Allowed" && header.value === "/",
      ),
    ).toBe(true);
  });
});
