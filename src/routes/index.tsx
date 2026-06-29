import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, Calendar, Archive as ArchiveIcon } from "lucide-react";
import { InputBar } from "@/components/InputBar";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { LoginSheet } from "@/components/LoginSheet";
import { BrainMirrorPanel } from "@/components/BrainMirrorSummary";
import {
  useInbox,
  useSchedules,
  useArchive,
  useUserId,
  getUsageCount,
  isLoginDismissed,
  type InboxItem,
  type BrainMirrorResult,
} from "@/lib/store";
import { detectDate } from "@/lib/dateDetect";
import { useT, useLang } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";

export const Route = createFileRoute("/")({
  component: Stream,
});

function Stream() {
  const t = useT();
  const inbox = useInbox();
  const schedules = useSchedules();
  const archive = useArchive();
  const userId = useUserId();

  const [scheduleSheet, setScheduleSheet] = useState<{ open: boolean; item?: InboxItem; date?: Date }>({
    open: false,
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pasteSheet, setPasteSheet] = useState<{ chunks: string[]; original: string } | null>(null);
  const pressTimer = useRef<number | null>(null);

  const items = inbox.items;
  const itemsAsc = [...items].slice().reverse();
  const newestId = items[0]?.id;
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(items.length);

  useEffect(() => {
    if (items.length > prevCountRef.current) {
      requestAnimationFrame(() => {
        listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
    prevCountRef.current = items.length;
  }, [items.length]);

  const moveToMemory = async (it: InboxItem) => {
    await archive.add({ text: it.text, images: it.images } as any);
    await inbox.remove(it.id);
    track("thought_to_memory", { text_length: it.text.length });
    haptic([4, 12, 6]);
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
    maybeNudgeLogin();
  };

  const maybeNudgeLogin = () => {
    if (userId) return;
    if (isLoginDismissed()) return;
    const u = getUsageCount();
    if (u === 5) {
      toast.custom(
        (id) => (
          <div className="flex items-center gap-3 rounded-2xl bg-ink/95 px-4 py-3 text-white shadow-float">
            <div className="text-sm">
              {t("다른 기기에서도 이어갈까요?", "Continue on another device?")}
            </div>
            <button
              onClick={() => {
                setLoginOpen(true);
                toast.dismiss(id);
              }}
              className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-ink"
            >
              {t("이어가기", "Continue")}
            </button>
          </div>
        ),
        { duration: 8000 },
      );
    }
  };

  const startLongPress = (id: string) => {
    pressTimer.current = window.setTimeout(() => {
      haptic([8, 12, 8]);
      setMenuFor(id);
    }, 500);
  };
  const cancelLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div className="flex h-full min-h-full flex-col bg-white pt-2">
      <div className="px-5 pb-4 pt-2">
        <h1 className="nrc-headline">{t("던져보세요", "Drop a thought")}</h1>
        {items.length > 0 && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft/80">
            {t("잊어도 괜찮아요. 제가 기억하고 있을게요.", "Forget it — I'll remember for you.")}
          </p>
        )}
      </div>

      <div className="flex-1 px-4 pb-4">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {itemsAsc.map((it) => {
              const isNewest = it.id === newestId;
              return (
                <div
                  key={it.id}
                  className={`rounded-2xl border border-ink/[0.06] bg-white/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] ${
                    isNewest ? "animate-pop" : "animate-fade-in"
                  }`}
                >
                  <CardBody
                    item={it}
                    big={isNewest}
                    inbox={inbox}
                    onScheduleFromMirror={(item, result) => {
                      const text = formatMirrorScheduleText(item.text, result);
                      setScheduleSheet({
                        open: true,
                        item: { ...item, text },
                        date: detectDate(text)?.start,
                      });
                    }}
                    onLongPressStart={startLongPress}
                    onLongPressEnd={cancelLongPress}
                  />
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 pb-[env(safe-area-inset-bottom)]">
        <InputBar
          onAdd={handleAdd}
          onPasteMulti={(chunks, original) => setPasteSheet({ chunks, original })}
        />
      </div>

      {menuFor && (
        <div className="absolute inset-0 z-50 flex flex-col" onClick={() => setMenuFor(null)}>
          <div className="flex-1 bg-ink/25 backdrop-blur-sm animate-fade-in" />
          <div
            className="glass-strong animate-slide-up mx-3 mb-[100px] rounded-3xl p-2 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const it = items.find((x) => x.id === menuFor);
              if (!it) return null;
              return (
                <>
                  <MenuItem
                    icon={<Calendar size={18} />}
                    label={t("때로 남기기", "Save for when")}
                    onClick={() => {
                      setMenuFor(null);
                      setScheduleSheet({ open: true, item: it });
                    }}
                  />
                  <MenuItem
                    icon={<ArchiveIcon size={18} />}
                    label={t("기억으로 보내기", "Move to memory")}
                    onClick={() => {
                      setMenuFor(null);
                      moveToMemory(it);
                    }}
                  />
                  <MenuItem
                    icon={<Trash2 size={18} />}
                    label={t("지우기", "Delete")}
                    danger
                    onClick={() => {
                      setMenuFor(null);
                      inbox.remove(it.id);
                      haptic(6);
                    }}
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}

      {pasteSheet && (
        <div className="absolute inset-0 z-50 flex flex-col" onClick={() => setPasteSheet(null)}>
          <div className="flex-1 bg-ink/25 backdrop-blur-sm animate-fade-in" />
          <div
            className="glass-strong animate-slide-up rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
            <div className="text-[17px] font-bold text-ink">
              {t("붙여넣은 글, 어떻게 담을까요?", "How should we save this paste?")}
            </div>
            <div className="mt-1 text-sm text-ink-soft">
              {t(`${pasteSheet.chunks.length}줄이에요.`, `${pasteSheet.chunks.length} lines.`)}
            </div>
            <button
              onClick={async () => {
                for (const c of pasteSheet.chunks) {
                  await inbox.add({ text: c, images: [] } as any);
                }
                setPasteSheet(null);
                haptic([6, 14, 8]);
              }}
              className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-ink"
            >
              {t("나눠서 담기", "Split into notes")}
            </button>
            <button
              onClick={async () => {
                await inbox.add({ text: pasteSheet.original, images: [] } as any);
                setPasteSheet(null);
                haptic(6);
              }}
              className="mt-2 w-full rounded-2xl bg-white/70 py-3.5 text-[15px] font-semibold text-ink"
            >
              {t("한 번에 담기", "Keep as one")}
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
          onSave={async (text, start, end) => {
            await schedules.add({
              text,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              alarm: false,
            } as any);
            await inbox.remove(scheduleSheet.item!.id);
            track("schedule_created", { source: "stream", text_length: text.length });
            setScheduleSheet({ open: false });
            haptic([6, 16, 10]);
          }}
        />
      )}

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function formatMirrorScheduleText(original: string, result: BrainMirrorResult) {
  if (result.tasks.length === 0) return result.title || original;
  const lines = [result.title, ...result.tasks.map((task) => `- ${task}`)].filter(Boolean);
  return lines.join("\n");
}

function CardBody({
  item,
  big,
  inbox,
  onScheduleFromMirror,
  onLongPressStart,
  onLongPressEnd,
}: {
  item: InboxItem;
  big?: boolean;
  inbox: ReturnType<typeof useInbox>;
  onScheduleFromMirror: (item: InboxItem, result: BrainMirrorResult) => void;
  onLongPressStart?: (id: string) => void;
  onLongPressEnd?: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";
  return (
    <div
      className={`px-4 ${big ? "py-5 min-h-[120px]" : "py-3.5"}`}
      onPointerDown={() => onLongPressStart?.(item.id)}
      onPointerUp={onLongPressEnd}
      onPointerLeave={onLongPressEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item.images?.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img key={i} src={src} alt="" className={`rounded-xl object-cover ${big ? "h-24 w-24" : "h-14 w-14"}`} />
          ))}
        </div>
      )}
      <p className={`whitespace-pre-wrap text-ink ${big ? "text-[17px] font-semibold leading-snug" : "text-[14px] leading-snug"}`}>
        {item.text || t("(이미지만)", "(image only)")}
      </p>
      <BrainMirrorPanel item={item} inbox={inbox} onSchedule={onScheduleFromMirror} />
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-soft/70">
        <span>
          {new Date(item.created_at).toLocaleString(locale, {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <MoreHorizontal size={14} className="opacity-40" aria-hidden />
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="flex h-full min-h-[45dvh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        {t(
          "머릿속에 있는 것, 아래에 던져두세요.\n기억은 제가 할게요.",
          "Drop what's on your mind below.\nI'll hold the memory.",
        )}
      </p>
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
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium ${
        danger ? "text-destructive" : "text-ink"
      } hover:bg-white/60`}
    >
      {icon}
      {label}
    </button>
  );
}
