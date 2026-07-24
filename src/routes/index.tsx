import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { FocusScheduleSheet } from "@/components/FocusScheduleSheet";
import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import { LoginSheet } from "@/components/LoginSheet";
import { CleanupReviewSheet } from "@/components/CleanupReviewSheet";
import { InputBar } from "@/components/InputBar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SyncIndicator } from "@/components/SyncIndicator";
import { runUserOrganize } from "@/components/BrainMirrorSummary";
import { InboxChat } from "@/components/home/InboxChat";
import { DecisionLauncher, DecisionLauncherCard } from "@/components/home/DecisionLauncher";
import { ContextMenu } from "@/components/home/ContextMenu";
import { PasteSheet } from "@/components/home/PasteSheet";
import { archiveFromInbox, scheduleFromInbox } from "@/lib/thoughtProvenance";
import { detectDate } from "@/lib/dateDetect";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { setRevivalHint } from "@/lib/archiveMeta";
import {
  buildRevivalHint,
  setRevivalJumpTarget,
  type RevivalHint,
} from "@/lib/memoryRevival";
import {
  useInbox,
  useSchedules,
  useArchive,
  useUserId,
  getUsageCount,
  isLoginDismissed,
  type InboxItem,
} from "@/lib/store";
import { track } from "@/lib/analytics";
import { useT } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { allCloudSynced } from "@/lib/syncFeedback";
import { FEATURES } from "@/lib/features";

export const Route = createFileRoute("/")({
  component: Inbox,
});

const toastBtn =
  "touch-target shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-ink";

