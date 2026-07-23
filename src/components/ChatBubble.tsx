import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useT, useLang } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";
import { SPRING_DEFAULT } from "@/lib/motion";

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

  return (
    <motion.div
      className="flex w-full flex-col items-end"
      initial={isNewest ? { opacity: 0, y: 14, scale: 0.96 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING_DEFAULT}
    >
      {item.images?.length > 0 && (
        <div className="mb-2 flex max-w-full justify-end gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className={`rounded-[16px] object-cover ring-1 ring-ink/10 ${
                isNewest ? "h-28 w-28" : "h-20 w-20"
              }`}
            />
          ))}
        </div>
      )}
      {wrapBubble ? (
        wrapBubble(
          <div className="chat-bubble w-fit max-w-[min(340px,calc(100vw-2rem))] text-left">
            <p className="whitespace-pre-wrap text-[16px] font-medium leading-[1.65] tracking-[-0.015em] text-ink">
              {item.text.trim() || t("(이미지만)", "(image only)")}
            </p>
            {children}
          </div>,
        )
      ) : (
        <div className="chat-bubble w-fit max-w-full text-left">
          <p className="whitespace-pre-wrap text-[16px] font-medium leading-[1.65] tracking-[-0.015em] text-ink">
            {item.text.trim() || t("(이미지만)", "(image only)")}
          </p>
          {children}
        </div>
      )}
      {(showTime || isNewest) && (
        <p className="mt-1 pr-0.5 text-[10px] font-medium tabular-nums text-ink-soft/55">
          {new Date(item.created_at).toLocaleString(locale, {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </motion.div>
  );
}
