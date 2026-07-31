import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { FocusScheduleSheet } from "@/components/FocusScheduleSheet";
import { NlScheduleSheet } from "@/components/NlScheduleSheet";
import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import { LoginSheet } from "@/components/LoginSheet";
import { CleanupReviewSheet } from "@/components/CleanupReviewSheet";
import { InputBar } from "@/components/InputBar";
import { SyncIndicator } from "@/components/SyncIndicator";
import { runUserOrganize } from "@/components/BrainMirrorSummary";
import { InboxChat } from "@/components/home/InboxChat";
import { DecisionLauncher, DecisionLauncherCard } from "@/components/home/DecisionLauncher";
import { ContextMenu } from "@/components/home/ContextMenu";
import { PasteSheet } from "@/components/home/PasteSheet";
import { archiveFromInbox, scheduleFromInbox } from "@/lib/thoughtProvenance";
import { pendingDecisionItems } from "@/lib/decision";
import { inboxScheduleDefaults } from "@/lib/inboxScheduleDefaults";
import { detectDate } from "@/lib/dateDetect";
import {
  dateFromClarifyPick,
  understandNaturalLanguage,
  type ClarifyPick,
} from "@/lib/nlSchedule";
import {
  trackNlArchiveCreated,
  trackNlParseFailed,
  trackNlScheduleCreated,
  trackNlTaskCreated,
  trackNlThoughtSubmitted,
} from "@/lib/nlAnalytics";
import {
  loadAcknowledgedIds,
  pruneAcknowledgedIds,
  saveAcknowledgedIds,
} from "@/lib/nlAckStorage";
import { withNlConfirmGuard } from "@/lib/nlConfirmGuard";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { setRevivalHint } from "@/lib/archiveMeta";
import {
  buildRevivalHint,
  setRevivalJumpTarget,
  type RevivalHint,
} from "@/lib/memoryRevival";
import type { UndoSnapshot } from "@/components/DecisionDeck";
import {
  useInbox,
  useSchedules,
  useArchive,
  useUserId,
  getUsageCount,
  isLoginDismissed,
  type DecisionOutcome,
  type DecisionSource,
  type InboxItem,
} from "@/lib/store";
import { ThoughtDetailSheet } from "@/components/ThoughtDetailSheet";
import { track } from "@/lib/analytics";
import { showActionToast, showUndoActionToast, showUndoToast as showUndoToastBase } from "@/lib/undoToast";
import { useT, useLang } from "@/lib/i18n";
import { light as lightHaptic } from "@/lib/haptics";
import {
  isFirstCapturePending,
  markFirstCaptureDone,
} from "@/lib/firstCapture";
import { allCloudSynced } from "@/lib/syncFeedback";
import { useHomeChatScroll } from "@/hooks/useHomeChatScroll";
import { FEATURES } from "@/lib/features";

export const Route = createFileRoute("/")({
  component: Inbox,
});

const toastBtn =
  "touch-target shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-ink";

