import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Wind,
  Trash2,
  Calendar,
  Archive as ArchiveIcon,
} from "lucide-react";
import { InboxListSkeleton } from "@/components/Skeleton";
import { ChatSwipeRow } from "@/components/ChatSwipeRow";
import { FocusSortMode } from "@/components/FocusSortMode";
import { FocusScheduleSheet } from "@/components/FocusScheduleSheet";
import { LoginSheet } from "@/components/LoginSheet";
import { CleanupReviewSheet } from "@/components/CleanupReviewSheet";
import { detectJunk } from "@/lib/junkDetect";
import { ChatBubble } from "@/components/ChatBubble";
import { InputBar } from "@/components/InputBar";
import { SyncIndicator } from "@/components/SyncIndicator";
import { EmptyState } from "@/components/EmptyState";
import { BrainMirrorPanel } from "@/components/BrainMirrorSummary";
import {
  isBrainMirrorCandidate,
  type BrainMirrorResult,
} from "@/lib/brainMirror";
import { archiveFromInbox, scheduleFromInbox } from "@/lib/thoughtProvenance";
import { setRevivalHint } from "@/lib/archiveMeta";
import { findStronglyRelatedMemories } from "@/lib/memoryDiscovery";
import {
  useInbox,
  useSchedules,
  useArchive,
  useUserId,
  getUsageCount,
  isLoginDismissed,
  type InboxItem,
} from "@/lib/store";
import { detectDate } from "@/lib/dateDetect";
import { useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";

export const Route = createFileRoute("/")({
  component: Inbox,
});

function Inbox() {
  const t = useT();
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
  const [bmEligibleIds, setBmEligibleIds] = useState<Set<string>>(
    () => new Set(),
  );

  const markBmEligible = (id: string) => {
    setBmEligibleIds((prev) => new Set(prev).add(id));
  };

  const offerDateSchedule = (item: InboxItem) => {
    const det = detectDate(item.text);
    if (!det) return;
    toast.custom(
      (toastId) => (
        <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
          <div className="text-sm">
            📅 {det.label} — {t("그때 다시 떠올릴까요?", "Remember this for then?")}
          </div>
          <button
            onClick={() => {
              openHomeSchedule(item);
              toast.dismiss(toastId);
            }}
            className={toastBtn}
          >
            {t("남겨둘게요", "Keep it")}
          </button>
        </div>
      ),
      { duration: 6000 },
    );
  };

  const items = inbox.items;
  const syncing = inbox.syncState === "syncing";
  // KakaoTalk-style: oldest at top, newest at bottom
  const itemsAsc = useMemo(() => [...items].slice().reverse(), [items]);
  const newestId = items[0]?.id;
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(items.length);
  const [inboxJustCleared, setInboxJustCleared] = useState(false);

  useEffect(() => {
    if (prevCountRef.current > 0 && items.length === 0) {
      setInboxJustCleared(true);
    }
    if (items.length > 0) setInboxJustCleared(false);
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

  const toastBtn =
    "touch-target shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-ink";

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

  const saveHomeSchedule = async (
    text: string,
    start: Date,
    end: Date,
    alarmMinutesBefore: number | null,
  ) => {
    const it = focusScheduleSheet.item;
    if (!it) return;
    try {
      const payload = scheduleFromInbox(it, {
        text,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        alarm: alarmMinutesBefore !== null,
      });
      await schedules.add({
        ...payload,
        ...(alarmMinutesBefore !== null
          ? {
              alarm_at: new Date(
                start.getTime() - alarmMinutesBefore * 60 * 1000,
              ).toISOString(),
            }
          : {}),
      });
      await inbox.remove(it.id);
      track("schedule_created", {
        source:
          focusSortOpen && focusPendingScheduleId === it.id
            ? "focus_sort"
            : "inbox_swipe",
        text_length: text.length,
      });
      setFocusScheduleSheet({ open: false });
      setFocusPendingScheduleId(null);
      if (focusSortOpen) setScheduleCommittedId(it.id);
      toast.success(t("그때 다시 떠올릴게요", "I'll remember this for then"));
    } catch {
      toast.error(t("일정을 저장하지 못했어요", "Couldn't save schedule"));
    }
  };

  const moveToArchive = async (it: InboxItem) => {
    try {
      const payload = archiveFromInbox(it);
      const existing = archive.items;
      const { item: created } = await archive.add(payload);
      await inbox.remove(it.id);
      track("thought_swiped_archive", { text_length: it.text.length });

      const related = findStronglyRelatedMemories(created, existing);
      if (related.length > 0) {
        setRevivalHint({
          newId: created.id,
          relatedIds: related.map((r) => r.item.id),
          at: Date.now(),
        });
      }

      showUndoToast(t("기억함에 남겨뒀어요", "Safely kept here"), async () => {
        await archive.remove(created.id);
        const { item: restored } = await inbox.add({
          text: payload.text,
          images: payload.images,
          brain_mirror: payload.brain_mirror,
        });
        markBmEligible(restored.id);
      });
    } catch {
      toast.error(t("남기지 못했어요", "Couldn't save it here"));
    }
  };

  const moveToDelete = async (it: InboxItem) => {
    try {
      await inbox.softDelete(it.id);
      track("thought_swiped_delete", { text_length: it.text.length });
      showUndoToast(t("지웠어요", "Removed"), async () => {
        await inbox.update(it.id, { status: "active" } as Partial<InboxItem>);
        if (isBrainMirrorCandidate(it.text)) markBmEligible(it.id);
      });
    } catch {
      toast.error(t("삭제하지 못했어요", "Couldn't delete"));
    }
  };

  const autoScheduleFromMirror = async (
    item: InboxItem,
    result: BrainMirrorResult,
  ): Promise<string | null> => {
    const det =
      detectDate(item.text) ??
      (result.suggestedDateText ? detectDate(result.suggestedDateText) : null);
    if (!det) return null;

    const start = det.start;
    const end = det.end;
    const text = formatMirrorScheduleText(item.text, result);
    const snapshot = {
      text: item.text,
      images: item.images ?? [],
      brain_mirror: item.brain_mirror ?? result,
    };

    const { item: created } = await schedules.add(
      scheduleFromInbox(item, {
        text,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      }),
    );
    await inbox.remove(item.id);
    track("schedule_created", {
      source: "brain_mirror",
      text_length: text.length,
    });

    toast.custom(
      (toastId) => (
        <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
          <div className="text-sm">
            📅 {t("그때를 기억함에 옮겼어요", "Moved to when you'll remember")}
          </div>
          <button
            onClick={async () => {
              await schedules.remove(created.id);
              const { item: restored } = await inbox.add({
                text: snapshot.text,
                images: snapshot.images,
                brain_mirror: snapshot.brain_mirror,
              });
              markBmEligible(restored.id);
              toast.dismiss(toastId);
            }}
            className={toastBtn}
          >
            {t("되돌리기", "Undo")}
          </button>
        </div>
      ),
      { duration: 8000 },
    );

    return created.id;
  };

  const cancelMirrorSchedule = async (scheduleId: string) => {
    await schedules.remove(scheduleId);
  };

  const confirmCleanupDelete = async (ids: string[]) => {
    try {
      for (const id of ids) await inbox.softDelete(id);
      toast.success(t("가벼워졌어요", "Feels lighter now"));
    } catch {
      toast.error(t("비우지 못했어요", "Couldn't lighten up"));
    }
  };

  const handleAdd = async (text: string, images: string[]) => {
    if (!text && !images.length) return;
    haptic([6, 16, 10]);
    try {
      const { item: created, cloudSynced } = await inbox.add({
        text,
        images,
      });
      if (isBrainMirrorCandidate(text)) {
        markBmEligible(created.id);
      }
      track("thought_created", {
        text_length: text.length,
        has_images: images.length > 0,
        image_count: images.length,
      });
      if (cloudSynced) return;
      toast.success(
        t("여기에 안전하게 남았어요", "Safely kept on this device"),
        { duration: 2500 },
      );
      if (!isBrainMirrorCandidate(text)) {
        offerDateSchedule(created);
      }
      maybeNudgeLogin();
    } catch {
      toast.error(t("저장하지 못했어요", "Couldn't save"));
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
    <div className="flex h-full min-h-full flex-col bg-white">
      <SyncIndicator
        syncing={syncing}
        error={inbox.syncState === "error"}
        onRetry={inbox.retrySync}
      />
      {items.length > 0 && (
        <div className="sticky top-0 z-10 shrink-0 bg-white/95 backdrop-blur-sm">
          <div className="flex gap-2 px-5 pb-2 pt-3">
            <button
              type="button"
              onClick={() => {
                if (detectJunk(items).length === 0) {
                  toast.message(
                    t(
                      "지금은 비울 게 없어요",
                      "Nothing to lighten right now",
                    ),
                  );
                  return;
                }
                setCleanupReviewOpen(true);
              }}
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
              onAdd={handleAdd}
              onPasteMulti={(chunks, original) =>
                setPasteSheet({ chunks, original })
              }
              restoreText={restorePasteText}
              onRestoreConsumed={() => setRestorePasteText(null)}
            />
          </div>
          <div className="flex flex-1 flex-col justify-end pb-8">
            {syncing ? (
              <InboxListSkeleton />
            ) : inboxJustCleared ? (
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
                emoji="✍️"
                titleKo="여기에 남겨두세요"
                titleEn="Leave it here"
                hintKo="적고 Enter — 이제 잊어도 돼요"
                hintEn="Type and Enter — you don't have to hold it anymore"
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 px-3 pb-2">
            <div className="chat-scroll flex flex-col items-stretch gap-2 pb-4">
              {itemsAsc.map((it) => {
                const isNewest = it.id === newestId;
                return (
                  <ChatSwipeRow
                    key={it.id}
                    rowId={it.id}
                    openRowId={swipeOpenId}
                    onOpenRowChange={setSwipeOpenId}
                    onSwipeRight={() => openHomeSchedule(it)}
                    onSwipeLeft={() => moveToArchive(it)}
                    onSwipeDown={() => moveToDelete(it)}
                    onLongPress={() => setMenuFor(it.id)}
                    onTap={() => openFocusSort(it.id)}
                  >
                    <ChatBubble item={it} isNewest={isNewest}>
                      {it.text.trim().length >= 2 && (
                        <BrainMirrorPanel
                          item={it}
                          inbox={inbox}
                          eligible={
                            bmEligibleIds.has(it.id) &&
                            isBrainMirrorCandidate(it.text)
                          }
                          onAutoAct={autoScheduleFromMirror}
                          onCancelAct={cancelMirrorSchedule}
                          onMirrorMissed={offerDateSchedule}
                          variant="inline"
                        />
                      )}
                    </ChatBubble>
                  </ChatSwipeRow>
                );
              })}
              <div ref={listEndRef} />
            </div>
          </div>

          <div className="sticky bottom-0 z-20 shrink-0 pb-[env(safe-area-inset-bottom)]">
            <InputBar
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
      {menuFor && (
        <div
          className="absolute inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          onClick={() => setMenuFor(null)}
        >
          <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
          <div
            className="glass-strong animate-slide-up mx-5 mb-[100px] rounded-[24px] p-2 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const it = items.find((x) => x.id === menuFor);
              if (!it) return null;
              return (
                <>
                  <MenuItem
                    icon={<Wind size={18} />}
                    label={t("가볍게 비우기", "Lighten up")}
                    onClick={() => {
                      setMenuFor(null);
                      if (detectJunk(items).length === 0) {
                        toast.message(
                          t(
                            "지금은 비울 게 없어요",
                            "Nothing to lighten right now",
                          ),
                        );
                        return;
                      }
                      setCleanupReviewOpen(true);
                    }}
                  />
                  <MenuItem
                    icon={<Calendar size={18} />}
                    label={t("그때 기억하기", "Remember for then")}
                    onClick={() => {
                      setMenuFor(null);
                      openHomeSchedule(it);
                    }}
                  />
                  <MenuItem
                    icon={<ArchiveIcon size={18} />}
                    label={t("기억함에 남기기", "Keep here")}
                    onClick={() => {
                      setMenuFor(null);
                      moveToArchive(it);
                    }}
                  />
                  <MenuItem
                    icon={<Trash2 size={18} />}
                    label={t("삭제", "Delete")}
                    danger
                    onClick={() => {
                      setMenuFor(null);
                      void moveToDelete(it);
                    }}
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Paste sheet */}
      {pasteSheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col"
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
                    const { item } = await inbox.add({
                      text: c,
                      images: [],
                    });
                    if (isBrainMirrorCandidate(c)) markBmEligible(item.id);
                  }
                  setPasteSheet(null);
                  toast.success(
                    t(
                      `${pasteSheet.chunks.length}개로 나눠 남겼어요`,
                      `Kept as ${pasteSheet.chunks.length} separate thoughts`,
                    ),
                  );
                } catch {
                  toast.error(t("저장하지 못했어요", "Couldn't save"));
                }
              }}
              className="mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink"
            >
              {t("나눠서 남기기", "Keep separately")}
            </button>
            <button
              onClick={async () => {
                const { item } = await inbox.add({
                  text: pasteSheet.original,
                  images: [],
                });
                if (isBrainMirrorCandidate(pasteSheet.original)) {
                  markBmEligible(item.id);
                }
                setPasteSheet(null);
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
        onSoftDelete={(it) => moveToDelete(it)}
      />

      <FocusScheduleSheet
        item={focusScheduleSheet.item ?? null}
        open={focusScheduleSheet.open}
        onClose={() => {
          setFocusScheduleSheet({ open: false });
          setFocusPendingScheduleId(null);
        }}
        onConfirm={(text, start, end, alarmMin) => {
          void saveHomeSchedule(text, start, end, alarmMin);
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

function formatMirrorScheduleText(
  original: string,
  result: BrainMirrorResult,
): string {
  const lines = [result.title, ...result.items.map((line) => `- ${line}`)];
  const text = lines.join("\n").trim();
  return text || original;
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
