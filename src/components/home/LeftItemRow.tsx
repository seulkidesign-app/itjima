import { MoreHorizontal } from "lucide-react";
import type { InboxItem } from "@/lib/store";
import { useT } from "@/lib/i18n";

type Props = {
  item: InboxItem;
  onSetTime: () => void;
  onOpenMenu: () => void;
  onOpenDetail?: () => void;
  showSetTime?: boolean;
  isNewest?: boolean;
};

/** Quiet “남긴 것” list row — title first, soft action, ··· for lifecycle. */
export function LeftItemRow({
  item,
  onSetTime,
  onOpenMenu,
  onOpenDetail,
  showSetTime = true,
  isNewest = false,
}: Props) {
  const t = useT();
  const title = item.text.trim() || t("(내용 없음)", "(No text)");

  return (
    <li
      data-testid="left-item-row"
      data-chat-turn=""
      className="home-chat-turn flex items-start gap-2 border-b border-ink/[0.06] py-3 last:border-b-0"
      data-newest={isNewest ? "true" : "false"}
      data-has-promise="false"
    >
      <div className="min-w-0 flex-1">
        {onOpenDetail ? (
          <button
            type="button"
            data-testid="left-item-open-detail"
            onClick={onOpenDetail}
            className="touch-press w-full text-left"
          >
            <p className="text-[16px] font-semibold leading-snug text-ink">{title}</p>
          </button>
        ) : (
          <p className="text-[16px] font-semibold leading-snug text-ink">{title}</p>
        )}
        {showSetTime && (
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
