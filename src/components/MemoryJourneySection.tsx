import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { ArchiveItem } from "@/lib/store";
import type { JourneyChapter, JourneyMoment } from "@/lib/memoryJourney";
import { journeyCoverPreview } from "@/lib/memoryJourney";
import type { ThoughtLike } from "@/lib/thinkingInsights";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import { useT, useLang } from "@/lib/i18n";
import { SPRING_DEFAULT } from "@/lib/motion";

const TONE_GRADIENTS = [
  "from-primary/14 via-primary/6 to-ink/[0.03]",
  "from-amber-400/12 via-orange-300/6 to-ink/[0.03]",
  "from-sky-400/12 via-blue-300/6 to-ink/[0.03]",
  "from-violet-400/12 via-purple-300/6 to-ink/[0.03]",
  "from-rose-400/12 via-pink-300/6 to-ink/[0.03]",
];

type Props = {
  chapters: JourneyChapter[];
  thoughts: ThoughtLike[];
  archiveItems: ArchiveItem[];
  onOpenMemory: (id: string) => void;
};

function momentLabel(moment: JourneyMoment, lang: "ko" | "en") {
  if (moment.whisperKo || moment.whisperEn) {
    return lang === "en" ? moment.whisperEn : moment.whisperKo;
  }
  return null;
}

export function MemoryJourneySection({
  chapters,
  thoughts,
  archiveItems,
  onOpenMemory,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const archiveIds = new Set(archiveItems.map((it) => it.id));

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !chapters.length) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [chapters]);

  if (!chapters.length) return null;

  const expanded = chapters.find((c) => c.id === expandedId);

  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="text-[12px] font-medium text-ink-soft/70">
          {t("기억의 여정", "Your memory journey")}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-soft/55">
          {t(
            "생각들이 이야기가 되어가요",
            "Your thoughts became your story",
          )}
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 scroll-smooth"
      >
        {chapters.map((chapter, i) => {
          const open = expandedId === chapter.id;
          const title = lang === "en" ? chapter.titleEn : chapter.titleKo;
          const subtitle =
            lang === "en" ? chapter.subtitleEn : chapter.subtitleKo;
          const gradient = TONE_GRADIENTS[chapter.tone % TONE_GRADIENTS.length];
          const previews = chapter.coverIds
            .map((id) => journeyCoverPreview(id, thoughts))
            .filter(Boolean);

          return (
            <motion.button
              key={chapter.id}
              type="button"
              initial={{ opacity: 0, x: 16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ ...SPRING_DEFAULT, delay: i * 0.05 }}
              onClick={() => setExpandedId(open ? null : chapter.id)}
              className={`touch-press relative min-w-[172px] max-w-[200px] shrink-0 overflow-hidden rounded-[22px] bg-gradient-to-br ${gradient} px-4 py-3.5 text-left ring-1 ring-ink/[0.05] active:scale-[0.98] ${
                open ? "ring-primary/25" : ""
              }`}
            >
              <p className="text-[15px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                {title}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-soft/75">
                {subtitle}
              </p>
              {previews.length > 0 && (
                <div className="mt-3 space-y-0.5 border-t border-ink/[0.06] pt-2.5">
                  {previews.slice(0, 2).map((line) => (
                    <p
                      key={line}
                      className="line-clamp-1 text-[10px] text-ink-soft/60"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {expanded && (
          <motion.div
            key={expanded.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING_DEFAULT}
            className="overflow-hidden"
          >
            <div className="rounded-[22px] bg-ink/[0.025] px-4 py-4 ring-1 ring-ink/[0.04]">
              <Timeline
                chapter={expanded}
                lang={lang}
                archiveIds={archiveIds}
                archiveItems={archiveItems}
                onOpenMemory={(id) => {
                  onOpenMemory(id);
                  setExpandedId(null);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Timeline({
  chapter,
  lang,
  archiveIds,
  archiveItems,
  onOpenMemory,
}: {
  chapter: JourneyChapter;
  lang: "ko" | "en";
  archiveIds: Set<string>;
  archiveItems: ArchiveItem[];
  onOpenMemory: (id: string) => void;
}) {
  const locale = lang === "en" ? "en-US" : "ko-KR";

  return (
    <div className="relative pl-5">
      <div
        className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-primary/30 via-ink/10 to-transparent"
        aria-hidden
      />
      <div className="space-y-3">
        {chapter.moments.map((moment, idx) => (
          <TimelineNode
            key={moment.id}
            moment={moment}
            idx={idx}
            lang={lang}
            locale={locale}
            archiveIds={archiveIds}
            archiveItems={archiveItems}
            onOpenMemory={onOpenMemory}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineNode({
  moment,
  idx,
  lang,
  locale,
  archiveIds,
  archiveItems,
  onOpenMemory,
}: {
  moment: JourneyMoment;
  idx: number;
  lang: "ko" | "en";
  locale: string;
  archiveIds: Set<string>;
  archiveItems: ArchiveItem[];
  onOpenMemory: (id: string) => void;
}) {
  const isWhisper =
    moment.kind === "connection" ||
    moment.kind === "beginning" ||
    moment.kind === "transition";
  const canOpen =
    moment.memoryId && archiveIds.has(moment.memoryId) && !isWhisper;

  const dotClass =
    moment.kind === "milestone"
      ? "bg-primary ring-2 ring-primary/25"
      : moment.kind === "connection"
        ? "h-1.5 w-1.5 bg-ink/20"
        : moment.kind === "beginning" || moment.kind === "transition"
          ? "bg-primary/70 ring-2 ring-primary/15"
          : "bg-ink/25";

  const label = momentLabel(moment, lang);
  const dateStr = new Date(moment.date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });

  const memoryItem = moment.memoryId
    ? archiveItems.find((it) => it.id === moment.memoryId)
    : null;
  const title =
    memoryItem && moment.memoryId
      ? archiveDisplayTitle(moment.memoryId, memoryItem)
      : null;

  if (moment.kind === "connection") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...SPRING_DEFAULT, delay: idx * 0.04 }}
        className="relative flex items-center gap-2 py-0.5 pl-1"
      >
        <span className={`absolute -left-5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${dotClass}`} />
        <p className="text-[11px] italic text-ink-soft/60">
          {label ?? (lang === "en" ? "Connected" : "이어짐")}
        </p>
      </motion.div>
    );
  }

  const content = (
    <>
      <span
        className={`absolute -left-5 top-2 h-2.5 w-2.5 rounded-full ${dotClass}`}
      />
      <div className="min-w-0 flex-1">
        {label && (
          <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">
            {label}
          </p>
        )}
        {title && (
          <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-ink">
            {title}
          </p>
        )}
        {moment.preview && !title && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-ink/85">
            {moment.preview}
          </p>
        )}
        {moment.preview && title && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-soft/75">
            {moment.preview}
          </p>
        )}
        <p className="mt-1 text-[10px] text-ink-soft/55">{dateStr}</p>
      </div>
      {canOpen && (
        <ChevronRight size={14} className="shrink-0 text-ink-soft/40" />
      )}
    </>
  );

  if (canOpen) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...SPRING_DEFAULT, delay: idx * 0.04 }}
        onClick={() => onOpenMemory(moment.memoryId!)}
        className="touch-press relative flex w-full items-start gap-2 rounded-[14px] py-1.5 text-left active:bg-ink/[0.04]"
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_DEFAULT, delay: idx * 0.04 }}
      className="relative flex items-start gap-2 py-1.5"
    >
      {content}
    </motion.div>
  );
}
