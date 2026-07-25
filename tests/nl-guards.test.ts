import { describe, expect, it } from "vitest";
import { withNlConfirmGuard, isNlConfirmInFlight } from "@/lib/nlConfirmGuard";
import { appendFinalSpeech, normalizeSpeechSegment } from "@/lib/speechInput";
import { buildPromiseCard } from "@/lib/promiseCard";

describe("NL confirm guard", () => {
  it("blocks duplicate concurrent commits", async () => {
    let runs = 0;
    const slow = () =>
      new Promise<void>((resolve) => {
        runs += 1;
        setTimeout(resolve, 30);
      });

    const first = withNlConfirmGuard("item-1", slow);
    const second = withNlConfirmGuard("item-1", slow);

    expect(isNlConfirmInFlight("item-1")).toBe(true);
    const [ok1, ok2] = await Promise.all([first, second]);
    expect(ok1).toBe(true);
    expect(ok2).toBe(false);
    expect(runs).toBe(1);
    expect(isNlConfirmInFlight("item-1")).toBe(false);
  });

  it("allows separate items in parallel", async () => {
    const runs: string[] = [];
    await Promise.all([
      withNlConfirmGuard("a", async () => {
        runs.push("a");
      }),
      withNlConfirmGuard("b", async () => {
        runs.push("b");
      }),
    ]);
    expect(runs.sort()).toEqual(["a", "b"]);
  });
});

describe("voice transcript dedupe", () => {
  it("ignores duplicate final segments", () => {
    expect(appendFinalSpeech("내일 3시에 치과", "내일 3시에 치과")).toBe(
      "내일 3시에 치과",
    );
  });

  it("ignores segment already at end", () => {
    expect(
      appendFinalSpeech("내일 3시에 치과", "치과"),
    ).toBe("내일 3시에 치과");
  });

  it("replaces with longer prefix extension", () => {
    expect(
      appendFinalSpeech("내일", "내일 3시에 치과"),
    ).toBe("내일 3시에 치과");
  });

  it("normalizes repeated whitespace", () => {
    expect(normalizeSpeechSegment("내일    3시   치과")).toBe("내일 3시 치과");
  });
});

describe("calendar never auto-opens from NL parse", () => {
  it("schedule_exact uses confirm path not sheet", () => {
    const card = buildPromiseCard("내일 3시에 치과", "ko");
    expect(card.primaryAction).toBe("confirm_schedule");
    expect(card.editAction).toBe("open_edit_menu");
  });
});
