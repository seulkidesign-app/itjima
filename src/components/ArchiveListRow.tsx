import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import { classifyLocally } from "@/lib/localClassifier";
import { Pin, Link2, Lightbulb, FileText, Tag } from "lucide-react";
import { useRef } from "react";
import { useT } from "@/lib/i18n";

const TYPE_META = {
  link: {
    icon: Link2,
    ko: "링크",
    en: "Link",
    chip: "status-chip--archive",
    iconClass: "semantic-icon--archive",
  },
  idea: {
    icon: Lightbulb,
    ko: "아이디어",
    en: "Idea",
    chip: "status-chip--task",
    iconClass: "semantic-icon--task",
  },
  memo: {
    icon: FileText,
    ko: "메모",
    en: "Note",
    chip: "status-chip--archive",
    iconClass: "semantic-icon--archive",
  },
  etc: {
    icon: Tag,
    ko: "기타",
    en: "Other",
    chip: "status-chip--keep",
    iconClass: "semantic-icon--keep",
  },
} as const;

function extractDomain(text: string): string | null {
  const m = text.match(/https?:\/\/([^/\s]+)/i);
  return m?.[1]?.replace(/^www\./, "") ?? null;
}

function contentPreview(text: string, title: string): string | null {
  const body = text.trim();
  if (!body) return null;
  const domain = extractDomain(body);
  if (domain) return domain;
  const firstLine = body.split("\n")[0]?.trim() ?? body;
  if (firstLine === title.trim()) {
    const second = body.split("\n").slice(1).find((l) => l.trim());
    if (second) return second.trim().slice(0, 72);
    return null;
  }
  return firstLine.slice(0, 72);
}

function resolveType(text: string): keyof typeof TYPE_META {
  const cat = classifyLocally(text)?.category;
  if (cat === "link") return "link";
  if (cat === "idea") return "idea";
  if (
    cat === "note" ||
    cat === "place" ||
    cat === "list" ||
    cat === "shopping" ||
    cat === "reminder" ||
    cat === "task" ||
    cat === "schedule"
  ) {
    return "memo";
  }
  return "etc";
}

export function ArchiveListRow({
  item,
  locale,
  categoryLabel,
  groupLabel,
  pinned,
  onOpen,
  onEditTitle,
}: {
  item: ArchiveItem;
  locale: string;
  categoryLabel: string;
  groupLabel?: string | null;
  pinned?: boolean;
  onOpen: () => void;
  onEditTitle?: () => void;
}) {
  const t = useT();
  const title = archiveDisplayTitle(item.id, item);
  const body = item.raw_text ?? item.text ?? "";
  const typeKey = resolveType(body);
  const typeMeta = TYPE_META[typeKey];
  const TypeIcon = typeMeta.icon;
  const preview = contentPreview(body, title);
  const domain = extractDomain(body);
  const saved = new Date(item.created_at).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const metaParts = [groupLabel, saved].filter(Boolean);

  return (
    <button
      type="button"
      data-testid="archive-list-row"
      onPointerDown={() => {
        longFired.current = false;
        clearPress();
        if (onEditTitle) {
          pressTimer.current = window.setTimeout(() => {
            longFired.current = true;
            onEditTitle();
          }, 480);
        }
      }}
      onPointerUp={() => {
        clearPress();
        if (!longFired.current) onOpen();
      }}
      onPointerLeave={clearPress}
      onPointerCancel={clearPress}
      className={`w-full rounded-[var(--radius-md)] border bg-white px-3.5 py-3 text-left shadow-card touch-press active:bg-ink/[0.02] ${
        pinned
          ? "border-primary/25 border-l-[3px] border-l-primary pl-[calc(0.875rem-2px)]"
          : "border-ink/[0.04]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.04] ${typeMeta.iconClass}`}
          aria-hidden
        >
          <TypeIcon size={14} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {pinned && (
              <Pin
                size={13}
                className="mt-0.5 shrink-0 fill-primary text-primary"
                aria-label={t("고정", "Pinned")}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/75">
                {t(typeMeta.ko, typeMeta.en)}
              </p>
              <p
                className={`mt-0.5 whitespace-pre-wrap break-words text-[15px] font-semibold leading-snug ${
                  typeKey === "link"
                    ? "text-[#1a5fb4]"
                    : "text-ink"
                }`}
              >
                {title}
              </p>
              {preview && (
                <p
                  className={`mt-1 line-clamp-2 text-[13px] leading-snug ${
                    domain ? "text-ink-soft/80" : "text-ink-soft/85"
                  }`}
                >
                  {preview}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-soft/75">
            {metaParts.length > 0 && (
              <span className="tabular-nums">{metaParts.join(" · ")}</span>
            )}
            {!groupLabel && (
              <span className={`status-chip ${typeMeta.chip}`}>
                {categoryLabel}
              </span>
            )}
            {item.source_id && (
              <span className="text-ink-soft/60">
                {t("던진 생각", "From capture")}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
