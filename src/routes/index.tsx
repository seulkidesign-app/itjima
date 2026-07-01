import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Sparkles, Trash2, Calendar, Archive as ArchiveIcon } from "lucide-react";
import { InputBar } from "@/components/InputBar";
import { SwipeCard } from "@/components/SwipeCard";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { LoginSheet } from "@/components/LoginSheet";
import { CleanupBar } from "@/components/FocusMode";
import { useOrganizeFx } from "@/components/AIOrganize";
import { BrainMirrorPanel } from "@/components/BrainMirrorSummary";
import { isBrainMirrorCandidate, type BrainMirrorResult } from "@/lib/brainMirror";
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
import { useT, useLang } from "@/lib/i18n";
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

  const [scheduleSheet, setScheduleSheet] = useState<{ open: boolean; item?: InboxItem; date?: Date }>({
    open: false,
  });
  const [loginOpen, setLoginOpen] = useState(false);
  
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pasteSheet, setPasteSheet] = useState<{ chunks: string[]; original: string } | null>(null);
  const pressTimer = useRef<number | null>(null);

  const items = inbox.items;
  // KakaoTalk-style: oldest at top, newest at bottom
  const itemsAsc = [...items].slice().reverse();
  const newestId = items[0]?.id;
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(items.length);

  useEffect(() => {
    if (items.length > prevCountRef.current) {
      // new item added → scroll to bottom
      requestAnimationFrame(() => {
        listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
    prevCountRef.current = items.length;
  }, [items.length]);

  const moveToSchedule = async (it: InboxItem, start?: Date, end?: Date) => {
    const s = start ?? new Date();
    const e = end ?? new Date(s.getTime() + 60 * 60 * 1000);
    await schedules.add({
      text: it.text,
      start_time: s.toISOString(),
      end_time: e.toISOString(),
      alarm: false,
    } as any);
    await inbox.remove(it.id);
    track("thought_swiped_schedule", { text_length: it.text.length });
    toast.success(t("일정으로 옮겼어요", "Moved to schedule"));
  };
  const moveToArchive = async (it: InboxItem) => {
    await archive.add({ text: it.text, images: it.images } as any);
    await inbox.remove(it.id);
    track("thought_swiped_archive", { text_length: it.text.length });
    toast.success(t("보관함에 넣었어요", "Added to archive"));
  };

  const autoScheduleFromMirror = async (
    item: InboxItem,
    result: BrainMirrorResult,
  ): Promise<string | null> => {
    const det =
      detectDate(item.text) ??
      (result.suggestedDateText ? detectDate(result.suggestedDateText) : null);
    const start = det?.start ?? new Date();
    const end = det?.end ?? new Date(start.getTime() + 60 * 60 * 1000);
    const text = formatMirrorScheduleText(item.text, result);
    const created = await schedules.add({
      text,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      alarm: false,
    } as any);
    track("schedule_created", { source: "brain_mirror", text_length: text.length });
    return created.id;
  };

  const cancelMirrorSchedule = async (scheduleId: string) => {
    await schedules.remove(scheduleId);
  };

  const toggleKeep = (id: string) => {
    setKeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitCleanup = () => {
    setCleanupOpen(false);
    setKeepIds(new Set());
  };

  const deleteUnkept = async () => {
    const toDelete = items.filter((it) => !keepIds.has(it.id));
    for (const it of toDelete) await inbox.remove(it.id);
    exitCleanup();
  };

  const handleAdd = async (text: string, images: string[]) => {
    if (!text && !images.length) return;
    haptic([6, 16, 10]);
    await inbox.add({ text, images } as any);
    track("thought_created", {
      text_length: text.length,
      has_images: images.length > 0,
      image_count: images.length,
    });
    toast.success(t("인박스에 담았어요", "Saved to your inbox"), { duration: 1500 });
    // Brain Mirror handles date-like thoughts — skip duplicate date toast
    if (!isBrainMirrorCandidate(text)) {
      const det = detectDate(text);
      if (det) {
        toast.custom(
          (id) => (
            <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
              <div className="text-sm">📅 {det.label} — {t("일정으로 등록할까요?", "Add as a schedule?")}</div>
              <button
                onClick={() => {
                  const latest = items[0] ?? { id: "", text, images, created_at: "" };
                  setScheduleSheet({ open: true, item: latest, date: det.start });
                  toast.dismiss(id);
                }}
                className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-ink"
              >
                {t("등록", "Add")}
              </button>
            </div>
          ),
          { duration: 6000 },
        );
      }
    }
    maybeNudgeLogin();
  };

  const handleQuick = async (text: string, images: string[]) => {
    if (!text && !images.length) return;
    haptic(6);
    await inbox.add({ text, images } as any);
    toast.success(t("인박스에 담았어요", "Saved to your inbox"), { duration: 1200 });
    maybeNudgeLogin();
  };

  const maybeNudgeLogin = () => {
    if (userId) return;
    if (isLoginDismissed()) return;
    const u = getUsageCount();
    if (u === 3) {
      toast.custom(
        (id) => (
          <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
            <div className="text-sm">💾 {t("다른 기기에서도 이어가려면 로그인하세요", "Sign in to keep your thoughts on other devices")}</div>
            <button
              onClick={() => {
                setLoginOpen(true);
                toast.dismiss(id);
              }}
              className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-ink"
            >
              {t("로그인", "Sign in")}
            </button>
          </div>
        ),
        { duration: 6000 },
      );
    }
  };

  const startLongPress = (id: string) => {
    pressTimer.current = window.setTimeout(() => setMenuFor(id), 500);
  };
  const cancelLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div className="flex h-full min-h-full flex-col bg-white">
      {/* NRC-style hero block */}
      <div className="px-5 pb-3 pt-6">
        <div className="nrc-eyebrow">{t("오늘의 인박스", "Today's Inbox")}</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="page-title">
            {items.length > 0
              ? t("생각 정리하기", "Clear Your Mind")
              : t("던져보세요", "Drop A Thought")}
          </h1>
          <div className="text-right leading-none">
            <div className="font-num text-[40px] text-ink">{items.length}</div>
            <div className="nrc-eyebrow mt-0.5">{t("개", "Notes")}</div>
          </div>
        </div>
      </div>

      {/* Sort mode pill */}
      {items.length >= 2 && (
        <div className="px-5 pb-2">
          <button
            onClick={() => {
              if (cleanupOpen) exitCleanup();
              else setCleanupOpen(true);
            }}
            className={`pill-ghost inline-flex items-center gap-1.5 ${
              cleanupOpen ? "ring-2 ring-primary" : ""
            }`}
          >
            <Sparkles size={14} /> {t("정리 모드", "Focus mode")}
          </button>
        </div>
      )}


      {/* Cards */}
      <div className="flex-1 px-5 pb-20">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {itemsAsc.map((it) => {
              const isNewest = it.id === newestId;
              const kept = keepIds.has(it.id);
              return (
                <OrganizeFxWrapper key={it.id} id={it.id} fallback={isNewest ? "animate-pop" : "animate-fade-in"}>
                  <div
                    className={`rounded-[24px] transition-all duration-200 ${
                      cleanupOpen
                        ? kept
                          ? "cursor-pointer opacity-100 ring-2 ring-primary"
                          : "cursor-pointer opacity-40"
                        : ""
                    }`}
                    onClick={cleanupOpen ? () => toggleKeep(it.id) : undefined}
                  >
                    <SwipeCard
                      disabled={cleanupOpen}
                      onSwipe={(dir) =>
                        dir === "right"
                          ? setScheduleSheet({ open: true, item: it })
                          : moveToArchive(it)
                      }
                    >
                      <CardBody
                        item={it}
                        big={isNewest}
                        inbox={inbox}
                        onAutoAct={autoScheduleFromMirror}
                        onCancelAct={cancelMirrorSchedule}
                        onLongPressStart={cleanupOpen ? undefined : startLongPress}
                        onLongPressEnd={cleanupOpen ? undefined : cancelLongPress}
                      />
                    </SwipeCard>
                  </div>
                </OrganizeFxWrapper>
              );
            })}
            <div ref={listEndRef} />
          </div>
        )}
      </div>


      {/* Input */}
      <div className="sticky bottom-0 z-20 pb-[env(safe-area-inset-bottom)]">
        {cleanupOpen && (
          <CleanupBar
            deleteCount={items.length - keepIds.size}
            onCancel={exitCleanup}
            onDelete={deleteUnkept}
          />
        )}
        <InputBar
          onAdd={handleAdd}
          onQuickSave={handleQuick}
          onPasteMulti={(chunks, original) => setPasteSheet({ chunks, original })}
        />
      </div>

      {/* Context menu */}
      {menuFor && (
        <div className="absolute inset-0 z-50 flex flex-col" onClick={() => setMenuFor(null)}>
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
                    icon={<Calendar size={18} />}
                    label={t("일정으로", "To schedule")}
                    onClick={() => {
                      setMenuFor(null);
                      setScheduleSheet({ open: true, item: it });
                    }}
                  />
                  <MenuItem
                    icon={<ArchiveIcon size={18} />}
                    label={t("보관하기", "Archive")}
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
                      inbox.remove(it.id);
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
        <div className="absolute inset-0 z-50 flex flex-col" onClick={() => setPasteSheet(null)}>
          <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
          <div
            className="glass-strong animate-slide-up rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
            <div className="text-[17px] font-bold text-ink">{t("붙여넣은 텍스트를 어떻게 할까요?", "What to do with the pasted text?")}</div>
            <div className="mt-1 text-sm text-ink-soft">{t(`${pasteSheet.chunks.length}개 줄이 감지됐어요.`, `${pasteSheet.chunks.length} lines detected.`)}</div>
            <button
              onClick={async () => {
                for (const c of pasteSheet.chunks) await inbox.add({ text: c, images: [] } as any);
                setPasteSheet(null);
                toast.success(t(`${pasteSheet.chunks.length}개로 나눠 담았어요`, `Split into ${pasteSheet.chunks.length} items`));
              }}
              className="mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink"
            >
              {t("항목별로 나누기", "Split into items")}
            </button>
            <button
              onClick={async () => {
                await inbox.add({ text: pasteSheet.original, images: [] } as any);
                setPasteSheet(null);
              }}
              className="mt-2 w-full rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink"
            >
              {t("한 덩어리로", "Keep as one")}
            </button>
          </div>
        </div>
      )}

      {scheduleSheet.open && scheduleSheet.item && (
        <ScheduleSheet
          open
          initialText={scheduleSheet.item.text}
          initialStart={scheduleSheet.date}
          onClose={() => setScheduleSheet({ open: false })}
          onSave={async (text, start, end, opts) => {
            await schedules.add({
              text,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              alarm: false,
              all_day: opts?.allDay ?? false,
              repeat: opts?.repeat ?? null,
            } as any);
            await inbox.remove(scheduleSheet.item!.id);
            track("schedule_created", { source: "inbox_swipe", text_length: text.length });
            setScheduleSheet({ open: false });
            toast.success(t("일정으로 등록됐어요", "Scheduled"));
          }}
        />
      )}

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function CardBody({
  item,
  big,
  inbox,
  onAutoAct,
  onCancelAct,
  onLongPressStart,
  onLongPressEnd,
}: {
  item: InboxItem;
  big?: boolean;
  inbox: ReturnType<typeof useInbox>;
  onAutoAct: (item: InboxItem, result: BrainMirrorResult) => Promise<string | null>;
  onCancelAct: (scheduleId: string) => Promise<void>;
  onLongPressStart?: (id: string) => void;
  onLongPressEnd?: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";
  return (
    <div
      className="px-[22px] py-5"
      onPointerDown={() => onLongPressStart?.(item.id)}
      onPointerUp={onLongPressEnd}
      onPointerLeave={onLongPressEnd}
    >
      {item.images?.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img key={i} src={src} alt="" className={`rounded-[24px] object-cover ${big ? "h-24 w-24" : "h-14 w-14"}`} />
          ))}
        </div>
      )}
      <p className="card-text whitespace-pre-wrap text-ink">
        {item.text || t("(이미지만)", "(image only)")}
      </p>
      {item.brain_mirror || isBrainMirrorCandidate(item.text) ? (
        <BrainMirrorPanel
          item={item}
          inbox={inbox}
          onAutoAct={onAutoAct}
          onCancelAct={onCancelAct}
        />
      ) : null}
      <div className="mt-3 flex items-center justify-between text-meta">
        <span>{new Date(item.created_at).toLocaleString(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        <MoreHorizontal size={14} />
      </div>
    </div>
  );
}

function formatMirrorScheduleText(original: string, result: BrainMirrorResult): string {
  const lines = [result.title, ...result.items.map((line) => `- ${line}`)];
  const text = lines.join("\n").trim();
  return text || original;
}

function EmptyState() {
  const t = useT();
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl">💭</div>
      <div className="mt-3 text-[17px] font-bold text-ink">{t("텅 비었어요", "Empty for now")}</div>
      <div className="mt-1 text-sm text-ink-soft">
        {t("지금 떠오르는 생각을 아래에 던져 보세요. 오른쪽으로 밀면 일정, 왼쪽으로 밀면 보관.",
          "Throw a thought into the box below. Swipe right to schedule, left to archive.")}
      </div>
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
      className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-[15px] font-medium ${
        danger ? "text-meta" : "text-ink"
      } hover:bg-white/60`}
    >
      {icon}
      {label}
    </button>
  );
}

function OrganizeFxWrapper({ id, fallback, children }: { id: string; fallback: string; children: React.ReactNode }) {
  const fx = useOrganizeFx(id);
  const flyClass = fx.flying === "schedule"
    ? "translate-x-[120vw] -translate-y-[60vh] rotate-12 opacity-0"
    : fx.flying === "archive"
    ? "translate-x-[120vw] translate-y-[60vh] -rotate-6 opacity-0"
    : "";
  const glowClass = fx.glow === "schedule"
    ? "ring-2 ring-[#FFD233]/40 shadow-[0_4px_16px_-4px_rgba(255,210,51,0.35)]"
    : fx.glow === "archive"
    ? "ring-2 ring-[#9A9A90]/35 shadow-[0_4px_16px_-4px_rgba(154,154,144,0.20)]"
    : "";
  return (
    <div
      className={`rounded-[24px] transition-all duration-500 ease-out ${fx.flying ? "" : fallback} ${glowClass} ${flyClass}`}
    >
      {children}
    </div>
  );
}
