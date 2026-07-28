import { describe, expect, it } from "vitest";
import { describePushFailure } from "@/lib/push/pushDiagnostics";

describe("push failure messages", () => {
  it("explains missing VAPID configuration", () => {
    expect(
      describePushFailure({ state: "unsupported", code: "missing_vapid" }, "ko"),
    ).toContain("VITE_VAPID_PUBLIC_KEY");
  });

  it("explains PostgREST schema cache misses", () => {
    expect(
      describePushFailure({ state: "expired", code: "schema_cache" }, "en"),
    ).toContain("PostgREST");
  });
});
