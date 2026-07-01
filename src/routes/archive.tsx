import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Sparkles, ChevronDown, X, FolderPlus, Check, Pin } from "lucide-react";
import { useArchive, useSchedules, type ArchiveItem } from "@/lib/store";
import { archiveGroup, detectDate } from "@/lib/dateDetect";
import { useT, useLang } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ArchiveOrganizeSheet } from "@/components/ArchiveOrganizeSheet";
import {
  archiveDisplayTitle,
  archiveSearchHaystack,
  readArchivePins,
  toggleArchivePin,
  setArchiveTitle,
  readArchiveTitles,
} from "@/lib/archiveMeta";
import { ArchiveGridSkeleton } from "@/components/Skeleton";
import { SwipeCard } from "@/components/SwipeCard";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/archive")({
  component: Archive,
});

type GroupDef = { key: string; ko: string; en: string; emoji: string; custom?: boolean };

const BUILTIN_GROUPS: GroupDef[] = [
  { key: "todo", ko: "할 일", en: "To-do", emoji: "✅" },
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
  try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
  catch { return fallback; }
}
function writeJSON(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

function Archive() {
  const t = useT();
  const { lang } = useLang();
  const { items, remove, syncState } = useArchive();
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

  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [editItem, setEditItem] = useState<ArchiveItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pins, setPins] = useState<Set<string>>(() => readArchivePins());

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
    () => [...BUILTIN_GROUPS.filter(g => g.key !== "etc"), ...customGroups, BUILTIN_GROUPS.find(g => g.key === "etc")!],
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
    if (next.has(k)) next.delete(k); else next.add(k);
    setCollapsed(next);
    writeJSON(COLLAPSED_KEY, [...next]);
    haptic(4);
  };

  const filtered = useMemo(() => {
    let list = items;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((it) => archiveSearchHaystack(it).includes(needle));
    }
    if (groupFilter !== "all") {
      list = list.filter((it) => groupOf(it.id, it.text) === groupFilter);
    }
    list = [...list].sort((a, b) => {
      const da = +new Date(a.created_at);
      const db = +new Date(b.created_at);
      return sortOrder === "newest" ? db - da : da - db;
    });
    return list;
  }, [items, q, groupFilter, sortOrder, overrides]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    filtered.forEach((it) => {
      const k = groupOf(it.id, it.text);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    });
    return allGroups.map((g) => ({
      ...g,
      label: lang === "en" ? g.en : g.ko,
      items: map.get(g.key) ?? [],
    })).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, lang, overrides, allGroups]);

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
    toast.success(t("그룹을 업데이트했어요", "Groups updated"));
  };

  // ---- Selection / long-press ----
  const startLongPress = (id: string) => {
    pressTimer.current = window.setTimeout(() => {
      haptic([8, 12, 8]);
      setSelecting(true);
      setSelected(new Set([id]));
    }, 450);
  };
  const cancelLongPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const toggleSelect = (id: string) => {
    if (!selecting) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    haptic(3);
    if (next.size === 0) setSelecting(false);
  };
  const exitSelection = () => { setSelecting(false); setSelected(new Set()); };

  // ---- Drag & drop reassignment ----
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const moveToGroup = (id: string, key: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const auto = archiveGroup(it.text).key;
    const next = { ...overrides };
    if (key === auto) delete next[id]; else next[id] = key;
    persistOverrides(next);
    haptic([6, 10, 6]);
  };

  // ---- Long-press a group header → ungroup (custom groups only) ----
  const headerPressTimer = useRef<number | null>(null);
  const startHeaderPress = (g: GroupDef) => {
    if (!g.custom) return;
    headerPressTimer.current = window.setTimeout(() => {
      haptic([10, 20, 10]);
      const ok = window.confirm(t(`"${g.ko}" 그룹을 해제할까요? 메모는 그대로 남아요.`, `Ungroup "${g.en}"? Notes stay.`));
      if (!ok) return;
      // Remove custom group and clear overrides pointing to it.
      persistCustom(customGroups.filter((x) => x.key !== g.key));
      const next: Record<string, string> = {};
      Object.entries(overrides).forEach(([id, k]) => { if (k !== g.key) next[id] = k; });
      persistOverrides(next);
    }, 600);
  };
  const cancelHeaderPress = () => {
    if (headerPressTimer.current) { clearTimeout(headerPressTimer.current); headerPressTimer.current = null; }
  };

  const createGroupFromSelection = () => {
    const name = newName.trim();
    if (!name || selected.size === 0) return;
    const key = `c_${Date.now().toString(36)}`;
    const def: GroupDef = { key, ko: name, en: name, emoji: newEmoji || "✨", custom: true };
    persistCustom([...customGroups, def]);
    const next = { ...overrides };
    selected.forEach((id) => { next[id] = key; });
    persistOverrides(next);
    haptic([8, 20, 10]);
    setGroupModal(false);
    setNewName("");
    setNewEmoji("✨");
    exitSelection();
  };

  // Swipe → schedule (right) / delete (left)
  const sendToSchedule = async (it: ArchiveItem) => {
    const det = detectDate(it.text);
    const start = det?.start ?? new Date();
    const end = det?.end ?? new Date(start.getTime() + 60 * 60 * 1000);
    await schedules.add({
      text: it.text,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      alarm: false,
      source_id: it.source_id ?? it.id,
      raw_text: it.raw_text ?? it.text,
      brain_mirror: it.brain_mirror ?? null,
      status: "active",
    } as any);
    await remove(it.id);
    track("archive_swiped_schedule", { text_length: it.text.length });
    haptic([6, 18, 8]);
    toast.success(t("일정으로 옮겼어요", "Moved to schedule"));
  };




  return (
    <div className="flex h-full flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white pb-1">
        <div className="px-5 pb-2 pt-6">
          <div className="nrc-eyebrow">{t("보관함", "Archive")}</div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="page-title">{t("기억", "Memory")}</h1>
            <div className="text-right leading-none">
              <div className="font-num text-[40px] text-ink">{items.length}</div>
              <div className="nrc-eyebrow mt-0.5">{t("개", "Saved")}</div>
            </div>
          </div>
        </div>
        {items.length > 0 && (
          <div className="px-5 pb-3">
            <button
              onClick={runAIOrganize}
              className="w-full bg-ink py-4 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white transition active:scale-[0.98]"
              style={{ borderRadius: 999 }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Sparkles size={14} className="text-primary" />
                {t("✨ 자동 정리", "✨ Auto-sort")}
              </span>
            </button>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-soft">
              {t(
                "키워드로 그룹을 다시 나눠요. 직접 만든 그룹은 그대로 둡니다.",
                "Re-sorts by keywords. Custom groups stay as you set them.",
              )}
            </p>
          </div>
        )}

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-[24px] bg-white px-3.5 py-2.5 shadow-card">
            <Search size={16} className="text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("보관한 생각 검색", "Search archived thoughts")}
            className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-soft/70 focus:outline-none"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setGroupFilter("all")}
            className={`rounded-full px-3 py-1 text-[12px] font-medium ${
              groupFilter === "all" ? "bg-ink text-white" : "bg-ink/[0.06] text-ink-soft"
            }`}
          >
            {t("전체", "All")}
          </button>
          {allGroups.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroupFilter(g.key)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                groupFilter === g.key ? "bg-ink text-white" : "bg-ink/[0.06] text-ink-soft"
              }`}
            >
              {g.emoji} {lang === "en" ? g.en : g.ko}
            </button>
          ))}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
            className="ml-auto rounded-full bg-ink/[0.06] px-3 py-1 text-[12px] font-medium text-ink-soft focus:outline-none"
            aria-label={t("정렬", "Sort")}
          >
            <option value="newest">{t("최신순", "Newest")}</option>
            <option value="oldest">{t("오래된순", "Oldest")}</option>
          </select>
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-ink-soft">
          <Sparkles size={11} className="text-primary" />
          {t("→ 일정으로 보내기 · ← 삭제 · 길게 눌러 다중 선택 · 그룹 헤더 길게 눌러 해제",
             "Swipe → Schedule · ← Delete · long-press to multi-select · long-press header to ungroup")}
        </div>
        </div>
      </div>

      <div className={`flex-1 space-y-5 px-5 ${selecting ? "pb-28" : "pb-8"}`}>
        {syncState === "syncing" && items.length === 0 ? (
          <ArchiveGridSkeleton />
        ) : items.length === 0 ? (
          <Empty />
        ) : (
          grouped.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const isDropTarget = dragOver === g.key;
            return (
              <section
                key={g.key}
                onDragOver={(e) => { e.preventDefault(); if (dragOver !== g.key) setDragOver(g.key); }}
                onDragLeave={() => { if (dragOver === g.key) setDragOver(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  if (id) moveToGroup(id, g.key);
                  setDragOver(null);
                  setDragId(null);
                }}
                className={`rounded-[24px] transition ${isDropTarget ? "bg-primary/10 ring-2 ring-primary/60" : ""}`}
              >
                <div
                  onClick={() => toggleCollapse(g.key)}
                  onPointerDown={() => startHeaderPress(g)}
                  onPointerUp={cancelHeaderPress}
                  onPointerLeave={cancelHeaderPress}
                  className="mb-2 flex w-full cursor-pointer items-center justify-between px-1 py-1 text-left select-none"
                >
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink">
                    <span className="text-base">{g.emoji}</span> {g.label} <span className="text-ink-soft/70">/ {g.items.length}</span>
                    {g.custom && <span className="ml-1.5 bg-primary px-1.5 py-0.5 text-[9px] font-extrabold text-ink">{t("MINE", "MINE")}</span>}
                  </h2>
                  <ChevronDown
                    size={16}
                    className={`text-ink-soft transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col gap-3">
                    {g.items.map((it) => {
                      const isSel = selected.has(it.id);
                      const isDragging = dragId === it.id;
                      const swipeDisabled = selecting || isDragging;
                      return (
                        <SwipeCard
                          key={it.id}
                          disabled={swipeDisabled}
                          onSwipe={(dir) => {
                            if (dir === "right") sendToSchedule(it);
                            else remove(it.id);
                          }}
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", it.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDragId(it.id);
                            }}
                            onDragEnd={() => { setDragId(null); setDragOver(null); }}
                            onPointerDown={() => startLongPress(it.id)}
                            onPointerUp={cancelLongPress}
                            onPointerLeave={cancelLongPress}
                            onClick={() => toggleSelect(it.id)}
                            className={`px-[22px] py-5 transition ${
                              isSel ? "ring-2 ring-primary scale-[0.98]" : ""
                            } ${isDragging ? "opacity-40" : ""}`}
                          >
                            <div className="flex gap-3">
                              {selecting && (
                                <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                  isSel ? "border-primary bg-primary text-ink" : "border-ink/20"
                                }`}>
                                  {isSel && <Check size={12} strokeWidth={3} />}
                                </div>
                              )}
                              {it.images?.[0] && (
                                <img src={it.images[0]} alt="" className="h-14 w-14 rounded-[24px] object-cover" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[15px] font-semibold leading-snug text-ink line-clamp-2">
                                    {archiveDisplayTitle(it.id, it)}
                                  </p>
                                  {!selecting && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleArchivePin(it.id);
                                        setPins(readArchivePins());
                                        haptic(4);
                                      }}
                                      aria-label={t("핀", "Pin")}
                                    >
                                      <Pin
                                        size={14}
                                        className={pins.has(it.id) ? "fill-primary text-primary" : "text-ink-soft"}
                                      />
                                    </button>
                                  )}
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft line-clamp-2">
                                  {it.raw_text ?? it.text}
                                </p>
                                {it.brain_mirror?.title && (
                                  <p className="mt-1.5 text-[11px] text-ink-soft">
                                    🧠 {it.brain_mirror.title}
                                  </p>
                                )}
                                <div className="mt-3 flex items-center justify-between gap-2 text-meta">
                                  <span>{g.emoji} {g.label}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditItem(it);
                                        setEditTitle(readArchiveTitles()[it.id] ?? archiveDisplayTitle(it.id, it));
                                      }}
                                      className="text-[11px] underline"
                                    >
                                      {t("제목", "Title")}
                                    </button>
                                    <span>{new Date(it.created_at).toLocaleDateString(locale)}</span>
                                    {!selecting && (
                                      <button onClick={(e) => { e.stopPropagation(); remove(it.id); }} aria-label={t("삭제", "Delete")}>
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </SwipeCard>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
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
              {selected.size}{t("개 선택됨", " selected")}
            </div>
            <button
              onClick={() => setGroupModal(true)}
              disabled={selected.size === 0}
              className="pill-yellow inline-flex items-center gap-1 disabled:opacity-50"
            >
              <FolderPlus size={14} /> {t("그룹 만들기", "Create group")}
            </button>
          </div>
        </div>
      )}

      {/* Create-group modal */}
      {groupModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-md" onClick={() => setGroupModal(false)} />
          <div className="relative w-full max-w-sm rounded-[24px] bg-white/95 p-6 shadow-float backdrop-blur-xl animate-scale-in">
            <div className="text-[17px] font-extrabold text-ink">{t("새 그룹 만들기", "New group")}</div>
            <div className="mt-1 text-xs text-ink-soft">
              {selected.size}{t("개 메모를 이 그룹으로 묶어요.", " notes will be grouped.")}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
                className="h-12 w-14 rounded-full bg-white/80 text-center text-2xl text-ink focus:outline-none focus:shadow-[0_0_0_2px_#FFE033]"
                aria-label={t("이모지", "Emoji")}
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("그룹 이름", "Group name")}
                autoFocus
                className="h-12 flex-1 rounded-full bg-white/80 px-4 text-[15px] font-medium text-ink placeholder:text-ink-soft/70 focus:outline-none focus:shadow-[0_0_0_2px_#FFE033]"
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
                className="flex-1 rounded-full py-3 text-[14px] font-bold text-ink active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: "#FFD233" }}
              >
                {t("만들기", "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ArchiveOrganizeSheet
        open={organizeOpen}
        items={items}
        overrides={overrides}
        customGroupKeys={new Set(customGroups.map((g) => g.key))}
        allGroups={allGroups}
        onClose={() => setOrganizeOpen(false)}
        onApply={applyOrganize}
      />

      {editItem && (
        <div className="absolute inset-0 z-50 flex flex-col" onClick={() => setEditItem(null)}>
          <div className="flex-1 bg-ink/30 backdrop-blur-sm" />
          <div
            className="animate-slide-up rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17px] font-bold text-ink">{t("제목 편집", "Edit title")}</h3>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-3 w-full rounded-[20px] bg-ink/[0.04] px-3.5 py-3 text-[15px] focus:outline-none focus:shadow-[0_0_0_2px_#FFE033]"
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
    </div>
  );
}

function Empty() {
  const t = useT();
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center text-center px-4">
      <div className="text-5xl">🗂</div>
      <div className="mt-3 text-[17px] font-bold text-ink">
        {t("아직 담긴 게 없어요.", "Nothing saved yet.")}
      </div>
      <div className="mt-1 text-sm text-ink-soft">
        {t("마음에 남는 생각을 왼쪽으로 밀어 모아보세요.", "Swipe left on a thought when you want to keep it.")}
      </div>
    </div>
  );
}
