import { MoreHorizontal } from "lucide-react";
import type { InboxItem } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { formatCaptureWhenLabel } from "@/lib/naturalScheduleDraft";
import { isStructuredTimedRecord } from "@/lib/recordTemporal";
import { replaceAllDayWithFuzzyDaypart } from "@/lib/temporalDisplay";

type Props = {
  item: InboxItem;
  onSetTime: () => void;
  onOpenMenu: () => void;
  onOpenDetail?: () => void;
  showSetTime?: boolean;
  isNewest?: boolean;
  metaRight?: string | null;
};

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
  const baseMeta =
    timed && item.start_time
      ? formatCaptureWhenLabel(
          new Date(item.start_time),
          Boolean(item.all_day),
          uiLang,
        )
      : null;
  const meta =
    baseMeta && timed && item.temporal_state === "fuzzy_time"
      ? replaceAllDayWithFuzzyDaypart(
          baseMeta,
          item.raw_text ?? item.text,
          uiLang,
        )
      : baseMeta;
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
        {meta ? (
          <p
            data-testid="left-item-meta"
            className="mt-1 text-[13px] font-medium tabular-nums tracking-[-0.01em] text-primary"
          >
            {meta}
          </p>
        ) : null}
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
