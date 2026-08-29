import { MoreHorizontal } from "lucide-react";
import type { InboxItem } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { formatCaptureWhenLabel } from "@/lib/naturalScheduleDraft";
import { isStructuredTimedRecord } from "@/lib/recordTemporal";

type Props = {
  item: InboxItem;
  onSetTime: () => void;
  onOpenMenu: () => void;
  onOpenDetail?: () => void;
  showSetTime?: boolean;
  isNewest?: boolean;
  metaRight?: string | null;
};

function relativeMeta(createdAt: string, lang: "ko" | "en"): string {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return lang === "ko" ? "방금" : "Just now";
  const delta = Date.now() - created;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < 2 * minute) return lang === "ko" ? "방금" : "Just now";
  if (delta < hour) {
    const n = Math.max(1, Math.floor(delta / minute));
    return lang === "ko" ? `${n}분 전` : `${n}m ago`;
  }
  if (delta < day) {
    const n = Math.max(1, Math.floor(delta / hour));
    return lang === "ko" ? `${n}시간 전` : `${n}h ago`;
  }
  const n = Math.max(1, Math.floor(delta / day));
  if (n === 1) return lang === "ko" ? "어제" : "Yesterday";
  return lang === "ko" ? `${n}일 전` : `${n}d ago`;
}

/** Quiet flat record row — yellow dot + title + temporal typography. */
export function LeftItemRow({
  item,
  onSetTime,
  onOpenMenu,
  onOpenDetail,
  showSetTime = true,
  isNewest = false,
  metaRight = null,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const title = item.text.trim() || t("(내용 없음)", "(No text)");
  const timed = isStructuredTimedRecord(item);
  const meta =
    timed && item.start_time
      ? formatCaptureWhenLabel(
          new Date(item.start_time),
          Boolean(item.all_day),
          uiLang,
        )
      : relativeMeta(item.created_at, uiLang);
  const done = item.status === "done";

  return (
    <li
      data-testid="left-item-row"
      data-chat-turn=""
      data-timed={timed ? "true" : "false"}
      className="quietly-record-row home-chat-turn flex items-start gap-2 py-3 last:border-b-0"
      data-newest={isNewest ? "true" : "false"}
      data-has-promise="false"
    >
      <span
        className="quietly-record-dot mt-[6px]"
        data-done={done ? "true" : "false"}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {onOpenDetail ? (
            <button
              type="button"
              data-testid="left-item-open-detail"
              aria-label={t("생각 열기", "Open thought")}
              onClick={onOpenDetail}
              className="touch-press min-w-0 flex-1 text-left"
            >
              <p
                className={`text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink ${
                  done ? "text-ink-soft" : ""
                }`}
              >
                {title}
              </p>
            </button>
          ) : (
            <p className="min-w-0 flex-1 text-[16px] font-semibold leading-snug text-ink">
              {title}
            </p>
          )}
          {metaRight ? (
            <span className="shrink-0 pt-0.5 text-[12px] font-medium text-ink-soft">
              {metaRight}
            </span>
          ) : null}
        </div>
        <p
          className={`mt-1 text-[13px] font-medium tabular-nums tracking-[-0.01em] ${
            timed ? "text-primary" : "text-ink-soft"
          }`}
        >
          {meta}
        </p>
        {showSetTime && !done && !timed && (
          <button
            type="button"
            data-testid="left-item-set-time"
            onClick={onSetTime}
            className="touch-press mt-1 min-h-11 -ml-1 px-1 text-left text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
          >
            {t("시간 정하기", "Set a time")}
          </button>
        )}
      </div>
      <button
        type="button"
        data-testid="left-item-more"
        aria-label={t("더보기", "More")}
        onClick={onOpenMenu}
        className="touch-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft"
      >
        <MoreHorizontal size={20} aria-hidden />
      </button>
    </li>
  );
}
