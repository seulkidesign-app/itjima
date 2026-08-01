import { describe, expect, it } from "vitest";
import { shouldResyncForTimezoneChange } from "@/hooks/useTimezoneChangeSync";

describe("timezone change reminder safety", () => {
  it("does not resync on the first recorded timezone", () => {
    expect(shouldResyncForTimezoneChange(null, "America/New_York")).toBe(false);
  });

  it("does not resync when the IANA timezone is unchanged", () => {
    expect(
      shouldResyncForTimezoneChange(
        "America/New_York",
        "America/New_York",
      ),
    ).toBe(false);
  });

  it("resyncs reminders after travel to a different timezone", () => {
    expect(
      shouldResyncForTimezoneChange(
        "Asia/Seoul",
        "America/Los_Angeles",
      ),
    ).toBe(true);
  });
});
