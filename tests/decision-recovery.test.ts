import { beforeEach, describe, expect, it } from "vitest";
import {
  captureDecisionStorage,
  clearInboxTombstones,
  recoverLocallyCommittedDecision,
  undoLocallyCommitted,
} from "@/lib/decisionRecovery";
import type { InboxItem } from "@/lib/store";

const thought: InboxItem = {
  id: "thought-1",
  text: "내일 3시 치과",
  images: ["data:image/png;base64,abc"],
  created_at: "2026-07-27T01:00:00.000Z",
  status: "active",
};

function write(bucket: "inbox" | "schedules" | "archive", rows: unknown[]) {
  localStorage.setItem(`itjima.guest.${bucket}`, JSON.stringify(rows));
}

describe("decision local recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    write("inbox", [thought]);
    write("schedules", []);
    write("archive", []);
  });

  it("recovers a locally committed schedule after a cloud-only failure", () => {
    const before = captureDecisionStorage(thought.id);
    // M1: inbox may remain; a new schedule projection is the commit signal.
    write("schedules", [
      {
        id: thought.id,
        text: thought.text,
        source_id: thought.id,
        created_at: "2026-07-27T01:01:00.000Z",
      },
    ]);

    expect(recoverLocallyCommittedDecision("today", thought.id, before)).toEqual({
      scheduleId: thought.id,
    });
  });

  it("does not mistake an old destination row for a new decision", () => {
    write("schedules", [
      {
        id: "schedule-old",
        source_id: thought.id,
        created_at: "2026-07-20T01:00:00.000Z",
      },
    ]);
    const before = captureDecisionStorage(thought.id);
    // No new schedule appeared after the snapshot.
    expect(recoverLocallyCommittedDecision("today", thought.id, before)).toBeNull();
  });

  it("recovers keep-for-later only when the inbox row proves the decision", () => {
    const before = captureDecisionStorage(thought.id);
    write("inbox", [{ ...thought, decision: "later" }]);
    expect(recoverLocallyCommittedDecision("later", thought.id, before)).toEqual({});
  });

  it("clears a pending inbox tombstone when undo restores the thought", () => {
    localStorage.setItem(
      "itjima.user-1.tombstones",
      JSON.stringify([
        { id: thought.id, table: "inbox", userId: "user-1" },
        { id: "other", table: "archive", userId: "user-1" },
      ]),
    );

    clearInboxTombstones(thought.id);

    expect(JSON.parse(localStorage.getItem("itjima.user-1.tombstones") || "[]")).toEqual([
      { id: "other", table: "archive", userId: "user-1" },
    ]);
  });

  it("verifies an undo only after the source is back and destination is gone", () => {
    write("inbox", [thought]);
    write("archive", []);
    expect(
      undoLocallyCommitted({
        item: thought,
        outcome: "archive",
        archiveId: "archive-1",
      }),
    ).toBe(true);

    write("archive", [{ id: "archive-1", source_id: thought.id }]);
    expect(
      undoLocallyCommitted({
        item: thought,
        outcome: "archive",
        archiveId: "archive-1",
      }),
    ).toBe(false);
  });
});
