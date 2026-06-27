import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Inbox } from "lucide-react";
import { toast } from "sonner";
import { InputBar } from "@/components/InputBar";
import { LoginSheet } from "@/components/LoginSheet";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { LanguageToggle, useT } from "@/lib/i18n";
import { detectDate } from "@/lib/dateDetect";
import { tap, confirm } from "@/lib/haptics";
import {
  getUsageCount,
  isLoginDismissed,
  useArchive,
  useInbox,
  useSchedules,
  useUserId,
  type InboxItem,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const t = useT();
  const userId = useUserId();
  const { items, add, remove } = useInbox();
  const { add: addSchedule } = useSchedules();
  const { add: addArchive } = useArchive();
  const [loginOpen, setLoginOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleText, setScheduleText] = useState("");
  const [scheduleStart, setScheduleStart] = useState<Date | undefined>();
  const [scheduleEnd, setScheduleEnd] = useState<Date | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(
    () => items.find((it) => it.id === activeId) ?? items[0] ?? null,
    [items, activeId],
  );

  useEffect(() => {
    document.title = "ItJima — Mental Inbox";
  }, []);

  useEffect(() => {
    if (userId || isLoginDismissed()) return;
    if (getUsageCount() >= 3) setLoginOpen(true);
  }, [userId]);

  useEffect(() => {
    if (!active && items[0]) setActiveId(items[0].id);
    if (active && !items.find((it) => it.id === active.id) && items[0]) setActiveId(items[0].id);
  }, [items, active]);

  const onAdd = async (text: string, images: string[]) => {
    tap();
    const item = await add({ text, images } as Partial<InboxItem> & { text: string });
    setActiveId(item.id);
    const detected = detectDate(text);
    if (detected) {
      setScheduleText(text);
      setScheduleStart(detected.start);
      setScheduleEnd(detected.end);
      setScheduleOpen(true);
    }
  };

  const onPasteMulti = async (chunks: string[]) => {
    for (const chunk of chunks) {
      await add({ text: chunk.replace(/^[-•*·▪︎]\s*/, "") });
    }
    toast.success(t(`${chunks.length}개 메모 추가`, `${chunks.length} notes added`));
  };

  const archiveActive = async () => {
    if (!active) return;
    confirm();
    await addArchive({ text: active.text, images: active.images });
    await remove(active.id);
    toast.success(t("보관함으로 이동", "Moved to archive"));
  };

  const scheduleActive = () => {
    if (!active) return;
    tap();
    const detected = detectDate(active.text);
    setScheduleText(active.text);
    setScheduleStart(detected?.start);
    setScheduleEnd(detected?.end);
    setScheduleOpen(true);
  };

  const onScheduleSave = async (text: string, start: Date, end: Date) => {
    await addSchedule({
      text,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      alarm: false,
    });
    if (active) await remove(active.id);
    setScheduleOpen(false);
    toast.success(t("일정 등록됨", "Event saved"));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div>
          <div className="nrc-eyebrow">{t("멘탈 인박스", "Mental inbox")}</div>
          <h1 className="nrc-headline">
            It<span className="text-primary">Jima</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {!userId && (
            <Link to="/auth" className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {t("로그인", "Sign in")}
            </Link>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Inbox className="mb-3 text-ink/20" size={48} strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-ink">{t("머릿속을 비워보세요", "Empty your head")}</p>
            <p className="mt-1 max-w-[16rem] text-sm text-ink-soft">
              {t("떠오른 생각을 아래에 적어두세요.", "Capture a thought below.")}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActiveId(it.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                    active?.id === it.id ? "bg-ink text-white" : "bg-ink/5 text-ink-soft"
                  }`}
                >
                  {it.text.slice(0, 18) || t("메모", "Note")}
                </button>
              ))}
            </div>
            {active && (
              <article className="animate-fade-in flex min-h-0 flex-1 flex-col rounded-2xl border border-ink/8 bg-white p-5 shadow-card">
                {active.images.length > 0 && (
                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    {active.images.map((src, i) => (
                      <img key={i} src={src} alt="" className="h-24 w-24 rounded-xl object-cover" />
                    ))}
                  </div>
                )}
                <p className="flex-1 whitespace-pre-wrap text-[17px] leading-relaxed text-ink">{active.text}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={scheduleActive} className="pill-black flex items-center justify-center gap-2">
                    <Calendar size={16} /> {t("일정", "Schedule")}
                  </button>
                  <button onClick={archiveActive} className="pill-yellow flex items-center justify-center gap-2">
                    {t("보관", "Archive")}
                  </button>
                </div>
              </article>
            )}
          </div>
        )}
      </main>

      <div className="shrink-0">
        <InputBar onAdd={onAdd} onPasteMulti={onPasteMulti} />
      </div>

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      <ScheduleSheet
        open={scheduleOpen}
        initialText={scheduleText}
        initialStart={scheduleStart}
        initialEnd={scheduleEnd}
        onClose={() => setScheduleOpen(false)}
        onSave={onScheduleSave}
      />
    </div>
  );
}
