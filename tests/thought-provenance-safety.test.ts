import { describe, expect, it } from "vitest";
import {
  archiveFromInbox,
  inboxSnapshot,
  scheduleFromInbox,
} from "@/lib/thoughtProvenance";
import type { InboxItem } from "@/lib/store";

const thought: InboxItem = {
  id: "thought-original",
  text: "내일 치과\n보험 서류 챙기기",
  images: ["data:image/png;base64,first", "data:image/png;base64,second"],
  created_at: "2026-07-27T01:00:00.000Z",
  status: "active",
  brain_mirror: null,
};

describe("thought provenance safety", () => {
  it("keeps raw text, images, and source id in an inbox snapshot", () => {
    expect(inboxSnapshot(thought)).toEqual({
      text: thought.text,
      images: thought.images,
      brain_mirror: null,
      source_id: thought.id,
      raw_text: thought.text,
    });
  });

  it("preserves the full original text when a shortened title becomes a schedule", () => {
    const schedule = scheduleFromInbox(thought, {
      text: "치과",
      start_time: "2026-07-28T00:00:00.000Z",
      end_time: "2026-07-28T23:59:59.999Z",
      all_day: true,
      start_all_day: true,
      end_all_day: true,
    });

    expect(schedule).toMatchObject({
      id: thought.id,
      text: "치과",
      raw_text: thought.text,
      source_id: thought.id,
      all_day: true,
      start_all_day: true,
      end_all_day: true,
      alarm: false,
      status: "active",
    });
  });

  it("preserves images and the original text when moved to archive", () => {
    expect(archiveFromInbox(thought)).toMatchObject({
      text: thought.text,
      raw_text: thought.text,
      source_id: thought.id,
      images: thought.images,
    });
  });

  it("sanitizes legacy undefined prefixes without altering valid content", () => {
    const legacy = { ...thought, text: "undefined치과 예약" };
    expect(inboxSnapshot(legacy).raw_text).toBe("치과 예약");
    expect(inboxSnapshot(thought).raw_text).toBe(thought.text);
  });
});
