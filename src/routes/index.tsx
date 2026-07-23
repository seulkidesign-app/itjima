import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Wind,
  Trash2,
  Calendar,
  Archive as ArchiveIcon,
  Sparkles,
} from "lucide-react";
import { ChatSwipeRow } from "@/components/ChatSwipeRow";
import { FocusSortMode } from "@/components/FocusSortMode";
import { FocusScheduleSheet } from "@/components/FocusScheduleSheet";
import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import { LoginSheet } from "@/components/LoginSheet";
import { CleanupReviewSheet } from "@/components/CleanupReviewSheet";
import { ChatBubble } from "@/components/ChatBubble";
import { InputBar } from "@/components/InputBar";
import { CaptureRelease } from "@/components/CaptureRelease";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SyncIndicator } from "@/components/SyncIndicator";
import { EmptyState } from "@/components/EmptyState";
import { runUserOrganize } from "@/components/BrainMirrorSummary";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { detectDate } from "@/lib/dateDetect";
import { archiveFromInbox, scheduleFromInbox } from "@/lib/thoughtProvenance";
import { setRevivalHint } from "@/lib/archiveMeta";
import {
  buildRevivalHint,
  setRevivalJumpTarget,
  type RevivalHint,
} from "@/lib/memoryRevival";
import { MemoryRevivalHint } from "@/components/MemoryRevivalHint";
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
  const [focusSortOpen, setFocusSortOpen] = useState(false);
  const [focusStartId, setFocusStartId] = useState<string | null>(null);
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
  const [releaseItem, setReleaseItem] = useState<InboxItem | null>(null);
  const [releasePendingScheduleId, setReleasePendingScheduleId] = useState<
    string | null
  >(null);
  const releaseItemRef = useRef<InboxItem | null>(null);
  releaseItemRef.current = releaseItem;
  const releasePendingScheduleIdRef = useRef(releasePendingScheduleId);
  releasePendingScheduleIdRef.current = releasePendingScheduleId;
  const focusScheduleOpenRef = useRef(focusScheduleSheet.open);
  focusScheduleOpenRef.current = focusScheduleSheet.open;
  const releaseSubmittingRef = useRef(false);
  const ignoreReleasePopRef = useRef(false);
  const releaseHistoryActiveRef = useRef(false);

  const items = inbox.items;
  const menuItem = menuFor
    ? items.find((x) => x.id === menuFor)
    : undefined;
  const syncing = inbox.syncState === "syncing";
  // KakaoTalk-style: oldest at top, newest at bottom
  const itemsAsc = useMemo(() => {
    const asc = [...items].slice().reverse();
    if (!releaseItem) return asc;
    return asc.filter((it) => it.id !== releaseItem.id);
  }, [items, releaseItem]);
  const newestId = items[0]?.id;
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(items.length);
  const [inboxJustCleared, setInboxJustCleared] = useState(false);
  const [captureTyping, setCaptureTyping] = useState(false);

  useEffect(() => {
    if (prevCountRef.current > 0 && items.length === 0) {
      setInboxJustCleared(true);
    }
    if (items.length > 0) setInboxJustCleared(false);
    if (items.length > prevCountRef.current && !releaseItem) {
      requestAnimationFrame(() => {
        listEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    }
    prevCountRef.current = items.length;
  }, [items.length, releaseItem]);

  // The scroll-on-new-item effect above is gated on `!releaseItem`, so if a
  // release animation is still playing when the item count updates, that
  // scroll gets skipped. Once the release animation finishes, catch up and
  // reveal the newly landed item at the bottom (KakaoTalk-style).
  const prevReleaseItemRef = useRef(releaseItem);
  useEffect(() => {
    if (prevReleaseItemRef.current && !releaseItem) {
      requestAnimationFrame(() => {
        listEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    }
    prevReleaseItemRef.current = releaseItem;
  }, [releaseItem]);

  useEffect(() => {
    if (!releaseItem) return;
    const scroll = document.getElementById("phone-scroll");
    const prevOverflow = scroll?.style.overflow ?? "";
    const prevBody = document.body.style.overflow;
    if (scroll) scroll.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroll) scroll.style.overflow = prevOverflow;
      document.body.style.overflow = prevBody;
    };
  }, [releaseItem]);

  const clearReleaseHistory = useCallback(() => {
    if (!releaseHistoryActiveRef.current) return;
    releaseHistoryActiveRef.current = false;
    ignoreReleasePopRef.current = true;
    history.back();
  }, []);

  const completeRelease = useCallback(() => {
    const releasingId = releaseItemRef.current?.id;
    clearReleaseHistory();
    setReleaseItem(null);
    setReleasePendingScheduleId(null);
    setFocusPendingScheduleId(null);
    releaseSubmittingRef.current = false;
    if (releasingId) {
      setFocusScheduleSheet((prev) =>
        prev.item?.id === releasingId ? { open: false } : prev,
      );
    }
    maybeNudgeLogin();
    requestAnimationFrame(() => {
      if (window.matchMedia("(pointer: fine)").matches) {
        document.getElementById("capture-input")?.focus();
      }
    });
  }, [clearReleaseHistory]);

  const cancelReleaseSchedule = useCallback(() => {
    setReleasePendingScheduleId(null);
    setFocusScheduleSheet({ open: false });
    setFocusPendingScheduleId(null);
  }, []);

  const beginReleaseSchedule = useCallback((it: InboxItem) => {
    setReleasePendingScheduleId(it.id);
    setFocusScheduleSheet({ open: true, item: it });
  }, []);

  const dismissReleaseOverlay = useCallback(() => {
    if (
      releasePendingScheduleIdRef.current ||
      focusScheduleOpenRef.current
    ) {
      cancelReleaseSchedule();
      return;
    }
    completeRelease();
  }, [cancelReleaseSchedule, completeRelease]);

  useEffect(() => {
    if (!releaseItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dismissReleaseOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [releaseItem, dismissReleaseOverlay]);

  useEffect(() => {
    if (!releaseItem) return;
    history.pushState({ captureRelease: true }, "");
    releaseHistoryActiveRef.current = true;

    const onPopState = () => {
      if (ignoreReleasePopRef.current) {
        ignoreReleasePopRef.current = false;
        return;
      }
      // If the schedule sub-sheet is open, the dedicated guard below owns
      // this Back press (it calls cancelReleaseSchedule itself and manages
      // its own history entry) — bail out here to avoid both handlers
      // reacting to the same pop and pushing competing entries.
      if (focusScheduleOpenRef.current) {
        return;
      }
      if (releasePendingScheduleIdRef.current) {
        cancelReleaseSchedule();
        history.pushState({ captureRelease: true }, "");
        releaseHistoryActiveRef.current = true;
        return;
      }
      releaseHistoryActiveRef.current = false;
      completeRelease();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [releaseItem, cancelReleaseSchedule, completeRelease]);

  // The FocusScheduleSheet can also be opened directly from a ChatSwipeRow
  // swipe in the default inbox list — a separate path from `releaseItem`
  // above, which previously had no back-button guard at all. Without this,
  // pressing Back while this sheet is open falls through to real browser
  // history and can exit the app entirely (e.g. back to a search engine).
  const ignoreFocusScheduleSheetPopRef = useRef(false);
  useEffect(() => {
    if (!focusScheduleSheet.open) return;
    history.pushState({ focusScheduleSheet: true }, "");

    const onPopState = () => {
      if (ignoreFocusScheduleSheetPopRef.current) {
        ignoreFocusScheduleSheetPopRef.current = false;
        return;
      }
      // If this sheet was opened mid-release-card-flow (swiping "그때 →"
      // on the full card), cancelling must return to the card itself, not
      // just generically close the sheet.
      if (releaseItemRef.current) {
        cancelReleaseSchedule();
        return;
      }
      setFocusScheduleSheet({ open: false });
      setFocusPendingScheduleId(null);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [focusScheduleSheet.open, cancelReleaseSchedule]);

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

  const openFocusSort = (fromId?: string) => {
    setFocusStartId(fromId ?? null);
    setFocusSortOpen(true);
  };

  const openScheduleFromFocus = (it: InboxItem) => {
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
    track("schedule_created", {
      source,
      text_length: text.length,
    });
    setFocusScheduleSheet({ open: false });
    setFocusPendingScheduleId(null);
    if (releaseItemRef.current?.id === it.id) completeRelease();
    if (focusSortOpen) setScheduleCommittedId(it.id);
    if (allCloudSynced(scheduleSynced, inboxSynced)) {
      toast.success(t("그때 다시 떠올릴게요", "I'll remember this for then"));
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
        focusSortOpen && focusPendingScheduleId === it.id
          ? "focus_sort"
          : "inbox_swipe",
      );
    } catch {
      toast.error(t("일정을 남기지 못했어요", "Couldn't anchor it in time"));
      if (releaseItemRef.current?.id === it.id) cancelReleaseSchedule();
    }
  };

  const confirmReleaseScheduleQuick = async (it: InboxItem) => {
    const det = detectDate(it.text);
    if (!det) {
      beginReleaseSchedule(it);
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

      const related = buildRevivalHint(created, existing, "archive");
      if (related) {
        setRevivalHint(related);
      }
      if (inboxRevival?.sourceId === it.id) setInboxRevival(null);

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
    if (releaseItem !== null || releaseSubmittingRef.current) return;
    releaseSubmittingRef.current = true;
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

      setReleaseItem(created);

      const revival = buildRevivalHint(created, archive.items, "inbox");
      if (revival) setInboxRevival(revival);
    } catch {
      releaseSubmittingRef.current = false;
      toast.error(t("남기지 못했어요", "Couldn't keep it"));
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <SyncIndicator
        syncing={syncing}
        error={inbox.syncState === "error"}
        onRetry={inbox.retrySync}
      />
      {items.length > 0 && (
        <div className="z-20 shrink-0 border-b border-ink/[0.06] bg-white/95 backdrop-blur-md">
          <div className="flex gap-2 px-5 pb-2 pt-3">
            <button
              type="button"
              onClick={() => setCleanupReviewOpen(true)}
              className="touch-press flex-1 rounded-full border border-ink/8 bg-white py-2.5 text-[12px] font-semibold text-ink shadow-[0_1px_4px_oklch(0_0_0/0.04)]"
            >
              {t("가볍게", "Lighten")}
            </button>
            <button
              type="button"
              onClick={() => openFocusSort()}
              className="pill-yellow touch-press flex-1 py-2.5 text-[12px]"
            >
              {t("하나씩", "One by one")}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <>
          <div className="shrink-0">
            <InputBar
              hero
              releasing={!!releaseItem}
              onActivityChange={setCaptureTyping}
              onAdd={handleAdd}
              onPasteMulti={(chunks, original) =>
                setPasteSheet({ chunks, original })
              }
              restoreText={restorePasteText}
              onRestoreConsumed={() => setRestorePasteText(null)}
            />
          </div>
          {releaseItem ? (
            <CaptureRelease
              item={releaseItem}
              variant="hero"
              pendingSchedule={releasePendingScheduleId === releaseItem.id}
              onArchive={(it) => moveToArchive(it)}
              onSchedule={beginReleaseSchedule}
              onConfirmScheduleQuick={confirmReleaseScheduleQuick}
              onLetGo={(it) => moveToDelete(it)}
              onComplete={completeRelease}
            />
          ) : (
            <div
              className={`flex flex-1 flex-col justify-end pb-8 transition-opacity duration-300 ${
                captureTyping ? "opacity-[0.35]" : ""
              }`}
            >
              {inboxJustCleared ? (
                <EmptyState
                  variant="success"
                  emoji="✨"
                  titleKo="머리가 가벼워졌어요"
                  titleEn="Your mind feels lighter"
                  hintKo="오늘은 더 남길 게 없네요"
                  hintEn="Nothing left to leave here for now"
                />
              ) : (
                <EmptyState
                  titleKo="여기에 맡겨두세요"
                  titleEn="Leave it here"
                  hintKo="적고 Enter — 더 이상 기억하지 않아도 돼요"
                  hintEn="Type and Enter — you don't have to remember anymore"
                />
              )}
            </div>
          )}
          <InstallPrompt />
        </>
      ) : (
        <>
          <div
            className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-2 transition-opacity duration-700 ease-out ${
              releaseItem ? "opacity-[0.18] pointer-events-none" : ""
            }`}
          >
            <div className="chat-scroll flex w-full flex-col gap-2 pb-4">
              {itemsAsc.map((it) => {
                const isNewest = it.id === newestId;
                return (
                  <ChatBubble
                    key={it.id}
                    item={it}
                    isNewest={isNewest}
                    wrapBubble={(bubble) => (
                      <ChatSwipeRow
                        rowId={it.id}
                        openRowId={swipeOpenId}
                        onOpenRowChange={setSwipeOpenId}
                        onSwipeRight={() => openHomeSchedule(it)}
                        onSwipeLeft={() => moveToArchive(it)}
                        onLongPress={() => setMenuFor(it.id)}
                      >
                        {bubble}
                      </ChatSwipeRow>
                    )}
                  >
                    {inboxRevival?.sourceId === it.id && (
                      <MemoryRevivalHint
                        hint={inboxRevival}
                        compact
                        delayMs={900}
                        onRevisit={revisitArchiveMemory}
                        onDismiss={() => setInboxRevival(null)}
                      />
                    )}
                  </ChatBubble>
                );
              })}
              <div ref={listEndRef} />
            </div>
          </div>

          {releaseItem && (
            <CaptureRelease
              item={releaseItem}
              variant="overlay"
              pendingSchedule={releasePendingScheduleId === releaseItem.id}
              onArchive={(it) => moveToArchive(it)}
              onSchedule={beginReleaseSchedule}
              onConfirmScheduleQuick={confirmReleaseScheduleQuick}
              onLetGo={(it) => moveToDelete(it)}
              onComplete={completeRelease}
            />
          )}

          <InstallPrompt />
          <div className="z-20 shrink-0 border-t border-ink/[0.06] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
            <InputBar
              releasing={!!releaseItem}
              onAdd={handleAdd}
              onPasteMulti={(chunks, original) =>
                setPasteSheet({ chunks, original })
              }
              restoreText={restorePasteText}
              onRestoreConsumed={() => setRestorePasteText(null)}
            />
          </div>
        </>
      )}

      {/* Context menu */}
      {menuItem && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          onClick={() => setMenuFor(null)}
        >
          <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
          <div
            className="glass-strong animate-slide-up mx-5 mb-[100px] rounded-[24px] p-2 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem
              icon={<Wind size={18} />}
              label={t("가볍게 비우기", "Lighten up")}
              onClick={() => {
                setMenuFor(null);
                setCleanupReviewOpen(true);
              }}
            />
            <MenuItem
              icon={<Sparkles size={18} />}
              label={t("다시 이해하기", "Understand again")}
              onClick={() => {
                const target = menuItem;
                setMenuFor(null);
                if (!target) return;
                void (async () => {
                  const mirror = await runUserOrganize(target, inbox);
                  if (mirror) {
                    haptic([4, 8, 5]);
                  } else {
                    toast.message(
                      t("지금은 정리하지 못했어요", "Couldn't organize right now"),
                      { duration: 2800 },
                    );
                  }
                })();
              }}
            />
            <MenuItem
              icon={<Calendar size={18} />}
              label={t("할 일로 보내기", "Send to tasks")}
              onClick={() => {
                setMenuFor(null);
                openHomeSchedule(menuItem);
              }}
            />
            <MenuItem
              icon={<ArchiveIcon size={18} />}
              label={t("생각 지도에 남기기", "Save to thought map")}
              onClick={() => {
                setMenuFor(null);
                moveToArchive(menuItem);
              }}
            />
            <MenuItem
              icon={<Trash2 size={18} />}
              label={t("삭제하기", "Delete")}
              danger
              onClick={() => {
                setMenuFor(null);
                void moveToDelete(menuItem);
              }}
            />
          </div>
        </div>
      )}

      {/* Paste sheet */}
      {pasteSheet && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setRestorePasteText(pasteSheet.original);
            setPasteSheet(null);
          }}
        >
          <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
          <div
            className="glass-strong animate-slide-up rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
            <div className="text-[17px] font-bold text-ink">
              {t(
                "붙여넣은 글, 어떻게 남길까요?",
                "How should we keep this pasted text?",
              )}
            </div>
            <div className="mt-1 text-sm text-ink-soft">
              {t(
                `${pasteSheet.chunks.length}줄이에요.`,
                `${pasteSheet.chunks.length} lines here.`,
              )}
            </div>
            <button
              onClick={async () => {
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
              className="mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink"
            >
              {t("나눠서 남기기", "Keep separately")}
            </button>
            <button
              onClick={async () => {
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
              className="mt-2 w-full rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink"
            >
              {t("한 덩어리로 남기기", "Keep as one")}
            </button>
          </div>
        </div>
      )}

      <FocusSortMode
        open={focusSortOpen}
        startItemId={focusStartId}
        items={items}
        pendingScheduleId={focusPendingScheduleId}
        scheduleCommittedId={scheduleCommittedId}
        onScheduleCommitHandled={() => setScheduleCommittedId(null)}
        onClose={() => {
          setFocusSortOpen(false);
          setFocusStartId(null);
          setFocusPendingScheduleId(null);
          setFocusScheduleSheet({ open: false });
        }}
        onScheduleRequest={openScheduleFromFocus}
        onArchive={(it) => moveToArchive(it)}
      />

      <FocusScheduleSheet
        item={focusScheduleSheet.item ?? null}
        open={focusScheduleSheet.open}
        onClose={() => {
          if (
            releaseItemRef.current &&
            focusScheduleSheet.item?.id === releaseItemRef.current.id
          ) {
            cancelReleaseSchedule();
            return;
          }
          if (!releaseItem) {
            ignoreFocusScheduleSheetPopRef.current = true;
            history.back();
          }
          setFocusScheduleSheet({ open: false });
          setFocusPendingScheduleId(null);
          setReleasePendingScheduleId(null);
        }}
        onConfirm={(text, start, end, options) => {
          void saveHomeSchedule(text, start, end, options);
        }}
      />

      <CleanupReviewSheet
        open={cleanupReviewOpen}
        items={items}
        onClose={() => setCleanupReviewOpen(false)}
        onConfirmDelete={confirmCleanupDelete}
      />

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-[15px] font-medium min-h-11 ${
        danger ? "text-meta" : "text-ink"
      } hover:bg-white/60`}
    >
      {icon}
      {label}
    </button>
  );
}
