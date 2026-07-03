import type { ReactNode } from "react";
import { useT, useLang } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";

export function ChatBubble({
  item,
  isNewest,
  children,
}: {
  item: InboxItem;
  isNewest?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";

  return (
    <div
      className={`flex w-full max-w-[min(340px,88vw)] flex-col items-end ${
        isNewest ? "animate-pop" : "animate-fade-in"
      }`}
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
      <div className="chat-bubble w-fit max-w-full text-left">
        <p className="whitespace-pre-wrap text-[15px] font-semibold leading-[1.6] tracking-[-0.01em] text-ink">
          {item.text.trim() || t("(이미지만)", "(image only)")}
        </p>
        {children}
      </div>
      <p className="mt-1 pr-0.5 text-[10px] font-medium tabular-nums text-ink-soft/55">
        {new Date(item.created_at).toLocaleString(locale, {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
