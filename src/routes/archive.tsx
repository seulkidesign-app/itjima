import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Sparkles, ChevronDown, X, FolderPlus, Check } from "lucide-react";
import { useArchive, useSchedules, type ArchiveItem } from "@/lib/store";
import { archiveGroup, detectDate } from "@/lib/dateDetect";
import { useT, useLang } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
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
  const { items, remove } = useArchive();
  const schedules = useSchedules();
  const [q, setQ] = useState("");
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

  // AI organize visual state
  const [aiPhase, setAiPhase] = useState<"idle" | "analyzing" | "shimmer">("idle");

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

  const filtered = useMemo(
    () => (q ? items.filter((it) => it.text.toLowerCase().includes(q.toLowerCase())) : items),
    [items, q],
  );

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

  // ---- AI 그룹 정리 ----
  const runAIOrganize = async () => {
    if (aiPhase !== "idle" || items.length === 0) return;
    haptic([6, 18, 10]);
    setAiPhase("analyzing");
    await new Promise((r) => setTimeout(r, 1200));
    setAiPhase("shimmer");
    // Clear overrides that pointed to built-in groups so AI re-classifies.
    // Keep overrides pointing to custom groups.
    const customKeys = new Set(customGroups.map((g) => g.key));
    const next: Record<string, string> = {};
    Object.entries(overrides).forEach(([id, k]) => {
      if (customKeys.has(k)) next[id] = k;
    });
    persistOverrides(next);
    await new Promise((r) => setTimeout(r, 800));
    setAiPhase("idle");
    haptic([6, 20, 8]);
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
    } as any);
    await remove(it.id);
    track("archive_swiped_schedule", { text_length: it.text.length });
    haptic([6, 18, 8]);
    toast.success(t("일정으로 옮겼어요", "Moved to schedule"));
  };




  return (
    <div className="flex h-full flex-col bg-white">
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
      {/* AI 그룹 정리 button */}
      {items.length > 0 && (
        <div className="px-5 pb-3">
          <button
            onClick={runAIOrganize}
            disabled={aiPhase !== "idle"}
            className={`w-full bg-ink py-4 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white transition active:scale-[0.98] disabled:opacity-80 ${
              aiPhase === "analyzing" ? "animate-pulse" : ""
            }`}
            style={{ borderRadius: 999 }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Sparkles size={14} className={`text-primary ${aiPhase === "analyzing" ? "animate-spin" : ""}`} />
              {aiPhase === "analyzing"
                ? t("분석 중...", "Analyzing...")
                : t("✨ AI 그룹 정리", "✨ AI Re-group")}
            </span>
          </button>
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
        <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-ink-soft">
          <Sparkles size={11} className="text-primary" />
          {t("→ 일정으로 보내기 · ← 삭제 · 길게 눌러 다중 선택 · 그룹 헤더 길게 눌러 해제",
             "Swipe → Schedule · ← Delete · long-press to multi-select · long-press header to ungroup")}
        </div>
      </div>

      <div className={`flex-1 space-y-5 px-5 ${selecting ? "pb-28" : "pb-8"}`}>
        {items.length === 0 ? (
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
                  <div className={`flex flex-col gap-3 ${aiPhase === "shimmer" ? "animate-pulse" : ""}`}>
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
                                <p className="card-text whitespace-pre-wrap text-ink line-clamp-3">
                                  {it.text}
                                </p>
                                <div className="mt-3 flex items-center justify-between gap-2 text-meta">
                                  <span>{g.emoji} {g.label}</span>
                                  <div className="flex items-center gap-2">
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
    </div>
  );
}

function Empty() {
  const t = useT();
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center text-center">
      <div className="text-5xl">🗂</div>
      <div className="mt-3 text-[17px] font-bold text-ink">{t("보관함이 비어 있어요", "Your archive is empty")}</div>
      <div className="mt-1 text-sm text-ink-soft">{t("생각을 왼쪽으로 밀면 여기에 모여요.", "Swipe a thought left to send it here.")}</div>
    </div>
  );
}
