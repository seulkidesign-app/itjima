import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InboxChat } from "@/components/home/InboxChat";
import { LanguageProvider } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";

function noTimeItem(id: string, text: string): InboxItem {
  return {
    id,
    text,
    images: [],
    created_at: new Date().toISOString(),
    status: "active",
    raw_text: text,
    temporal_state: "no_time",
    clarification_state: null,
  };
}

describe("InboxChat no-time capture visibility", () => {
  it("renders contextual and vague captures instead of losing them behind a toast", () => {
    const items = [
      noTimeItem("meal-clean", "밥 먹고 청소"),
      noTimeItem("later-clean", "나중에 청소"),
    ];

    const html = renderToStaticMarkup(
      <LanguageProvider>
        <InboxChat
          itemsAsc={items}
          newestId="later-clean"
          inboxRevival={null}
          onInboxRevivalDismiss={() => {}}
          onRevisitArchiveMemory={() => {}}
          acknowledgedIds={new Set()}
          autoCommitInFlightIds={new Set()}
          savedFeedback={null}
          listEndRef={createRef<HTMLDivElement>()}
          onMoveToArchive={() => {}}
          onOpenContextMenu={() => {}}
          onConfirmScheduleQuick={() => {}}
          onConfirmClarifySchedule={() => {}}
          onConfirmTaskLater={() => {}}
          onOpenPromiseSchedule={() => {}}
          onMoveToDelete={() => {}}
          onAcknowledgeItem={() => {}}
          onMaybeNudgeLogin={() => {}}
          onOpenDetail={() => {}}
          onRetryCapture={() => {}}
          onEditCaptureText={() => {}}
          onEditSavedSchedule={() => {}}
          onOpenAllRecords={() => {}}
        />
      </LanguageProvider>,
    );

    expect(html).toContain("밥 먹고 청소");
    expect(html).toContain("나중에 청소");
    expect((html.match(/data-testid=\"left-item-row\"/g) ?? []).length).toBe(2);
  });
});