function Inbox() {
  const t = useT();
  const { lang } = useLang();
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
  const [nlScheduleSheet, setNlScheduleSheet] = useState<{
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
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pasteSheet, setPasteSheet] = useState<{
    chunks: string[];
    original: string;
  } | null>(null);
  const [restorePasteText, setRestorePasteText] = useState<string | null>(null);
  const [inboxRevival, setInboxRevival] = useState<RevivalHint | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setAcknowledgedIds(loadAcknowledgedIds(userId));
  }, [userId]);
  const items = inbox.items;
  const pendingItems = useMemo(() => pendingDecisionItems(items), [items]);
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
      { ko: "내일 3시 치과", en: "Dentist tomorrow at 3" },
      { ko: "엄마한테 전화", en: "Call mom" },
      { ko: "나중에 읽을 링크", en: "Link to read later" },
    ],
    [],
  );
  const newestId = pendingItems[0]?.id;
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const { notifyThoughtSubmitted, unreadBelow, jumpToLatest } =
    useHomeChatScroll(items.length);

  const showUndoToast = (
    message: string,
    onUndo: () => void | Promise<void>,
  ) => {
    showUndoToastBase(message, async () => {
      track("undo_used");
      await onUndo();
    }, { undoLabel: t("되돌리기", "Undo") });
  };

  const acknowledgeItem = useCallback((id: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev).add(id);
      saveAcknowledgedIds(userId, next);
      return next;
    });
  }, [userId]);

  useEffect(() => {
    if (items.length === 0) return;
    setAcknowledgedIds((prev) => {
      const active = new Set(items.map((it) => it.id));
      const pruned = pruneAcknowledgedIds(prev, active);
      if (pruned.size === prev.size) return prev;
      saveAcknowledgedIds(userId, pruned);
      return pruned;
    });
  }, [items, userId]);

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


  const openDecisionDeck = (fromId?: string) => {
    setDecisionDeckStartId(fromId ?? null);
    setDecisionDeckOpen(true);
  };

  const handleDeckDecide = async (
    outcome: DecisionOutcome,
    it: InboxItem,
    meta: { source: DecisionSource; position: number; total: number },
  ) => {
    if (outcome === "today") {
      const { start, end, text, options } = inboxScheduleDefaults(it);
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
      const { item: created, cloudSynced: scheduleSynced } = await schedules.add({
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
      track("schedule_created", { source: "decision_deck", text_length: text.length });
      if (!allCloudSynced(scheduleSynced, inboxSynced)) {
        throw new Error("sync failed");
      }
      return { scheduleId: created.id };
    }

    if (outcome === "later") {
      const ok = await inbox.update(it.id, {
        decision: "later",
        decided_at: new Date().toISOString(),
        decision_source: meta.source,
      } as Partial<InboxItem>);
      if (!ok) throw new Error("update failed");
      return {};
    }

    const payload = archiveFromInbox(it);
    const { item: created, cloudSynced: archiveSynced } = await archive.add(payload);
    const inboxSynced = await inbox.remove(it.id);
    track("thought_swiped_archive", { text_length: it.text.length });
    if (!allCloudSynced(archiveSynced, inboxSynced)) {
      throw new Error("sync failed");
    }
    return { archiveId: created.id };
  };

  const handleDeckUndo = async (snap: UndoSnapshot) => {
    const base = {
      text: snap.item.text,
      images: snap.item.images,
      brain_mirror: snap.item.brain_mirror,
    };

    if (snap.outcome === "today" && snap.scheduleId) {
      await schedules.remove(snap.scheduleId);
      await inbox.add({
        ...base,
        id: snap.item.id,
        created_at: snap.item.created_at,
      });
      return;
    }

    if (snap.outcome === "later") {
      await inbox.update(snap.item.id, {
        decision: undefined,
        decided_at: undefined,
        decision_source: undefined,
      } as Partial<InboxItem>);
      return;
    }

    if (snap.outcome === "archive" && snap.archiveId) {
      await archive.remove(snap.archiveId);
      await inbox.add({
        ...base,
        id: snap.item.id,
        created_at: snap.item.created_at,
      });
    }
  };

  const openHomeSchedule = (it: InboxItem) => {
    const uiLang = lang === "en" ? "en" : "ko";
    const nl = understandNaturalLanguage(it.text, uiLang);
    if (nl.intent === "task") {
      void confirmTaskLater(it);
      return;
    }
    if (nl.intent === "schedule_exact" || nl.intent === "schedule_clarify") {
      setNlScheduleSheet({ open: true, item: it });
      return;
    }
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
      track("thought_scheduled", { source, text_length: text.length });
      const whenLabel =
        lang === "en"
          ? start.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })
          : `${start.getMonth() + 1}월 ${start.getDate()}일`;
      showActionToast(
        t(`${whenLabel}에 추가했어요`, `Added to schedule for ${whenLabel}`),
        t("보러 가기", "Take a look"),
        () => void navigate({ to: "/schedule" }),
        { actionAriaLabel: t("일정 열기", "Open schedule") },
      );
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
      toast.error(t("그때로 못 옮겼어요", "Couldn't set that moment — try again?"));
    }
  };

  const confirmReleaseScheduleQuick = async (it: InboxItem) => {
    await withNlConfirmGuard(it.id, async () => {
      const uiLang = lang === "en" ? "en" : "ko";
      const nl = understandNaturalLanguage(it.text, uiLang);
      const det = nl.detectedDate ?? detectDate(it.text);
      if (!det) {
        trackNlParseFailed("missing_date");
        toast.message(
          t(
            "날짜를 확실히 못 잡았어요. 그대로 두었어요.",
            "Couldn't pin down the date — left it here for you.",
          ),
        );
        acknowledgeItem(it.id);
        return;
      }
      try {
        // Same defaults as Decision Deck — date-only → all-day, timed → parsed hour
        const { start, end, text, options } = inboxScheduleDefaults(it);
        await commitInboxSchedule(
          it,
          text,
          start,
          end,
          options,
          "promise_card",
        );
        trackNlScheduleCreated();
        setFocusScheduleSheet({ open: false });
        acknowledgeItem(it.id);
      } catch {
        trackNlParseFailed("commit_error");
        toast.error(t("그때로 못 옮겼어요", "Couldn't set that moment — try again?"));
      }
    });
  };

  const confirmClarifySchedule = async (
    it: InboxItem,
    pick: ClarifyPick,
  ) => {
    await withNlConfirmGuard(it.id, async () => {
      const { start, end } = dateFromClarifyPick(pick);
      // Clarify chips pick a day, not a clock time → all-day
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(start);
      dayEnd.setHours(23, 59, 0, 0);
      try {
        await commitInboxSchedule(
          it,
          thoughtFirstLine(it.text),
          dayStart,
          dayEnd,
          {
            reminderMinutes: null,
            allDay: true,
            startAllDay: true,
            endAllDay: true,
            repeat: null,
          },
          "promise_clarify",
        );
        trackNlScheduleCreated();
        acknowledgeItem(it.id);
      } catch {
        trackNlParseFailed("commit_error");
        toast.error(t("그때로 못 옮겼어요", "Couldn't set that moment — try again?"));
      }
    });
  };

  const confirmTaskLater = async (it: InboxItem) => {
    await withNlConfirmGuard(it.id, async () => {
      try {
        const ok = await inbox.update(it.id, {
          decision: "later",
          decided_at: new Date().toISOString(),
          decision_source: "button",
        } as Partial<InboxItem>);
        if (!ok) throw new Error("update failed");
        track("thought_task_later", { text_length: it.text.length });
        trackNlTaskCreated();
        acknowledgeItem(it.id);
        showActionToast(
          t("할 일로 넣었어요", "Added as a task"),
          t("보러 가기", "Take a look"),
          () => void navigate({ to: "/schedule" }),
          { actionAriaLabel: t("일정 열기", "Open schedule") },
        );
      } catch {
        toast.error(t("잠깐, 못 넣었어요", "Couldn't add that — try again?"));
      }
    });
  };

  const moveToArchive = async (it: InboxItem) => {
    await withNlConfirmGuard(it.id, async () => {
      try {
        const payload = archiveFromInbox(it);
        const existing = archive.items;
        const { item: created, cloudSynced: archiveSynced } = await archive.add(payload);
        const inboxSynced = await inbox.remove(it.id);
        track("thought_swiped_archive", { text_length: it.text.length });
        trackNlArchiveCreated();

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
        track("thought_archived", { text_length: it.text.length });
        showUndoActionToast(
          t("보관함에 넣었어요", "Saved to vault"),
          async () => {
            track("undo_used");
            await archive.remove(created.id);
            await inbox.add({
              text: payload.text,
              images: payload.images,
              brain_mirror: payload.brain_mirror,
            });
          },
          t("보러 가기", "Take a look"),
          () => void navigate({ to: "/archive" }),
          {
            undoLabel: t("되돌리기", "Undo"),
            actionAriaLabel: t("보관함 열기", "Open vault"),
          },
        );
      }
    } catch {
      toast.error(t("잠깐, 못 옮겼어요. 그대로 있어요", "Didn't move — still here"));
    }
    });
  };

  const moveToDelete = async (it: InboxItem) => {
    try {
      const deleted = await inbox.softDelete(it.id);
      track("thought_swiped_delete", { text_length: it.text.length });
      if (deleted) {
        track("thought_deleted", { text_length: it.text.length });
        showUndoToast(t("삭제했어요", "Deleted"), async () => {
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

  const handleAdd = async (
    text: string,
    images: string[],
    source: "text" | "voice" = "text",
  ) => {
    if (!text && !images.length) return;
    const isFirst = items.length === 0 && isFirstCapturePending();
    lightHaptic();
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
      trackNlThoughtSubmitted({
        textLength: text.length,
        language: lang === "en" ? "en" : "ko",
        source,
      });

      if (isFirst) {
        markFirstCaptureDone();
        toast.message(t("여기에 잘 두었어요.", "Saved here."), {
          duration: 2200,
        });
      }

      if (FEATURES.REDISCOVERY) {
        const revival = buildRevivalHint(created, archive.items, "inbox");
        if (revival) setInboxRevival(revival);
      }
      notifyThoughtSubmitted();
    } catch {
      track("thought_create_failed", {
        text_length: text.length,
        has_images: images.length > 0,
      });
      throw new Error("capture_failed");
    }
  };

  const retryCapture = (it: InboxItem) => {
    track("thought_retried", { text_length: it.text.length });
    inbox.patchLocal(it.id, { capture_state: "pending" });
    void inbox.retrySync();
  };

  const handleUnderstandAgain = async (target: InboxItem) => {
    const mirror = await runUserOrganize(target, inbox);
    if (mirror) {
      lightHaptic();
    } else {
      toast.message(
        t("지금은 정리가 어려워요", "Hard to sort right now — try in a bit"),
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
                "다른 기기에서도 이어가려면 로그인",
                "Sign in to pick up on any device",
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
        inboxRevival={inboxRevival}
        onInboxRevivalDismiss={() => setInboxRevival(null)}
        onRevisitArchiveMemory={revisitArchiveMemory}
        acknowledgedIds={acknowledgedIds}
        listEndRef={listEndRef}
        onMoveToArchive={moveToArchive}
        onOpenContextMenu={setMenuFor}
        onConfirmScheduleQuick={confirmReleaseScheduleQuick}
        onConfirmClarifySchedule={confirmClarifySchedule}
        onConfirmTaskLater={confirmTaskLater}
        onOpenPromiseSchedule={openPromiseSchedule}
        onMoveToDelete={moveToDelete}
        onAcknowledgeItem={acknowledgeItem}
        onMaybeNudgeLogin={maybeNudgeLogin}
        onOpenDetail={setDetailItem}
        onRetryCapture={retryCapture}
      />

      <div className="composer-hero relative sticky bottom-0 z-20 shrink-0">
        {unreadBelow > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute -top-11 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white shadow-float"
            aria-live="polite"
          >
            {t(`새로 ${unreadBelow}개`, `${unreadBelow} new below`)}
          </button>
        )}
        <DecisionLauncherCard
          itemCount={pendingItems.length}
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

      <ThoughtDetailSheet
        item={detailItem}
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        onSchedule={openHomeSchedule}
        onArchive={moveToArchive}
        onDelete={moveToDelete}
        onSaveEdit={async (item, text) => {
          await inbox.update(item.id, { text });
          toast.success(t("고쳤어요", "Saved your edit"));
        }}
      />

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
        items={pendingItems}
        onClose={() => {
          setDecisionDeckOpen(false);
          setDecisionDeckStartId(null);
          setFocusPendingScheduleId(null);
          setFocusScheduleSheet({ open: false });
        }}
        onDecide={handleDeckDecide}
        onUndo={handleDeckUndo}
        onCapture={() => {
          listEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      {FEATURES.CLEANUP && (
        <CleanupReviewSheet
          open={cleanupReviewOpen}
          items={items}
          onClose={() => setCleanupReviewOpen(false)}
          onConfirmDelete={confirmCleanupDelete}
        />
      )}

      <NlScheduleSheet
        item={nlScheduleSheet.item ?? null}
        open={nlScheduleSheet.open}
        onClose={() => setNlScheduleSheet({ open: false })}
        onConfirmScheduleQuick={confirmReleaseScheduleQuick}
        onConfirmClarify={confirmClarifySchedule}
        onConfirmTaskLater={confirmTaskLater}
        onOpenManualSchedule={(it) => {
          setFocusScheduleSheet({ open: true, item: it });
        }}
        onArchive={moveToArchive}
        onLetGo={moveToDelete}
      />

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