function Inbox() {
  const t = useT();
  const navigate = useNavigate();
  const inbox = useInbox();
  const schedules = useSchedules();
  const archive = useArchive();
  const userId = useUserId();

  const [loginOpen, setLoginOpen] = useState(false);
  const [decisionDeckOpen, setDecisionDeckOpen] = useState(false);
  const [decisionDeckStartId, setDecisionDeckStartId] = useState<string | null>(
    null,
  );
  const [focusScheduleSheet, setFocusScheduleSheet] = useState<{
    open: boolean;
    item?: InboxItem;
  }>({ open: false });
  const [focusPendingScheduleId, setFocusPendingScheduleId] = useState<
    string | null
  >(null);
  const [scheduleCommittedId, setScheduleCommittedId] = useState<string | null>(
    null,
  );
  const [cleanupReviewOpen, setCleanupReviewOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pasteSheet, setPasteSheet] = useState<{
    chunks: string[];
    original: string;
  } | null>(null);
  const [restorePasteText, setRestorePasteText] = useState<string | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [inboxRevival, setInboxRevival] = useState<RevivalHint | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const items = inbox.items;
  const menuItem = menuFor
    ? items.find((x) => x.id === menuFor)
    : undefined;
  const syncing = inbox.syncState === "syncing";
  const itemsAsc = useMemo(
    () => [...items].slice().reverse(),
    [items],
  );
  const exampleChips = useMemo(
    () => [
      { ko: "내일 오후 3시 치과", en: "Dentist tomorrow at 3pm" },
      { ko: "사고 싶은 것", en: "Things to buy" },
      { ko: "나중에 볼 링크", en: "Link to read later" },
    ],
    [],
  );
  const newestId = items[0]?.id;
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(items.length);

  const acknowledgeItem = useCallback((id: string) => {
    setAcknowledgedIds((prev) => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (items.length > prevCountRef.current) {
      requestAnimationFrame(() => {
        listEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    }
    prevCountRef.current = items.length;
  }, [items.length]);

  const openPromiseSchedule = useCallback((it: InboxItem) => {
    setFocusScheduleSheet({ open: true, item: it });
  }, []);

  // FocusScheduleSheet back-button guard when opened from inbox swipe/promise.
  const ignoreFocusScheduleSheetPopRef = useRef(false);
  useEffect(() => {
    if (!focusScheduleSheet.open) return;
    history.pushState({ focusScheduleSheet: true }, "");

    const onPopState = () => {
      if (ignoreFocusScheduleSheetPopRef.current) {
        ignoreFocusScheduleSheetPopRef.current = false;
        return;
      }
      setFocusScheduleSheet({ open: false });
      setFocusPendingScheduleId(null);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [focusScheduleSheet.open]);

  useEffect(() => {
    if (!menuItem && !pasteSheet) return;
    const scroll = document.getElementById("phone-scroll");
    const prevOverflow = scroll?.style.overflow ?? "";
    const prevBody = document.body.style.overflow;
    if (scroll) scroll.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroll) scroll.style.overflow = prevOverflow;
      document.body.style.overflow = prevBody;
    };
  }, [menuItem, pasteSheet]);

  const revisitArchiveMemory = (memoryId: string) => {
    setRevivalJumpTarget(memoryId);
    haptic(4);
    void navigate({ to: "/archive" });
  };

  const showUndoToast = (
    message: string,
    onUndo: () => void | Promise<void>,
  ) => {
    toast.custom(
      (toastId) => (
        <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
          <div className="text-sm">{message}</div>
          <button
            onClick={async () => {
              await onUndo();
              toast.dismiss(toastId);
            }}
            className={toastBtn}
          >
            {t("되돌리기", "Undo")}
          </button>
        </div>
      ),
      { duration: 10000 },
    );
  };

  const openDecisionDeck = (fromId?: string) => {
    setDecisionDeckStartId(fromId ?? null);
    setDecisionDeckOpen(true);
  };

  const openScheduleFromDecisionDeck = (it: InboxItem) => {
    setFocusPendingScheduleId(it.id);
    setFocusScheduleSheet({ open: true, item: it });
  };

  const openHomeSchedule = (it: InboxItem) => {
    setFocusScheduleSheet({ open: true, item: it });
  };

  const commitInboxSchedule = async (
    it: InboxItem,
    text: string,
    start: Date,
    end: Date,
    options: ScheduleConfirmOptions,
    source: string,
  ) => {
    const payload = scheduleFromInbox(it, {
      text,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      alarm: options.reminderMinutes !== null,
      all_day: options.allDay,
      start_all_day: options.startAllDay,
      end_all_day: options.endAllDay,
      repeat: options.repeat,
    });
    const { cloudSynced: scheduleSynced } = await schedules.add({
      ...payload,
      ...(options.reminderMinutes !== null
        ? {
            alarm_at: new Date(
              start.getTime() - options.reminderMinutes * 60 * 1000,
            ).toISOString(),
          }
        : {}),
    });
    const inboxSynced = await inbox.remove(it.id);
    track("schedule_created", { source, text_length: text.length });
    if (allCloudSynced(scheduleSynced, inboxSynced)) {
      toast.success(t("일정으로 잡았어요", "Added to your schedule"));
    }
  };

  const saveHomeSchedule = async (
    text: string,
    start: Date,
    end: Date,
    options: ScheduleConfirmOptions,
  ) => {
    const it = focusScheduleSheet.item;
    if (!it) return;
    try {
      await commitInboxSchedule(
        it,
        text,
        start,
        end,
        options,
        decisionDeckOpen && focusPendingScheduleId === it.id
          ? "focus_sort"
          : "inbox_swipe",
      );
      setFocusScheduleSheet({ open: false });
      setFocusPendingScheduleId(null);
      if (decisionDeckOpen) setScheduleCommittedId(it.id);
    } catch {
      toast.error(t("일정을 남기지 못했어요", "Couldn't anchor it in time"));
    }
  };

  const confirmReleaseScheduleQuick = async (it: InboxItem) => {
    const det = detectDate(it.text);
    if (!det) {
      openPromiseSchedule(it);
      return;
    }
    try {
      await commitInboxSchedule(
        it,
        thoughtFirstLine(it.text),
        det.start,
        det.end,
        {
          reminderMinutes: null,
          allDay: false,
          startAllDay: false,
          endAllDay: false,
          repeat: null,
        },
        "promise_card",
      );
      setFocusScheduleSheet({ open: false });
    } catch {
      toast.error(t("일정을 남기지 못했어요", "Couldn't anchor it in time"));
    }
  };

  const moveToArchive = async (it: InboxItem) => {
    try {
      const payload = archiveFromInbox(it);
      const existing = archive.items;
      const { item: created, cloudSynced: archiveSynced } = await archive.add(payload);
      const inboxSynced = await inbox.remove(it.id);
      track("thought_swiped_archive", { text_length: it.text.length });

      const related =
        FEATURES.REDISCOVERY
          ? buildRevivalHint(created, existing, "archive")
          : null;
      if (related) {
        setRevivalHint(related);
      }
      if (FEATURES.REDISCOVERY && inboxRevival?.sourceId === it.id) {
        setInboxRevival(null);
      }

      if (allCloudSynced(archiveSynced, inboxSynced)) {
        showUndoToast(t("기억함에 뒀어요", "Kept safe"), async () => {
          await archive.remove(created.id);
          const { item: restored } = await inbox.add({
            text: payload.text,
            images: payload.images,
            brain_mirror: payload.brain_mirror,
          });
        });
      }
    } catch {
      toast.error(t("남기지 못했어요", "Couldn't keep it here"));
    }
  };

  const moveToDelete = async (it: InboxItem) => {
    try {
      const deleted = await inbox.softDelete(it.id);
      track("thought_swiped_delete", { text_length: it.text.length });
      if (deleted) {
        showUndoToast(t("지웠어요", "Removed"), async () => {
          await inbox.update(it.id, { status: "active" } as Partial<InboxItem>);
        });
      }
    } catch {
      toast.error(t("삭제하지 못했어요", "Couldn't delete"));
    }
  };

  const confirmCleanupDelete = async (ids: string[]) => {
    try {
      const results = await Promise.all(ids.map((id) => inbox.softDelete(id)));
      if (allCloudSynced(...results)) {
        toast.success(t("가벼워졌어요", "Feels lighter now"));
      }
    } catch {
      toast.error(t("비우지 못했어요", "Couldn't lighten up"));
    }
  };

  const handleAdd = async (text: string, images: string[]) => {
    if (!text && !images.length) return;
    haptic([6, 16, 10]);
    try {
      const { item: created } = await inbox.add({
        text,
        images,
      });
      track("thought_created", {
        text_length: text.length,
        has_images: images.length > 0,
        image_count: images.length,
      });

      if (FEATURES.REDISCOVERY) {
        const revival = buildRevivalHint(created, archive.items, "inbox");
        if (revival) setInboxRevival(revival);
      }
    } catch {
      toast.error(t("남기지 못했어요", "Couldn't keep it"));
    }
  };

  const handleUnderstandAgain = async (target: InboxItem) => {
    const mirror = await runUserOrganize(target, inbox);
    if (mirror) {
      haptic([4, 8, 5]);
    } else {
      toast.message(
        t("지금은 정리하지 못했어요", "Couldn't organize right now"),
        { duration: 2800 },
      );
    }
  };

  useEffect(() => {
    if (!menuFor && !pasteSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pasteSheet) {
          setRestorePasteText(pasteSheet.original);
          setPasteSheet(null);
        } else setMenuFor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuFor, pasteSheet]);

  const maybeNudgeLogin = () => {
    if (userId) return;
    if (isLoginDismissed()) return;
    const u = getUsageCount();
    if (u === 3) {
      toast.custom(
        (id) => (
          <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
            <div className="text-sm">
              💾{" "}
              {t(
                "다른 기기에서도 이어가려면 로그인해 주세요",
                "Sign in to keep your thoughts on every device",
              )}
            </div>
            <button
              onClick={() => {
                setLoginOpen(true);
                toast.dismiss(id);
              }}
              className={toastBtn}
            >
              {t("로그인", "Sign in")}
            </button>
          </div>
        ),
        { duration: 6000 },
      );
    }
  };

  const handlePasteMulti = useCallback((chunks: string[], original: string) => {
    if (!FEATURES.PASTE_SPLIT) return;
    setPasteSheet({ chunks, original });
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SyncIndicator
        syncing={syncing}
        error={inbox.syncState === "error"}
        onRetry={inbox.retrySync}
      />

      <InboxChat
        itemsAsc={itemsAsc}
        newestId={newestId}
        swipeOpenId={swipeOpenId}
        onSwipeOpenIdChange={setSwipeOpenId}
        inboxRevival={inboxRevival}
        onInboxRevivalDismiss={() => setInboxRevival(null)}
        onRevisitArchiveMemory={revisitArchiveMemory}
        acknowledgedIds={acknowledgedIds}
        listEndRef={listEndRef}
        onOpenHomeSchedule={openHomeSchedule}
        onMoveToArchive={moveToArchive}
        onOpenContextMenu={setMenuFor}
        onConfirmScheduleQuick={confirmReleaseScheduleQuick}
        onOpenPromiseSchedule={openPromiseSchedule}
        onMoveToDelete={moveToDelete}
        onAcknowledgeItem={acknowledgeItem}
        onMaybeNudgeLogin={maybeNudgeLogin}
      />

      <div className="sticky bottom-0 z-20 shrink-0 bg-white">
        <DecisionLauncherCard
          itemCount={items.length}
          newestItemId={newestId}
          onOpen={(startId) => openDecisionDeck(startId ?? undefined)}
        />
        <InputBar
          composer
          onAdd={handleAdd}
          exampleChips={items.length === 0 ? exampleChips : undefined}
          onPasteMulti={handlePasteMulti}
          restoreText={restorePasteText}
          onRestoreConsumed={() => setRestorePasteText(null)}
        />
      </div>

      <InstallPrompt />

      {menuItem && (
        <ContextMenu
          menuItem={menuItem}
          onClose={() => setMenuFor(null)}
          onOpenCleanup={() => setCleanupReviewOpen(true)}
          onOpenDecisionDeck={() => openDecisionDeck()}
          onUnderstandAgain={handleUnderstandAgain}
          onOpenHomeSchedule={openHomeSchedule}
          onMoveToArchive={moveToArchive}
          onMoveToDelete={moveToDelete}
        />
      )}

      {FEATURES.PASTE_SPLIT && pasteSheet && (
        <PasteSheet
          pasteSheet={pasteSheet}
          onDismiss={() => {
            setRestorePasteText(pasteSheet.original);
            setPasteSheet(null);
          }}
          onKeepSeparately={async () => {
            try {
              for (const c of pasteSheet.chunks) {
                await inbox.add({
                  text: c,
                  images: [],
                });
              }
              setPasteSheet(null);
              toast.success(
                t(
                  `${pasteSheet.chunks.length}개로 나눠 남겼어요`,
                  `Kept as ${pasteSheet.chunks.length} separate thoughts`,
                ),
              );
            } catch {
              toast.error(t("남기지 못했어요", "Couldn't keep it"));
            }
          }}
          onKeepAsOne={async () => {
            const original = pasteSheet.original;
            try {
              await inbox.add({
                text: original,
                images: [],
              });
              setPasteSheet(null);
            } catch {
              toast.error(t("남기지 못했어요", "Couldn't keep it"));
            }
          }}
        />
      )}

      <DecisionLauncher
        open={decisionDeckOpen}
        startItemId={decisionDeckStartId}
        items={items}
        pendingScheduleId={focusPendingScheduleId}
        scheduleCommittedId={scheduleCommittedId}
        onScheduleCommitHandled={() => setScheduleCommittedId(null)}
        onClose={() => {
          setDecisionDeckOpen(false);
          setDecisionDeckStartId(null);
          setFocusPendingScheduleId(null);
          setFocusScheduleSheet({ open: false });
        }}
        onScheduleRequest={openScheduleFromDecisionDeck}
        onArchive={(it) => moveToArchive(it)}
      />

      {FEATURES.CLEANUP && (
        <CleanupReviewSheet
          open={cleanupReviewOpen}
          items={items}
          onClose={() => setCleanupReviewOpen(false)}
          onConfirmDelete={confirmCleanupDelete}
        />
      )}

      <FocusScheduleSheet
        item={focusScheduleSheet.item ?? null}
        open={focusScheduleSheet.open}
        onClose={() => {
          ignoreFocusScheduleSheetPopRef.current = true;
          history.back();
          setFocusScheduleSheet({ open: false });
          setFocusPendingScheduleId(null);
        }}
        onConfirm={(text, start, end, options) => {
          void saveHomeSchedule(text, start, end, options);
        }}
      />

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
