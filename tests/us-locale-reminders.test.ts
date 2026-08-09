import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  languageFromSearch,
  resolveInitialLanguage,
} from "@/lib/i18n";
import {
  formatReminderTime,
  reminderBody,
  reminderLanguageForText,
  safeReminderTimeZone,
} from "../supabase/functions/_shared/reminderCopy";

describe("app locale defaults", () => {
  it("starts first-time visitors in Korean", () => {
    expect(DEFAULT_LANGUAGE).toBe("ko");
    expect(resolveInitialLanguage("", null)).toBe("ko");
    expect(resolveInitialLanguage("", undefined)).toBe("ko");
  });

  it("keeps a language the user selected previously", () => {
    expect(resolveInitialLanguage("", "en")).toBe("en");
    expect(resolveInitialLanguage("", "ko")).toBe("ko");
  });

  it("lets an explicit URL override both the default and stored language", () => {
    expect(languageFromSearch("?lang=en")).toBe("en");
    expect(languageFromSearch("?source=search&lang=ko")).toBe("ko");
    expect(languageFromSearch("?lang=fr")).toBeNull();
    expect(resolveInitialLanguage("?lang=en", "ko")).toBe("en");
    expect(resolveInitialLanguage("?lang=ko", "en")).toBe("ko");
  });
});

describe("timezone-safe server reminder copy", () => {
  const iso = "2026-07-31T19:00:00.000Z";

  it("formats an English reminder in New York local time", () => {
    expect(formatReminderTime(iso, "America/New_York", "en")).toBe("3:00 PM");
    expect(
      reminderBody({
        startIso: iso,
        timeZone: "America/New_York",
        language: "en",
        allDay: false,
      }),
    ).toBe("Starts at 3:00 PM.");
  });

  it("falls back to UTC instead of Seoul for an invalid timezone", () => {
    expect(safeReminderTimeZone("Not/A_Timezone")).toBe("UTC");
    expect(formatReminderTime(iso, "Not/A_Timezone", "en")).toBe("7:00 PM");
  });

  it("uses the schedule language without forcing Korean", () => {
    expect(reminderLanguageForText("Dentist tomorrow at 3 PM")).toBe("en");
    expect(reminderLanguageForText("내일 오후 3시 치과")).toBe("ko");
    expect(reminderLanguageForText(null)).toBe("en");
  });

  it("localizes all-day copy", () => {
    expect(
      reminderBody({
        startIso: iso,
        timeZone: "America/Los_Angeles",
        language: "en",
        allDay: true,
      }),
    ).toBe("Scheduled for today.");
    expect(
      reminderBody({
        startIso: iso,
        timeZone: "Asia/Seoul",
        language: "ko",
        allDay: true,
      }),
    ).toBe("예정된 일정이에요.");
  });
});
