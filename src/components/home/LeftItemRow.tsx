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

/** V03 living-note row — captured records feel held, not like a backlog to manage. */
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
      className={`home-chat-turn my-1 flex items-start gap-2 rounded-[20px] px-4 py-4 ring-1 ring-ink/[0.045] transition-colors ${
        isNewest ? "bg-[#FFF9D9] shadow-card" : "bg-ink/[0.018]"
      }`}
      data-newest={isNewest ? "true" : "false"}
      data-has-promise="false"
    >
      <span
        className={`mt-[6px] h-2.5 w-2.5 shrink-0 rounded-full ${
          done ? "bg-ink/20" : timed ? "bg-primary" : "bg-[#F0C94E]"
        }`}
        data-done={done ? "true" : "false"}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {onOpenDetail ? (
            <button
              type="button"
              data-testid="left-item-open-detail"
              aria-label={t("기록 열기", "Open record")}
              onClick={onOpenDetail}
              className="touch-press min-w-0 flex-1 text-left"
            >
              <p
                className={`text-[16px] font-semibold leading-snug tracking-[-0.015em] text-ink ${
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
            className="mt-1.5 text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-primary"
          >
            {meta}
          </p>
        ) : !done ? (
          <p className="mt-1.5 text-[12px] font-medium text-ink-soft/65">
            {t("조용히 기억 중", "Held quietly")}
          </p>
        ) : null}
        {showSetTime && !done && !timed && (
          <button
            type="button"
            data-testid="left-item-set-time"
            onClick={onSetTime}
            className="touch-press mt-2 min-h-9 rounded-full bg-white/75 px-3 text-left text-[12px] font-semibold text-ink-soft ring-1 ring-ink/[0.05]"
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
        className="touch-press grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-white/60"
      >
        <MoreHorizontal size={19} aria-hidden />
      </button>
    </li>
  );
}
