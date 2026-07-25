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
}: {
  item: InboxItem;
  isNewest?: boolean;
  /** Show timestamp under the bubble (default: only newest). */
  showTime?: boolean;
  children?: ReactNode;
  /** Wrap only the bubble card (e.g. swipe row) — keeps actions aligned to bubble height. */
  wrapBubble?: (bubble: ReactNode) => ReactNode;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";

  const bubbleBody = (
    <div className="chat-bubble w-full text-left">
      <p className="whitespace-pre-wrap text-body">
        {item.text.trim() || t("(이미지만)", "(image only)")}
      </p>
      {children}
    </div>
  );

  return (
    <motion.div
      className="flex w-full flex-col items-end"
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
          <p className="mt-0.5 self-end pr-1 text-caption tabular-nums text-ink-soft/55">
            {new Date(item.created_at).toLocaleString(locale, {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </motion.div>
  );
}
