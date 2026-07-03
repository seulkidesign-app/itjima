import type { ReactNode } from "react";
import { useT, useLang } from "@/lib/i18n";
import { thoughtFirstLine } from "@/lib/brainMirror";
import type { InboxItem } from "@/lib/store";

export function ChatBubble({
  item,
  isNewest,
  children,
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
      className={`w-full px-4 py-4 ${isNewest ? "animate-pop" : "animate-fade-in"}`}
    >
      {item.images?.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
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
      <p className="whitespace-pre-wrap text-[16px] font-semibold leading-[1.6] text-ink">
        {firstLine || t("(이미지만)", "(image only)")}
        {hasMoreLines && <span className="text-ink-soft/60"> …</span>}
      </p>
      <p className="mt-2 text-[11px] text-ink-soft/70">
        {new Date(item.created_at).toLocaleString(locale, {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      {children}
    </div>
  );
}
