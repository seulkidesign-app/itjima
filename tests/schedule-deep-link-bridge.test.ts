import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bridgeSource = readFileSync(
  resolve(process.cwd(), "src/components/ScheduleDeepLinkBridge.tsx"),
  "utf8",
);
const rootSource = readFileSync(
  resolve(process.cwd(), "src/routes/__root.tsx"),
  "utf8",
);

describe("schedule reminder deep-link bridge", () => {
  it("is mounted once at the app root", () => {
    expect(rootSource).toContain("<ScheduleDeepLinkBridge />");
  });

  it("reads the reminder target from the open query parameter", () => {
    expect(bridgeSource).toContain('get("open")');
    expect(bridgeSource).toContain('pathname !== "/schedule"');
  });

  it("checks both signed-in and guest schedule buckets", () => {
    expect(bridgeSource).toContain('itjima.${userId ?? "guest"}.schedules');
    expect(bridgeSource).toContain('keys.push("itjima.guest.schedules")');
  });

  it("refreshes when the schedule store changes", () => {
    expect(bridgeSource).toContain('window.addEventListener("itjima:update"');
    expect(bridgeSource).toContain('key.endsWith(".schedules")');
  });

  it("opens a modal detail sheet and removes the consumed parameter", () => {
    expect(bridgeSource).toContain("<BottomSheet");
    expect(bridgeSource).toContain('url.searchParams.delete("open")');
    expect(bridgeSource).toContain("window.history.replaceState");
  });

  it("matches legacy source_id projections as well as same-id rows", () => {
    expect(bridgeSource).toContain("row.source_id === id");
  });

  it("fails safely when the target never appears", () => {
    expect(bridgeSource).toContain("MISSING_TARGET_TIMEOUT_MS");
    expect(bridgeSource).toContain("setTargetId(null)");
  });
});
