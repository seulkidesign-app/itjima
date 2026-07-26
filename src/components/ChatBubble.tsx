import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useT, useLang } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";
import { TRANSITION_CALM } from "@/lib/motion";

export function ChatBubble({
  item,
  isNewest,
  showTime = false,
  children,
  wrapBubble,
  onRetryCapture,
}: {
  item: InboxItem;
  isNewest?: boolean;
  /** Show timestamp under the bubble (default: only newest). */
  showTime?: boolean;
  children?: ReactNode;
  /** Wrap only the bubble card (e.g. swipe row) — keeps actions aligned to bubble height. */
  wrapBubble?: (bubble: ReactNode) => ReactNode;
  onRetryCapture?: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";

  const bubbleBody = (
    <div className="chat-bubble w-full text-left">
      <p className="whitespace-pre-wrap text-body">
        {item.text.trim() || t("사진만 있어요", "Photo only")}
      </p>
      {children}
    </div>
  );

  return (
    <motion.div
      className="home-chat-bubble-row flex w-full flex-col items-end"
      initial={isNewest ? { opacity: 0, y: 8 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION_CALM}
    >
      <div className="chat-turn-group">
        {item.images?.length > 0 && (
          <div className="mb-1 flex w-full justify-end gap-1.5 overflow-x-auto">
            {item.images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className={`rounded-[var(--radius-md)] object-cover ring-1 ring-ink/10 ${
                  isNewest ? "h-36 w-36" : "h-28 w-28"
                }`}
              />
            ))}
          </div>
        )}
        {wrapBubble ? wrapBubble(bubbleBody) : bubbleBody}
        {(showTime || isNewest) && (
          <div className="mt-0.5 flex flex-col items-end gap-0.5 self-end pr-1">
            {item.capture_state === "pending" && (
              <p
                className="text-caption text-ink-soft/70"
                aria-live="polite"
              >
                {t("맡기는 중…", "Keeping it…")}
              </p>
            )}
            {item.capture_state === "failed" && (
              <button
                type="button"
                onClick={onRetryCapture}
                className="text-caption font-semibold text-meta underline-offset-2 hover:underline"
                aria-live="assertive"
              >
                {t("아직 안 됐어요 · 다시", "Not yet — tap to retry")}
              </button>
            )}
            <p className="text-caption tabular-nums text-ink-soft/55">
              {new Date(item.created_at).toLocaleString(locale, {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
