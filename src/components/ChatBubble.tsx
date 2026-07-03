import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";
import { thoughtFirstLine } from "@/lib/brainMirror";
import type { InboxItem } from "@/lib/store";

export function ChatBubble({
  item,
  isNewest,
  children,
  onLongPressStart,
  onLongPressEnd,
}: {
  item: InboxItem;
  isNewest?: boolean;
  children?: ReactNode;
  onLongPressStart?: (id: string) => void;
  onLongPressEnd?: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";
  const firstLine = thoughtFirstLine(item.text);
  const hasMoreLines = item.text.includes("\n");

  return (
    <div
      className={`flex flex-col items-end ${isNewest ? "animate-pop" : "animate-fade-in"}`}
      onPointerDown={() => onLongPressStart?.(item.id)}
      onPointerUp={onLongPressEnd}
      onPointerLeave={onLongPressEnd}
    >
      <div className="chat-bubble max-w-[92%]">
        {item.images?.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {item.images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className={`rounded-[20px] object-cover ${isNewest ? "h-28 w-28" : "h-20 w-20"}`}
              />
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-ink">
          {firstLine || t("(이미지만)", "(image only)")}
          {hasMoreLines && (
            <span className="text-ink-soft/60"> …</span>
          )}
        </p>
        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] text-ink-soft/80">
          <span>
            {new Date(item.created_at).toLocaleString(locale, {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <MoreHorizontal size={12} className="opacity-60" />
        </div>
      </div>
      {children}
    </div>
  );
}
