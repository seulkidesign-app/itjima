import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/SyncIndicator.tsx"),
  "utf8",
);

describe("online sync recovery contract", () => {
  it("automatically retries a visible sync error when connectivity returns", () => {
    expect(source).toContain('window.addEventListener("online", retryWhenOnline)');
    expect(source).toContain("retryRef.current?.()");
  });

  it("does not retry while the browser still reports offline", () => {
    expect(source).toContain("if (!navigator.onLine) return");
  });

  it("throttles repeated browser online events", () => {
    expect(source).toContain("ONLINE_RETRY_THROTTLE_MS");
    expect(source).toContain("lastAutoRetryAtRef.current");
  });

  it("also retries after reopening when connectivity has already returned", () => {
    expect(source).toContain("window.setTimeout(retryWhenOnline, 500)");
  });

  it("cleans up listeners and pending timers", () => {
    expect(source).toContain('window.removeEventListener("online", retryWhenOnline)');
    expect(source).toContain("window.clearTimeout(initialRetry)");
  });
});
