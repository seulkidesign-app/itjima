import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Bookmark,
  ChevronDown,
  X,
  FolderPlus,
  Pin,
  FolderInput,
} from "lucide-react";
import { useArchive, useSchedules, type ArchiveItem } from "@/lib/store";
import { archiveGroup, detectDate } from "@/lib/dateDetect";
import { useT, useLang } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ArchiveOrganizeSheet } from "@/components/ArchiveOrganizeSheet";
import { ArchiveMemoryCard } from "@/components/ArchiveMemoryCard";
import { ArchiveMoveSheet } from "@/components/ArchiveMoveSheet";
import {
  archiveDisplayTitle,
  readArchivePins,
  toggleArchivePin,
  setArchiveTitle,
  readArchiveTitles,
} from "@/lib/archiveMeta";
import { recentArchiveItems, searchArchiveItems } from "@/lib/archiveSearch";
import { ArchiveGridSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SyncIndicator } from "@/components/SyncIndicator";
import { SwipeCard } from "@/components/SwipeCard";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { track } from "@/lib/analytics";
import { SPRING_DEFAULT } from "@/lib/motion";

export const Route = createFileRoute("/archive")({
  component: Archive,
});

type GroupDef = {
  key: string;
  ko: string;
  en: string;
  emoji: string;
  custom?: boolean;
};

const BUILTIN_GROUPS: GroupDef[] = [
  { key: "todo", ko: "나중에", en: "For later", emoji: "✅" },
  { key: "idea", ko: "아이디어", en: "Ideas", emoji: "💡" },
  { key: "place", ko: "장소", en: "Places", emoji: "📍" },
  { key: "read", ko: "읽기·보기", en: "Read/Watch", emoji: "📚" },
  { key: "etc", ko: "기타", en: "Other", emoji: "🗂" },
];

const OVERRIDE_KEY = "itjima.archive_group_overrides";
const CUSTOM_KEY = "itjima.archive_custom_groups";
const COLLAPSED_KEY = "itjima.archive_collapsed";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

