import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("service worker update safety", () => {
  const worker = source("public/sw.js");
  const registration = source("src/lib/swReminders.ts");
  const vercel = JSON.parse(source("vercel.json")) as {
    headers?: Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
  };

  it("uses a new shell cache and removes previous cache versions", () => {
    expect(worker).toContain('const CACHE = "itjima-shell-v2"');
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
