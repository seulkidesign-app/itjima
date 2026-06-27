import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { archiveGroup } from "@/lib/dateDetect";
import { useT } from "@/lib/i18n";
import { useArchive } from "@/lib/store";

export const Route = createFileRoute("/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  const t = useT();
  const { items, remove } = useArchive();

  useEffect(() => {
    document.title = t("보관함 — ItJima", "Archive — ItJima");
  }, [t]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; emoji: string; items: typeof items }>();
    for (const item of items) {
      const g = archiveGroup(item.text);
      const bucket = map.get(g.key) ?? { label: g.label, emoji: g.emoji, items: [] };
      bucket.items.push(item);
      map.set(g.key, bucket);
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="nrc-eyebrow">{t("정리된 생각", "Sorted thoughts")}</div>
        <h1 className="nrc-headline">{t("보관함", "Archive")}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-soft">
            {t("보관된 메모가 없어요", "Nothing archived yet")}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-soft">
                  {group.emoji} {group.label}
                </h2>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-ink/8 bg-white p-4 shadow-card">
                      {item.images.length > 0 && (
                        <div className="mb-2 flex gap-2 overflow-x-auto">
                          {item.images.map((src, i) => (
                            <img key={i} src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-[15px] text-ink">{item.text}</p>
                      <button
                        onClick={() => remove(item.id)}
                        className="mt-2 text-[11px] font-semibold text-ink-soft"
                      >
                        {t("삭제", "Delete")}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