function Archive() {
  const t = useT();
  const { lang } = useLang();
  const { items, remove, add, syncState, retrySync } = useArchive();
  const schedules = useSchedules();
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [customGroups, setCustomGroups] = useState<GroupDef[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Selection mode (long-press)
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupModal, setGroupModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");
  const pressTimer = useRef<number | null>(null);

  const [ungroupTarget, setUngroupTarget] = useState<GroupDef | null>(null);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [editItem, setEditItem] = useState<ArchiveItem | null>(null);
  const [scheduleItem, setScheduleItem] = useState<ArchiveItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pins, setPins] = useState<Set<string>>(() => readArchivePins());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pressOrigin = useRef<{ x: number; y: number; id: string } | null>(null);

  useEffect(() => {
    const h = () => setPins(readArchivePins());
    window.addEventListener("itjima:archive-meta", h);
    return () => window.removeEventListener("itjima:archive-meta", h);
  }, []);

  useEffect(() => {
    setOverrides(readJSON<Record<string, string>>(OVERRIDE_KEY, {}));
    setCustomGroups(readJSON<GroupDef[]>(CUSTOM_KEY, []));
    setCollapsed(new Set(readJSON<string[]>(COLLAPSED_KEY, [])));
  }, []);

  const allGroups: GroupDef[] = useMemo(
    () => [
      ...BUILTIN_GROUPS.filter((g) => g.key !== "etc"),
      ...customGroups,
      BUILTIN_GROUPS.find((g) => g.key === "etc")!,
    ],
    [customGroups],
  );

  const groupOf = (id: string, text: string) =>
    overrides[id] ?? archiveGroup(text).key;

  const persistOverrides = (next: Record<string, string>) => {
    setOverrides(next);
    writeJSON(OVERRIDE_KEY, next);
  };
  const persistCustom = (next: GroupDef[]) => {
    setCustomGroups(next);
    writeJSON(CUSTOM_KEY, next);
  };
  const toggleCollapse = (k: string) => {
    const next = new Set(collapsed);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setCollapsed(next);
    writeJSON(COLLAPSED_KEY, [...next]);
    haptic(4);
  };

  const searchMeta = useMemo(() => searchArchiveItems(items, q), [items, q]);

  const pinnedItems = useMemo(() => {
    if (q.trim()) return [];
    let list = items.filter((it) => pins.has(it.id));
    if (groupFilter !== "all") {
      list = list.filter((it) => groupOf(it.id, it.text) === groupFilter);
    }
    return [...list].sort((a, b) => {
      const da = +new Date(a.created_at);
      const db = +new Date(b.created_at);
      return sortOrder === "newest" ? db - da : da - db;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pins, q, groupFilter, sortOrder, overrides]);

  const pinnedIds = useMemo(
    () => new Set(pinnedItems.map((it) => it.id)),
    [pinnedItems],
  );

  const recentDisplay = useMemo(() => {
    if (q.trim()) return [];
    return recentArchiveItems(items, 8)
      .filter((it) => !pins.has(it.id))
      .slice(0, 5);
  }, [items, pins, q]);

  const hitById = useMemo(() => {
    const m = new Map<string, (typeof searchMeta.hits)[0]>();
    for (const h of searchMeta.hits) m.set(h.item.id, h);
    return m;
  }, [searchMeta.hits]);

  const filtered = useMemo(() => {
    let list = q.trim() ? searchMeta.hits.map((h) => h.item) : [...items];
    if (groupFilter !== "all") {
      list = list.filter((it) => groupOf(it.id, it.text) === groupFilter);
    }
    list = [...list].sort((a, b) => {
      const da = +new Date(a.created_at);
      const db = +new Date(b.created_at);
      return sortOrder === "newest" ? db - da : da - db;
    });
    return list;
  }, [items, q, groupFilter, sortOrder, overrides, searchMeta.hits]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    filtered.forEach((it) => {
      if (!q.trim() && pinnedIds.has(it.id)) return;
      const k = groupOf(it.id, it.text);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    });
    return allGroups
      .map((g) => ({
        ...g,
        label: lang === "en" ? g.en : g.ko,
        items: map.get(g.key) ?? [],
      }))
      .filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, lang, overrides, allGroups, pinnedIds]);

  useEffect(() => {
    if (!scrollToId) return;
    const el = cardRefs.current[scrollToId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setScrollToId(null);
  }, [scrollToId, grouped, pinnedItems]);

  const jumpToMemory = (id: string) => {
    setExpandedId(id);
    setScrollToId(id);
    haptic(4);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    haptic(3);
  };

  const locale = lang === "en" ? "en-US" : "ko-KR";

  // ---- 키워드 기반 자동 정리 (사용자 지정 그룹은 유지) ----
  const runAIOrganize = () => {
    if (items.length === 0) return;
    haptic([6, 18, 10]);
    setOrganizeOpen(true);
  };

  const applyOrganize = (next: Record<string, string>) => {
    persistOverrides(next);
    haptic([6, 20, 8]);
    toast.success(t("비슷하게 모았어요", "Grouped gently"));
  };

  // ---- Selection / long-press ----
  const startLongPress = (id: string, e: PointerEvent) => {
    pressOrigin.current = { x: e.clientX, y: e.clientY, id };
    pressTimer.current = window.setTimeout(() => {
      if (pressOrigin.current?.id !== id) return;
      haptic([8, 12, 8]);
      setSelecting(true);
      setExpandedId(null);
      setSelected(new Set([id]));
    }, 450);
  };
  const onPressMove = (e: PointerEvent) => {
    if (!pressOrigin.current) return;
    const dx = Math.abs(e.clientX - pressOrigin.current.x);
    const dy = Math.abs(e.clientY - pressOrigin.current.y);
    if (dx > 10 || dy > 10) cancelLongPress();
  };
  const cancelLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressOrigin.current = null;
  };
  const toggleSelect = (id: string) => {
    if (!selecting) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    haptic(3);
    if (next.size === 0) setSelecting(false);
  };
  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  // ---- Drag & drop reassignment ----
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const moveToGroup = (id: string, key: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const auto = archiveGroup(it.text).key;
    const next = { ...overrides };
    if (key === auto) delete next[id];
    else next[id] = key;
    persistOverrides(next);
    haptic([6, 10, 6]);
  };

  const moveSelectionToGroup = (key: string) => {
    const next = { ...overrides };
    selected.forEach((id) => {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      const auto = archiveGroup(it.text).key;
      if (key === auto) delete next[id];
      else next[id] = key;
    });
    persistOverrides(next);
    haptic([6, 18, 8]);
    toast.success(t("옮겼어요", "Moved"));
    exitSelection();
  };

  // ---- Long-press a group header → ungroup (custom groups only) ----
  const headerPressTimer = useRef<number | null>(null);
  const startHeaderPress = (g: GroupDef) => {
    if (!g.custom) return;
    headerPressTimer.current = window.setTimeout(() => {
      haptic([10, 20, 10]);
      setUngroupTarget(g);
    }, 600);
  };
  const cancelHeaderPress = () => {
    if (headerPressTimer.current) {
      clearTimeout(headerPressTimer.current);
      headerPressTimer.current = null;
    }
  };

  const createGroupFromSelection = () => {
    const name = newName.trim();
    if (!name || selected.size === 0) return;
    const key = `c_${Date.now().toString(36)}`;
    const def: GroupDef = {
      key,
      ko: name,
      en: name,
      emoji: newEmoji || "✨",
      custom: true,
    };
    persistCustom([...customGroups, def]);
    const next = { ...overrides };
    selected.forEach((id) => {
      next[id] = key;
    });
    persistOverrides(next);
    haptic([8, 20, 10]);
    setGroupModal(false);
    setNewName("");
    setNewEmoji("✨");
    exitSelection();
  };

  const removeWithUndo = async (it: ArchiveItem) => {
    const snapshot = { ...it };
    try {
      await remove(it.id);
      track("archive_deleted", { text_length: it.text.length });
      toast.custom(
        (toastId) => (
          <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
            <div className="text-sm">{t("지웠어요", "Removed")}</div>
            <button
              type="button"
              onClick={async () => {
                await add({
                  text: snapshot.text,
                  images: snapshot.images,
                  source_id: snapshot.source_id,
                  raw_text: snapshot.raw_text,
                  brain_mirror: snapshot.brain_mirror,
                });
                toast.dismiss(toastId);
              }}
              className="touch-target shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-ink"
            >
              {t("되돌리기", "Undo")}
            </button>
          </div>
        ),
        { duration: 10000 },
      );
    } catch {
      toast.error(t("삭제하지 못했어요", "Couldn't delete"));
    }
  };

  const openScheduleSheet = (it: ArchiveItem) => {
    setScheduleItem(it);
  };

  const confirmScheduleFromArchive = async (
    text: string,
    start: Date,
    end: Date,
    alarmMinutes: number | null,
  ) => {
    if (!scheduleItem) return;
    const it = scheduleItem;
    try {
      const alarmPayload =
        alarmMinutes != null
          ? {
              alarm: true,
              alarm_at: new Date(
                start.getTime() - alarmMinutes * 60 * 1000,
              ).toISOString(),
            }
          : { alarm: false };
      await schedules.add({
        text,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        alarm: alarmPayload.alarm ?? false,
        alarm_at: alarmPayload.alarm
          ? (alarmPayload as { alarm_at: string }).alarm_at
          : null,
        source_id: it.source_id ?? it.id,
        raw_text: it.raw_text ?? it.text,
        brain_mirror: it.brain_mirror ?? null,
        status: "active",
      });
      await remove(it.id);
      track("archive_swiped_schedule", { text_length: it.text.length });
      haptic([6, 18, 8]);
      toast.success(t("그때를 기억해 둘게요", "I'll remember this for then"));
      setScheduleItem(null);
    } catch {
      toast.error(t("남기지 못했어요", "Couldn't save it"));
    }
  };

  const confirmUngroup = () => {
    if (!ungroupTarget) return;
    const g = ungroupTarget;
    persistCustom(customGroups.filter((x) => x.key !== g.key));
    const next: Record<string, string> = {};
    Object.entries(overrides).forEach(([id, k]) => {
      if (k !== g.key) next[id] = k;
    });
    persistOverrides(next);
    setUngroupTarget(null);
    toast.success(t("묶음을 풀었어요", "Ungrouped"));
  };

  const renderMemoryCard = (it: ArchiveItem) => {
    const isSel = selected.has(it.id);
    const isDragging = dragId === it.id;
    const swipeDisabled = selecting || isDragging;

    return (
      <SwipeCard
        key={it.id}
        mode="instant"
        disabled={swipeDisabled}
        leftLabel={t("지우기", "Remove")}
        rightLabel={t("그때", "When")}
        onSwipe={(dir) => {
          if (dir === "right") openScheduleSheet(it);
          else void removeWithUndo(it);
        }}
      >
        <div
          ref={(el) => {
            cardRefs.current[it.id] = el;
          }}
          draggable={!selecting}
          onDragStart={(e) => {
            if (selecting) return;
            e.dataTransfer.setData("text/plain", it.id);
            e.dataTransfer.effectAllowed = "move";
            setDragId(it.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDragOver(null);
          }}
          onPointerDown={(e) => startLongPress(it.id, e)}
          onPointerMove={onPressMove}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onClick={() => {
            if (selecting) toggleSelect(it.id);
          }}
        >
          <ArchiveMemoryCard
            item={it}
            locale={locale}
            expanded={expandedId === it.id}
            selected={isSel}
            selecting={selecting}
            pinned={pins.has(it.id)}
            isDragging={isDragging}
            showSemanticHint={
              !!q.trim() && !!hitById.get(it.id)?.semantic
            }
            allItems={items}
            onToggleExpand={() => toggleExpand(it.id)}
            onTogglePin={() => {
              toggleArchivePin(it.id);
              setPins(readArchivePins());
              haptic(4);
            }}
            onEditTitle={() => {
              setEditItem(it);
              setEditTitle(
                readArchiveTitles()[it.id] ??
                  archiveDisplayTitle(it.id, it),
              );
            }}
            onDelete={() => void removeWithUndo(it)}
            onJumpTo={(id) => jumpToMemory(id)}
          />
        </div>
      </SwipeCard>
    );
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <SyncIndicator
        syncing={syncState === "syncing"}
        error={syncState === "error"}
        onRetry={retrySync}
      />
      <div className="sticky top-0 z-10 shrink-0 bg-white pb-1">
        <div className="px-5 pb-2 pt-6">
          <p className="text-[13px] font-medium text-ink-soft">
            {t("잊어도 돼요.", "It's okay to forget.")}
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-ink">
            {t("여기 있어요.", "It's here for you.")}
          </h1>
          {items.length > 0 && (
            <p className="mt-2 text-[13px] text-ink-soft/80">
              {t(
                `${items.length}개의 생각이 조용히 기다리고 있어요`,
                `${items.length} thoughts safely waiting here`,
              )}
            </p>
          )}
        </div>
        {items.length >= 2 && (
          <div className="px-5 pb-3">
            <button
              onClick={runAIOrganize}
              className="touch-press w-full rounded-full border border-ink/10 bg-ink/[0.03] py-3 text-[12px] font-semibold text-ink-soft"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Bookmark size={13} />
                {t("비슷한 기억끼리", "Similar memories together")}
              </span>
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 rounded-[24px] bg-white px-3.5 py-2.5 shadow-card">
              <Search size={16} className="shrink-0 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setExpandedId(null);
                }}
                placeholder={t(
                  "떠올리고 싶은 걸 찾아보세요",
                  "Search what you remember",
                )}
                className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-soft/70 focus:outline-none"
              />
              {q.trim() && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="touch-target shrink-0 rounded-full text-ink-soft"
                  aria-label={t("지우기", "Clear")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {q.trim() && (
              <p className="mt-1.5 px-1 text-[11px] text-ink-soft">
                {filtered.length > 0 ? (
                  <>
                    {t(`${filtered.length}개`, `${filtered.length} results`)}
                    {searchMeta.usedSemantic && (
                      <span className="ml-1.5 text-primary">
                        · {t("비슷한 것도 찾았어요", "also found similar ones")}
                      </span>
                    )}
                  </>
                ) : (
                  t("검색 결과가 없어요", "No results")
                )}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setGroupFilter("all")}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  groupFilter === "all"
                    ? "bg-ink text-white"
                    : "bg-ink/[0.06] text-ink-soft"
                }`}
              >
                {t("전체", "All")}
              </button>
              {allGroups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGroupFilter(g.key)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    groupFilter === g.key
                      ? "bg-ink text-white"
                      : "bg-ink/[0.06] text-ink-soft"
                  }`}
                >
                  {g.emoji} {lang === "en" ? g.en : g.ko}
                </button>
              ))}
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "newest" | "oldest")
                }
                className="ml-auto rounded-full bg-ink/[0.06] px-3 py-1.5 text-[12px] font-medium text-ink-soft focus:outline-none"
                aria-label={t("정렬", "Sort")}
              >
                <option value="newest">{t("최신순", "Newest")}</option>
                <option value="oldest">{t("오래된순", "Oldest")}</option>
              </select>
            </div>
            <p className="mt-2 px-1 text-[11px] text-ink-soft/65">
              {t(
                "탭하여 펼치기 · → 그때 · ← 지우기 · 길게 눌러 선택",
                "Tap to open · → When · ← Remove · hold to select",
              )}
            </p>
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-5 px-5 ${selecting ? "pb-28" : "pb-8"}`}>
        {syncState === "syncing" && items.length === 0 ? (
          <ArchiveGridSkeleton />
        ) : items.length === 0 ? (
          <Empty />
        ) : filtered.length === 0 ? (
          <div className="rounded-[24px] bg-ink/[0.04] px-5 py-10 text-center">
            <p className="text-[15px] font-semibold text-ink">
              {q.trim()
                ? t("비슷한 생각을 못 찾았어요", "No similar thoughts found")
                : t("이 묶음은 비어 있어요", "Nothing in this group yet")}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {q.trim()
                ? t("다른 키워드로 검색해 보세요", "Try different keywords")
                : t("다른 묶음을 둘러보세요", "Browse another group")}
            </p>
            {!q.trim() && groupFilter !== "all" && (
              <button
                type="button"
                onClick={() => setGroupFilter("all")}
                className="touch-press mt-4 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-ink"
              >
                {t("전체 보기", "Show all")}
              </button>
            )}
          </div>
        ) : (
          <>
            {!q.trim() && pinnedItems.length > 0 && (
              <section>
                <h2 className="mb-2.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-ink-soft">
                  <Pin size={14} className="text-primary" />
                  {t("자주 보는 기억", "Pinned memories")}
                </h2>
                <div className="flex flex-col gap-3">
                  {pinnedItems.map((it) => renderMemoryCard(it))}
                </div>
              </section>
            )}

            {!q.trim() && recentDisplay.length > 0 && (
              <section>
                <h2 className="mb-2.5 px-1 text-[13px] font-semibold text-ink-soft">
                  {t("최근", "Recent")}
                </h2>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {recentDisplay.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => jumpToMemory(it.id)}
                      className="touch-press min-w-[148px] max-w-[200px] shrink-0 rounded-[20px] bg-ink/[0.04] px-3.5 py-3 text-left ring-1 ring-ink/[0.04] active:bg-ink/[0.07]"
                    >
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
                        {archiveDisplayTitle(it.id, it)}
                      </p>
                      <p className="mt-1.5 text-[11px] text-ink-soft/75">
                        {new Date(it.created_at).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {grouped.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              const isDropTarget = dragOver === g.key;
              return (
                <section
                  key={g.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOver !== g.key) setDragOver(g.key);
                  }}
                  onDragLeave={() => {
                    if (dragOver === g.key) setDragOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || dragId;
                    if (id) moveToGroup(id, g.key);
                    setDragOver(null);
                    setDragId(null);
                  }}
                  className={`rounded-[24px] transition-colors duration-200 ${
                    isDropTarget ? "bg-primary/8 ring-2 ring-primary/40" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCollapse(g.key)}
                    onPointerDown={() => startHeaderPress(g)}
                    onPointerUp={cancelHeaderPress}
                    onPointerLeave={cancelHeaderPress}
                    className="mb-2 flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left select-none active:bg-ink/[0.03]"
                  >
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                      <span>{g.emoji}</span>
                      <span>{g.label}</span>
                      <span className="text-[13px] font-medium text-ink-soft/70">
                        {g.items.length}
                      </span>
                      {g.custom && (
                        <span className="rounded-full bg-primary/25 px-2 py-0.5 text-[10px] font-semibold text-ink/80">
                          {t("내 그룹", "Mine")}
                        </span>
                      )}
                    </h2>
                    <ChevronDown
                      size={18}
                      className={`text-ink-soft/70 transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        key="items"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={SPRING_DEFAULT}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-3 pb-1">
                          {g.items.map((it) => renderMemoryCard(it))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}
          </>
        )}
      </div>

      {/* Selection bottom bar */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 animate-fade-in">
          <div className="glass-strong card-radius flex items-center gap-2 p-2 shadow-float">
            <button
              onClick={exitSelection}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-white/60"
              aria-label={t("취소", "Cancel")}
            >
              <X size={18} />
            </button>
            <div className="flex-1 px-1 text-[13px] font-semibold text-ink">
              {selected.size}
              {t("개 선택됨", " selected")}
            </div>
            <button
              onClick={() => setMoveSheetOpen(true)}
              disabled={selected.size === 0}
              className="touch-press inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-3 py-2 text-[12px] font-semibold text-ink disabled:opacity-50"
            >
              <FolderInput size={14} />
              {t("옮기기", "Move")}
            </button>
            <button
              onClick={() => setGroupModal(true)}
              disabled={selected.size === 0}
              className="pill-yellow inline-flex items-center gap-1 disabled:opacity-50"
            >
              <FolderPlus size={14} /> {t("그룹 만들기", "New group")}
            </button>
          </div>
        </div>
      )}

      {/* Create-group modal */}
      {groupModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-md"
            onClick={() => setGroupModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-[24px] bg-white/95 p-6 shadow-float backdrop-blur-xl animate-scale-in">
            <div className="text-[17px] font-extrabold text-ink">
              {t("새 그룹 만들기", "New group")}
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {selected.size}
              {t("개 메모를 이 그룹으로 묶어요.", " notes will be grouped.")}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
                className="h-12 w-14 rounded-full bg-white/80 text-center text-2xl text-ink input-focus-ring"
                aria-label={t("이모지", "Emoji")}
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("그룹 이름", "Group name")}
                autoFocus
                className="h-12 flex-1 rounded-full bg-white/80 px-4 text-[15px] font-medium text-ink placeholder:text-ink-soft/70 input-focus-ring"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setGroupModal(false)}
                className="flex-1 rounded-full bg-white/70 py-3 text-[14px] font-semibold text-ink-soft"
              >
                {t("취소", "Cancel")}
              </button>
              <button
                onClick={createGroupFromSelection}
                disabled={!newName.trim()}
                className="touch-press flex-1 rounded-full bg-primary py-3 text-[14px] font-bold text-ink active:scale-95 disabled:opacity-50"
              >
                {t("만들기", "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ArchiveMoveSheet
        open={moveSheetOpen}
        groups={allGroups}
        count={selected.size}
        onClose={() => setMoveSheetOpen(false)}
        onPick={moveSelectionToGroup}
      />

      <ArchiveOrganizeSheet
        open={organizeOpen}
        items={items}
        overrides={overrides}
        customGroupKeys={new Set(customGroups.map((g) => g.key))}
        allGroups={allGroups}
        onClose={() => setOrganizeOpen(false)}
        onApply={applyOrganize}
      />

      {ungroupTarget && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          onClick={() => setUngroupTarget(null)}
        >
          <div className="flex-1 animate-fade-in bg-ink/30 backdrop-blur-sm" />
          <div
            className="animate-slide-up rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-bold text-ink">
              {t(
                `"${ungroupTarget.ko}" 그룹을 해제할까요?`,
                `Remove group "${ungroupTarget.en}"?`,
              )}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {t("메모는 그대로 남아요.", "Your notes stay.")}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setUngroupTarget(null)}
                className="touch-press flex-1 rounded-full border border-ink/10 py-3 text-[14px] font-bold text-ink"
              >
                {t("취소", "Cancel")}
              </button>
              <button
                type="button"
                onClick={confirmUngroup}
                className="touch-press flex-1 rounded-full bg-ink py-3 text-[14px] font-bold text-white"
              >
                {t("해제", "Remove")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div
          className="absolute inset-0 z-50 flex flex-col"
          onClick={() => setEditItem(null)}
        >
          <div className="flex-1 animate-fade-in bg-ink/30 backdrop-blur-sm" />
          <div
            className="animate-slide-up rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17px] font-bold text-ink">
              {t("제목 편집", "Edit title")}
            </h3>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-3 w-full rounded-[20px] bg-ink/[0.04] px-3.5 py-3 text-[15px] input-focus-ring"
            />
            <button
              type="button"
              onClick={() => {
                setArchiveTitle(editItem.id, editTitle);
                setEditItem(null);
                toast.success(t("저장됐어요", "Saved"));
              }}
              className="mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink"
            >
              {t("저장", "Save")}
            </button>
          </div>
        </div>
      )}
      <ScheduleSheet
        open={!!scheduleItem}
        initialText={
          scheduleItem
            ? archiveDisplayTitle(scheduleItem.id, scheduleItem)
            : undefined
        }
        initialStart={
          scheduleItem
            ? (detectDate(scheduleItem.text)?.start ??
              detectDate(scheduleItem.raw_text ?? "")?.start)
            : undefined
        }
        onClose={() => setScheduleItem(null)}
        onSave={(text, start, end, opts) => {
          void confirmScheduleFromArchive(
            text,
            start,
            end,
            opts?.alarmMinutesBefore ?? null,
          );
        }}
      />
    </div>
  );
}

function Empty() {
  return (
    <EmptyState
      emoji="🗂"
      titleKo="아직 남겨둔 게 없어요"
      titleEn="Nothing kept here yet"
      hintKo="마음에 남는 생각을 왼쪽으로 밀어 두면, 여기서 다시 만날 수 있어요"
      hintEn="Swipe left on a thought you want to keep — it'll wait here for you"
    />
  );
}
