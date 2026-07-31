import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLocalItjimaData,
  collectLocalItjimaData,
  dataExportFilename,
} from "@/lib/dataRights";

describe("data rights", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports only Itjima-owned local data and excludes auth or E2E state", () => {
    localStorage.setItem(
      "itjima.guest.inbox",
      JSON.stringify([{ id: "one", text: "Call Mom" }]),
    );
    localStorage.setItem("itjima.language", "en");
    localStorage.setItem("itjima.__e2e_user_id__", "test-user");
    localStorage.setItem("sb-project-auth-token", "secret-session");
    localStorage.setItem("unrelated", "leave-me-alone");

    expect(collectLocalItjimaData()).toEqual({
      "itjima.guest.inbox": [{ id: "one", text: "Call Mom" }],
      "itjima.language": "en",
    });
  });

  it("clears Itjima local data without deleting unrelated browser storage", () => {
    localStorage.setItem("itjima.guest.inbox", "[]");
    localStorage.setItem("itjima.usageCount", "3");
    localStorage.setItem("unrelated", "keep");

    const removed = clearLocalItjimaData();

    expect(removed.sort()).toEqual([
      "itjima.guest.inbox",
      "itjima.usageCount",
    ]);
    expect(localStorage.getItem("itjima.guest.inbox")).toBeNull();
    expect(localStorage.getItem("itjima.usageCount")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("uses a predictable dated export filename", () => {
    expect(dataExportFilename(new Date("2026-07-31T14:00:00Z"))).toBe(
      "itjima-data-2026-07-31.json",
    );
  });
});
