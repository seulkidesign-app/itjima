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
import { DecisionLauncher } from "@/components/home/DecisionLauncher";
import { ContextMenu } from "@/components/home/ContextMenu";
import { PasteSheet } from "@/components/home/PasteSheet";
import { archiveFromInbox } from "@/lib/thoughtProvenance";
import { pendingDecisionItems } from "@/lib/decision";
import { inboxScheduleDefaults } from "@/lib/inboxScheduleDefaults";
import { detectDate } from "@/lib/dateDetect";
import {
  dateFromClarifyPick,
  understandNaturalLanguage,
  type ClarifyPick,
} from "@/lib/nlSchedule";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { buildTemporalCompletionDraft } from "@/lib/nlTemporalCompletion";
import {
  commitInboxToSchedule,
  undoScheduleToInbox,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import { findScheduleProjection } from "@/lib/scheduleProjection";
import {
  contentRevisionOf,
  withBumpedContentRevision,
} from "@/lib/recordRevision";
import {
  isAmbiguousTemporalReason,
  temporalStateFromAutoCommitReason,
} from "@/lib/recordTemporal";
import {
  buildNaturalScheduleDraft,
  formatCaptureWhenLabel,
} from "@/lib/naturalScheduleDraft";
import type { SavedScheduleFeedbackModel } from "@/components/home/SavedScheduleFeedback";
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
  type ScheduleItem,
} from "@/lib/store";
import { ThoughtDetailSheet } from "@/components/ThoughtDetailSheet";
import {
  deleteRecord,
  syncRecordTemporal,
  syncRecordText,
  undoDeleteRecord,
  type CanonicalMutationOps,
} from "@/lib/canonicalMutations";
import { clearInboxTombstones } from "@/lib/decisionRecovery";
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

  useEffect(() => {
    const onOpenDetail = (event: Event) => {
      const detail = (event as CustomEvent<InboxItem>).detail;
      if (detail?.id) setDetailItem(detail);
    };
    window.addEventListener("itjima:open-record-detail", onOpenDetail);
    return () =>
      window.removeEventListener("itjima:open-record-detail", onOpenDetail);
  }, []);
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
  const [autoCommitInFlightIds, setAutoCommitInFlightIds] = useState<
    Set<string>
  >(() => new Set());
  const [savedFeedback, setSavedFeedback] =
    useState<SavedScheduleFeedbackModel | null>(null);
  const savedUndoRef = useRef<{
    scheduleId: string;
    inboxItem: InboxItem;
    fields: LaterInboxScheduleFields;
  } | null>(null);
  /** When set, next capture replaces this raw inbox row (multi-clock 입력 수정). */
  const captureReplaceInboxIdRef = useRef<string | null>(null);

  useEffect(() => {
    setAcknowledgedIds(loadAcknowledgedIds(userId));
  }, [userId]);
  const items = inbox.items;
  const allInboxItems = inbox.allItems;
  const mutationOps = useCallback((): CanonicalMutationOps => {
    return {
      getInboxById: (id) => allInboxItems.find((it) => it.id === id),
      updateInbox: (id, patch) => inbox.update(id, patch),
      softDeleteInbox: (id) => inbox.softDelete(id),
      // Read LS directly so delete snapshots never miss a just-written projection.
      getSchedules: () => {
        try {
          const key = `itjima.${userId ?? "guest"}.schedules`;
          return JSON.parse(localStorage.getItem(key) || "[]") as ScheduleItem[];
        } catch {
          return schedules.items;
        }
      },
      updateSchedule: (id, patch) => schedules.update(id, patch),
      removeSchedule: (id) => schedules.remove(id),
      addSchedule: async (payload) => schedules.add(payload),
    };
  }, [allInboxItems, inbox, schedules, userId]);
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
    lightHaptic(4);
    void navigate({ to: "/archive" });
  };

  const restoreCanonicalAfterArchiveFailure = useCallback(
    async (it: InboxItem) => {
      clearInboxTombstones(it.id);
      await inbox.add({
        ...it,
        id: it.id,
        text: it.text,
        images: it.images,
        created_at: it.created_at,
        status: it.status ?? "active",
        raw_text: it.raw_text ?? it.text,
      });
    },
    [inbox],
  );

  const archiveInboxSafely = useCallback(
    async (it: InboxItem) => {
      const payload = archiveFromInbox(it);
      const { item: created, cloudSynced: archiveSynced } = await archive.add(
        payload,
        { confirmCloud: true },
      );

      if (!archiveSynced) {
        return { ok: false as const, reason: "archive_create_failed" as const };
      }

      const inboxSynced = await inbox.remove(it.id);
      if (!inboxSynced) {
        // remove() is local-first and leaves an Inbox tombstone on cloud failure.
        // Abort the move: cancel that tombstone, remove the destination copy, and
        // restore the original canonical identity locally. A later sync can
        // reconcile whichever side of the failed DELETE actually reached cloud.
        clearInboxTombstones(it.id);
        await archive.remove(created.id);
        await restoreCanonicalAfterArchiveFailure(it);
        return { ok: false as const, reason: "inbox_remove_failed" as const };
      }

      return { ok: true as const, created, payload };
    },
    [archive, inbox, restoreCanonicalAfterArchiveFailure],
  );

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
      const fields: LaterInboxScheduleFields = {
        text,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        alarm: options.reminderMinutes !== null,
        all_day: options.allDay,
        start_all_day: options.startAllDay,
        end_all_day: options.endAllDay,
        repeat: options.repeat,
        ...(options.reminderMinutes !== null
          ? {
              alarm_at: new Date(
                start.getTime() - options.reminderMinutes * 60 * 1000,
              ).toISOString(),
            }
          : {}),
      };
      const result = await commitInboxToSchedule(
        it,
        fields,
        scheduleCommitOps(),
        { expectedRevision: contentRevisionOf(it) },
      );
      if (result.status !== "ok") {
        throw new Error(result.status);
      }
      track("schedule_created", {
        source: "decision_deck",
        text_length: text.length,
      });
      return { scheduleId: result.scheduleId };
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

    const result = await archiveInboxSafely(it);
    if (!result.ok) throw new Error(result.reason);
    track("thought_swiped_archive", { text_length: it.text.length });
    return { archiveId: result.created.id };
  };

  const handleDeckUndo = async (snap: UndoSnapshot) => {
    const base = {
      text: snap.item.text,
      images: snap.item.images,
      brain_mirror: snap.item.brain_mirror,
    };

    if (snap.outcome === "today" && snap.scheduleId) {
      const sched =
        findScheduleProjection(schedules.items, snap.item.id) ??
        schedules.items.find((s) => s.id === snap.scheduleId);
      const fields: LaterInboxScheduleFields = {
        text: sched?.text ?? snap.item.text,
        start_time: sched?.start_time ?? new Date().toISOString(),
        end_time: sched?.end_time ?? new Date().toISOString(),
        alarm: sched?.alarm,
        all_day: sched?.all_day,
        start_all_day: sched?.start_all_day,
        end_all_day: sched?.end_all_day,
        repeat: sched?.repeat ?? null,
        alarm_at: sched?.alarm_at,
      };
      const undone = await undoScheduleToInbox(
        snap.scheduleId,
        snap.item,
        fields,
        scheduleCommitOps(),
      );
      if (undone.status !== "ok") {
        await schedules.remove(snap.scheduleId);
        await inbox.update(
          snap.item.id,
          withBumpedContentRevision(snap.item, {
            start_time: null,
            end_time: null,
            all_day: null,
            temporal_state: "no_time",
            structured_at: null,
            clarification_state: "dismissed",
          }),
        );
      }
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

  const scheduleCommitOps = useCallback(
    () => ({
      addSchedule: (
        payload: Parameters<typeof schedules.add>[0] & {
          alarm_at?: string | null;
        },
      ) => schedules.add(payload, { confirmCloud: true }),
      updateSchedule: (id: string, patch: Partial<ScheduleItem>) =>
        schedules.update(id, patch),
      removeSchedule: (id: string) => schedules.remove(id),
      getScheduleByRecordId: (recordId: string) =>
        findScheduleProjection(schedules.items, recordId),
      getInboxById: (recordId: string) =>
        inbox.items.find((it) => it.id === recordId),
      updateInbox: (id: string, patch: Partial<InboxItem>) =>
        inbox.update(id, patch),
    }),
    [inbox, schedules],
  );

  const presentSavedScheduleFeedback = useCallback(
    (
      scheduleId: string,
      inboxItem: InboxItem,
      fields: LaterInboxScheduleFields,
      source: string,
    ) => {
      const start = new Date(fields.start_time);
      const uiLang = lang === "en" ? "en" : "ko";
      const whenLabel = formatCaptureWhenLabel(
        start,
        Boolean(fields.all_day),
        uiLang,
      );
      const feedback: SavedScheduleFeedbackModel = {
        id: `fb-${scheduleId}`,
        scheduleId,
        title: fields.text,
        whenLabel,
      };
      savedUndoRef.current = { scheduleId, inboxItem, fields };
      setSavedFeedback(feedback);
      track("schedule_created", {
        source,
        text_length: inboxItem.text.length,
      });
      track("thought_scheduled", {
        source,
        text_length: inboxItem.text.length,
      });
      showUndoToastBase(
        t("일정으로 남겼어요", "Saved to your schedule"),
        async () => {
          const snap = savedUndoRef.current;
          if (!snap || snap.scheduleId !== scheduleId) return;
          const result = await undoScheduleToInbox(
            snap.scheduleId,
            snap.inboxItem,
            snap.fields,
            scheduleCommitOps(),
          );
          if (result.status === "ok") {
            savedUndoRef.current = null;
            setSavedFeedback(null);
            acknowledgeItem(snap.inboxItem.id);
            toast.message(t("남겨 둔 걸로 되돌렸어요", "Restored as left here"));
            return;
          }
          if (result.status === "restore_failed_schedule_recreated") {
            savedUndoRef.current = {
              scheduleId: result.scheduleId,
              inboxItem: snap.inboxItem,
              fields: snap.fields,
            };
            setSavedFeedback((prev) =>
              prev
                ? {
                    ...prev,
                    id: `fb-${result.scheduleId}`,
                    scheduleId: result.scheduleId,
                  }
                : prev,
            );
            toast.message(
              t(
                "되돌리기에 실패해 일정을 다시 남겨 두었어요",
                "Couldn't restore the note — kept the schedule",
              ),
            );
            return;
          }
          if (result.status === "remove_failed") {
            toast.error(
              t(
                "일정을 지우지 못했어요. 그대로 두었어요.",
                "Couldn't remove the schedule — left it as is.",
              ),
            );
            return;
          }
          toast.error(t("되돌리지 못했어요", "Couldn't undo"));
        },
        {
          durationMs: 6000,
          undoLabel: t("되돌리기", "Undo"),
        },
      );
    },
    [lang, scheduleCommitOps, t, acknowledgeItem],
  );

  const commitInboxSchedule = async (
    it: InboxItem,
    text: string,
    start: Date,
    end: Date,
    options: ScheduleConfirmOptions,
    source: string,
    opts?: { silentToast?: boolean; showSavedFeedback?: boolean },
  ) => {
    const fields: LaterInboxScheduleFields = {
      text,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      alarm: options.reminderMinutes !== null,
      all_day: options.allDay,
      start_all_day: options.startAllDay,
      end_all_day: options.endAllDay,
      repeat: options.repeat,
      ...(options.reminderMinutes !== null
        ? {
            alarm_at: new Date(
              start.getTime() - options.reminderMinutes * 60 * 1000,
            ).toISOString(),
          }
        : {}),
    };

    const result = await commitInboxToSchedule(it, fields, scheduleCommitOps(), {
      expectedRevision: contentRevisionOf(it),
    });
    if (result.status === "busy" || result.status === "stale_revision") return null;
    if (result.status !== "ok") {
      throw new Error(result.status);
    }

    if (opts?.showSavedFeedback) {
      presentSavedScheduleFeedback(result.scheduleId, it, fields, source);
    } else if (!opts?.silentToast) {
      track("schedule_created", { source, text_length: text.length });
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
    } else {
      track("schedule_created", { source, text_length: text.length });
      track("thought_scheduled", { source, text_length: text.length });
    }
    return result.scheduleId;
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
        const { start, end, text, options } = inboxScheduleDefaults(it);
        await commitInboxSchedule(
          it,
          text,
          start,
          end,
          options,
          "promise_card",
          { showSavedFeedback: true },
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
          t("남겨 두었어요", "Left it here"),
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
        const existing = archive.items;
        const result = await archiveInboxSafely(it);
        if (!result.ok) throw new Error(result.reason);
        const { created } = result;
        track("thought_swiped_archive", { text_length: it.text.length });
        trackNlArchiveCreated();

        const related = FEATURES.REDISCOVERY
          ? buildRevivalHint(created, existing, "archive")
          : null;
        if (related) {
          setRevivalHint(related);
        }
        if (FEATURES.REDISCOVERY && inboxRevival?.sourceId === it.id) {
          setInboxRevival(null);
        }

        track("thought_archived", { text_length: it.text.length });
        showUndoActionToast(
          t("보관함에 넣었어요", "Saved to vault"),
          async () => {
            track("undo_used");
            await archive.remove(created.id);
            await inbox.add({
              ...it,
              id: it.id,
              text: it.text,
              images: it.images,
              created_at: it.created_at,
              status: it.status ?? "active",
              raw_text: it.raw_text ?? it.text,
            });
          },
          t("보러 가기", "Take a look"),
          () => void navigate({ to: "/archive" }),
          {
            undoLabel: t("되돌리기", "Undo"),
            actionAriaLabel: t("보관함 열기", "Open vault"),
          },
        );
      } catch {
        toast.error(t("잠깐, 못 옮겼어요. 그대로 있어요", "Didn't move — still here"));
      }
    });
  };

  const moveToDelete = async (it: InboxItem) => {
    try {
      const snapshot = await deleteRecord(it.id, mutationOps());
      track("thought_swiped_delete", { text_length: it.text.length });
      if (snapshot) {
        track("thought_deleted", { text_length: it.text.length });
        showUndoToast(t("삭제했어요", "Deleted"), async () => {
          await undoDeleteRecord(snapshot, mutationOps());
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
    const replaceId = captureReplaceInboxIdRef.current;
    captureReplaceInboxIdRef.current = null;

    const isFirst = items.length === 0 && isFirstCapturePending();
    const uiLang = lang === "en" ? "en" : "ko";
    lightHaptic();
    try {
      let created: InboxItem;
      if (replaceId && items.some((it) => it.id === replaceId)) {
        const prev = items.find((it) => it.id === replaceId) as InboxItem;
        await syncRecordText(replaceId, text, mutationOps());
        await inbox.update(replaceId, { images });
        created = {
          ...prev,
          text,
          images,
          raw_text: prev.raw_text ?? prev.text,
        };
      } else {
        ({ item: created } = await inbox.add({
          text,
          images,
          raw_text: text,
          temporal_state: "no_time",
          content_revision: 0,
        }));
      }
      track("thought_created", {
        text_length: text.length,
        has_images: images.length > 0,
        image_count: images.length,
      });
      trackNlThoughtSubmitted({
        textLength: text.length,
        language: uiLang,
        source,
      });

      if (FEATURES.REDISCOVERY) {
        const revival = buildRevivalHint(created, archive.items, "inbox");
        if (revival) setInboxRevival(revival);
      }

      const decision = evaluateTimedAutoCommit(created.text, uiLang);
      const completionDraft =
        !decision.ok && decision.reason === "no_clock"
          ? buildTemporalCompletionDraft(created.text, uiLang)
          : null;
      const resolvedDraft = decision.ok ? decision.draft : completionDraft;

      if (resolvedDraft) {
        if (isFirst) markFirstCaptureDone();
        setAutoCommitInFlightIds((prev) => new Set(prev).add(created.id));
        try {
          const committed = await withNlConfirmGuard(created.id, async () => {
            await commitInboxSchedule(
              created,
              resolvedDraft.text,
              resolvedDraft.start,
              resolvedDraft.end,
              resolvedDraft.options,
              decision.ok ? "capture_auto" : "capture_completion",
              { showSavedFeedback: true },
            );
            trackNlScheduleCreated();
            acknowledgeItem(created.id);
          });
          if (!committed) {
            // In-flight guard — leave durable raw; no duplicate schedule.
          }
        } catch {
          trackNlParseFailed("commit_error");
          toast.error(
            t("그때로 못 옮겼어요", "Couldn't set that moment — try again?"),
          );
        } finally {
          setAutoCommitInFlightIds((prev) => {
            const next = new Set(prev);
            next.delete(created.id);
            return next;
          });
        }
      } else {
        if (isFirst) markFirstCaptureDone();
        if (decision.ok) return;
        const understanding = understandNaturalLanguage(created.text, uiLang);
        const completionClarification =
          decision.reason === "no_clock" &&
          understanding.intent === "schedule_clarify";
        const temporal_state = completionClarification
          ? "ambiguous"
          : temporalStateFromAutoCommitReason(decision.reason);
        await inbox.update(created.id, {
          temporal_state,
          clarification_state:
            completionClarification || isAmbiguousTemporalReason(decision.reason)
              ? "pending"
              : null,
        });
        // Quiet raw notes still get lightweight acknowledgement. Incomplete
        // temporal intent surfaces its missing decision inline instead.
        if (
          (!completionClarification && decision.reason === "no_clock") ||
          decision.reason === "date_only" ||
          decision.reason === "quiet" ||
          decision.reason === "empty_title"
        ) {
          toast.message(t("남겨뒀어요", "Left it here"), { duration: 2000 });
        }
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
            <button type="button"
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
        autoCommitInFlightIds={autoCommitInFlightIds}
        savedFeedback={savedFeedback}
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
        onEditCaptureText={(raw, itemId) => {
          captureReplaceInboxIdRef.current = itemId;
          setRestorePasteText(raw);
        }}
        onEditSavedSchedule={() => {
          if (savedFeedback?.scheduleId) {
            sessionStorage.setItem(
              "itjima.openScheduleEdit",
              savedFeedback.scheduleId,
            );
          }
          void navigate({ to: "/schedule" });
        }}
        onOpenAllRecords={() => {
          window.dispatchEvent(new Event("itjima:open-browse"));
        }}
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
        item={
          detailItem
            ? allInboxItems.find((it) => it.id === detailItem.id) ?? detailItem
            : null
        }
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        onSchedule={openHomeSchedule}
        onArchive={moveToArchive}
        onDelete={moveToDelete}
        onSaveEdit={async (item, text) => {
          await syncRecordText(item.id, text, mutationOps());
          toast.success(t("고쳤어요", "Saved your edit"));
        }}
        onClearTemporal={async (item) => {
          await syncRecordTemporal(item.id, null, mutationOps());
          toast.success(
            t("날짜·시간을 지웠어요", "Removed date & time"),
          );
        }}
      />

      {menuItem && (
        <ContextMenu
          menuItem={menuItem}
          onClose={() => setMenuFor(null)}
          onOpenCleanup={() => setCleanupReviewOpen(true)}
          onOpenAllRecords={() => {
            window.dispatchEvent(new Event("itjima:open-browse"));
          }}
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
