import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  ChevronDown,
  X,
  FolderPlus,
  Pin,
  FolderInput,
  Orbit,
  List as ListIcon,
  Sparkles,
} from "lucide-react";
import { useArchive, useSchedules, type ArchiveItem } from "@/lib/store";
import { archiveGroup, detectDate } from "@/lib/dateDetect";
import { classifyLocally } from "@/lib/localClassifier";
import { useT, useLang } from "@/lib/i18n";
import { useScrollLock } from "@/hooks/useScrollLock";
import { haptic, tap } from "@/lib/haptics";
import { ArchiveOrganizeSheet } from "@/components/ArchiveOrganizeSheet";
import { ArchiveMemoryCard } from "@/components/ArchiveMemoryCard";
import { ArchiveMoveSheet } from "@/components/ArchiveMoveSheet";
import { ArchiveConnectedGrid } from "@/components/ArchiveConnectedGrid";
import { ArchiveMemoryDetail } from "@/components/ArchiveMemoryDetail";
import { allCloudSynced } from "@/lib/syncFeedback";
import {
  archiveDisplayTitle,
  readArchivePins,
  toggleArchivePin,
  setArchiveTitle,
  readArchiveTitles,
  recordArchiveVisit,
  readRevivalHint,
  clearRevivalHint,
  readGroupOverrides,
  writeGroupOverrides,
  readCustomGroups,
  writeCustomGroups,
  readCollapsedGroups,
  writeCollapsedGroups,
  readAutoClassify,
  writeAutoClassify,
  type RevivalHint,
  type ArchiveGroupDef,
} from "@/lib/archiveMeta";
import { recentArchiveItems, searchArchiveItems } from "@/lib/archiveSearch";
import { useMemoryLenses } from "@/hooks/useMemoryLenses";
import { ArchiveDiscoverySection } from "@/components/ArchiveDiscoverySection";
import { ThinkingInsightsSection } from "@/components/ThinkingInsightsSection";
import { useThinkingInsights } from "@/hooks/useThinkingInsights";
import { MemoryJourneySection } from "@/components/MemoryJourneySection";
import { useMemoryJourney } from "@/hooks/useMemoryJourney";
import { MemoryRevivalHint } from "@/components/MemoryRevivalHint";
import { ArchiveListRow } from "@/components/ArchiveListRow";
import { featureEnabled } from "@/lib/features";
import { consumeRevivalJumpTarget } from "@/lib/memoryRevival";
import { ArchiveGridSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SyncIndicator } from "@/components/SyncIndicator";
import { SwipeCard } from "@/components/SwipeCard";
import { ScheduleSheet, type ScheduleSaveOptions } from "@/components/ScheduleSheet";
import { scheduleAllDayFieldsFromConfirm } from "@/lib/scheduleTime";
import { track } from "@/lib/analytics";
import { showUndoToast } from "@/lib/undoToast";
import { SPRING_DEFAULT } from "@/lib/motion";
import { useListStagger } from "@/lib/listStagger";

export const Route = createFileRoute("/archive")({
  component: Archive,
});

type GroupDef = ArchiveGroupDef;

const BUILTIN_GROUPS: GroupDef[] = [
  { key: "todo", ko: "나중에", en: "For later", emoji: "✅" },
  { key: "idea", ko: "아이디어", en: "Ideas", emoji: "💡" },
  { key: "place", ko: "장소", en: "Places", emoji: "📍" },
  { key: "read", ko: "읽기·보기", en: "Read/Watch", emoji: "📚" },
  { key: "etc", ko: "기타", en: "Other", emoji: "🗂" },
];

const VAULT_FILTERS = [
  { key: "all", ko: "전체", en: "All" },
  { key: "idea", ko: "아이디어", en: "Ideas" },
  { key: "link", ko: "링크", en: "Links" },
  { key: "memo", ko: "메모", en: "Notes" },
  { key: "etc", ko: "기타", en: "Other" },
] as const;

function vaultCategory(text: string): string {
  const cat = classifyLocally(text)?.category;
  if (cat === "link") return "link";
  if (cat === "idea") return "idea";
  if (
    cat === "note" ||
    cat === "place" ||
    cat === "list" ||
    cat === "shopping" ||
    cat === "reminder" ||
    cat === "task" ||
    cat === "schedule"
  ) {
    return "memo";
  }
  return "etc";
}

function vaultCategoryLabel(key: string, lang: "ko" | "en"): string {
  const match = VAULT_FILTERS.find((f) => f.key === key);
  if (!match) return lang === "en" ? "Other" : "기타";
  return lang === "en" ? match.en : match.ko;
}

function Archive() {
  const t = useT();
  const { lang } = useLang();
  const listStagger = useListStagger("archive-list");
  const { items, remove, add, syncState, retrySync } = useArchive();
  const schedules = useSchedules();
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    readGroupOverrides(),
  );
  const [customGroups, setCustomGroups] = useState<GroupDef[]>(() =>
    readCustomGroups(),
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    readCollapsedGroups(),
  );
  const [autoClassify, setAutoClassify] = useState<boolean>(() =>
    readAutoClassify(),
  );

  // Selection mode (long-press)
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupModal, setGroupModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");

  const [ungroupTarget, setUngroupTarget] = useState<GroupDef | null>(null);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [editItem, setEditItem] = useState<ArchiveItem | null>(null);
  const [scheduleItem, setScheduleItem] = useState<ArchiveItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pins, setPins] = useState<Set<string>>(() => readArchivePins());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"space" | "list">("list");
  const [timelineMonth, setTimelineMonth] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<ArchiveItem | null>(null);
  const [detailClusterIds, setDetailClusterIds] = useState<string[] | undefined>(
    undefined,
  );
  const [revival, setRevival] = useState<RevivalHint | null>(() =>
    readRevivalHint(),
  );
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { lenses } = useMemoryLenses(items);
  const { insights: thinkingInsights } = useThinkingInsights();
  const { chapters: journeyChapters, thoughts: journeyThoughts } =
    useMemoryJourney(pins);

  const archiveInsightIds = useMemo(
    () => new Set(items.map((it) => it.id)),
    [items],
  );

  const insightsForArchive = useMemo(
    () =>
      thinkingInsights.map((insight) => ({
        ...insight,
        memoryIds: insight.memoryIds.filter((id) =>
          archiveInsightIds.has(id),
        ),
      })),
    [thinkingInsights, archiveInsightIds],
  );

  useEffect(() => {
    const h = () => {
      setPins(readArchivePins());
      setRevival(readRevivalHint());
      setOverrides(readGroupOverrides());
      setCustomGroups(readCustomGroups());
      setCollapsed(readCollapsedGroups());
    };
    window.addEventListener("itjima:archive-meta", h);
    return () => window.removeEventListener("itjima:archive-meta", h);
  }, []);

  useEffect(() => {
    setFinePointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  const modalOpen = Boolean(
    ungroupTarget || editItem || groupModal || organizeOpen || moveSheetOpen,
  );

  useScrollLock(modalOpen);

  useEffect(() => {
    if (!editItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editItem]);

  useEffect(() => {
    if (!ungroupTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUngroupTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ungroupTarget]);

  useEffect(() => {
    if (!editItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editItem]);

  const allGroups: GroupDef[] = useMemo(
    () => [
      ...BUILTIN_GROUPS.filter((g) => g.key !== "etc"),
      ...customGroups,
      BUILTIN_GROUPS.find((g) => g.key === "etc")!,
    ],
    [customGroups],
  );

  const groupOf = (id: string, text: string) =>
    overrides[id] ?? (autoClassify ? archiveGroup(text).key : "etc");

  const groupLabelFor = (id: string, text: string) => {
    const key = groupOf(id, text);
    const def = allGroups.find((g) => g.key === key);
    if (!def) return null;
    return lang === "en" ? def.en : def.ko;
  };

  const persistOverrides = (next: Record<string, string>) => {
    setOverrides(next);
    writeGroupOverrides(next);
  };
  const persistCustom = (next: GroupDef[]) => {
    setCustomGroups(next);
    writeCustomGroups(next);
  };
  const toggleCollapse = (k: string) => {
    const next = new Set(collapsed);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setCollapsed(next);
    writeCollapsedGroups([...next]);
    haptic(4);
  };

  const groupsWithItems = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((it) => {
      const k = groupOf(it.id, it.text);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return allGroups.filter((g) => (counts.get(g.key) ?? 0) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, overrides, allGroups, autoClassify]);

  const isSearching = q.trim().length > 0;

  const searchMeta = useMemo(() => searchArchiveItems(items, q), [items, q]);

  const pinnedItems = useMemo(() => {
    if (q.trim()) return [];
    let list = items.filter((it) => pins.has(it.id));
    if (groupFilter !== "all") {
      list = list.filter((it) => vaultCategory(it.text) === groupFilter);
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
    if (q.trim()) {
      return searchMeta.hits.map((h) => h.item);
    }
    let list = [...items];
    if (groupFilter !== "all") {
      list = list.filter((it) => vaultCategory(it.text) === groupFilter);
    }
    list = [...list].sort((a, b) => {
      const da = +new Date(a.created_at);
      const db = +new Date(b.created_at);
      return sortOrder === "newest" ? db - da : da - db;
    });
    return list;
  }, [items, q, groupFilter, sortOrder, searchMeta.hits]);

  const v1ListItems = useMemo(() => {
    if (q.trim()) return filtered;
    const pinned = filtered.filter((it) => pins.has(it.id));
    const rest = filtered.filter((it) => !pins.has(it.id));
    return [...pinned, ...rest];
  }, [filtered, pins, q]);

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
    const it = items.find((x) => x.id === id);
    if (it) {
      const gKey = groupOf(it.id, it.text);
      if (collapsed.has(gKey)) {
        const next = new Set(collapsed);
        next.delete(gKey);
        setCollapsed(next);
        writeCollapsedGroups([...next]);
      }
    }
    setExpandedId(id);
    recordArchiveVisit(id);
    setScrollToId(id);
    haptic(4);
  };

  useEffect(() => {
    const jump = consumeRevivalJumpTarget();
    if (jump) jumpToMemory(jump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      if (next) recordArchiveVisit(id);
      return next;
    });
    haptic(3);
  };

  const locale = lang === "en" ? "en-US" : "ko-KR";

  // ---- 키워드 기반 자동 정리 (사용자 지정 그룹은 유지) ----
  const openOrganizeSheet = () => {
    if (items.length === 0) return;
    haptic([6, 18, 10]);
    setOrganizeOpen(true);
  };

  const applyOrganize = (next: Record<string, string>) => {
    persistOverrides(next);
    haptic([6, 20, 8]);
    toast.success(t("키워드로 모았어요", "Grouped by keywords"));
  };

  // ---- Selection ----
  const enterSelection = (id: string) => {
    haptic([8, 12, 8]);
    setSelecting(true);
    setExpandedId(null);
    setSelected(new Set([id]));
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
  const [finePointer, setFinePointer] = useState(false);
  const moveToGroup = (id: string, key: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const auto = archiveGroup(it.text).key;
    const next = { ...overrides };
    if (key === auto) delete next[id];
    else next[id] = key;
    persistOverrides(next);
    haptic([6, 10, 6]);
    toast.success(t("옮겼어요", "Moved"), { duration: 2000 });
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
      const deleted = await remove(it.id);
      track("archive_deleted", { text_length: it.text.length });
      if (!deleted) return;
      showUndoToast(
        t("삭제했어요", "Deleted"),
        async () => {
          await add({
            text: snapshot.text,
            images: snapshot.images,
            source_id: snapshot.source_id,
            raw_text: snapshot.raw_text,
            brain_mirror: snapshot.brain_mirror,
          });
        },
        { durationMs: 10000, undoLabel: t("되돌리기", "Undo") },
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
    opts?: ScheduleSaveOptions,
  ) => {
    if (!scheduleItem) return;
    const it = scheduleItem;
    const reminderMin =
      opts?.reminderMinutes ?? opts?.alarmMinutesBefore ?? null;
    try {
      const alarmPayload =
        reminderMin != null
          ? {
              alarm: true,
              alarm_at: new Date(
                start.getTime() - reminderMin * 60 * 1000,
              ).toISOString(),
            }
          : { alarm: false };
      const allDayFields = scheduleAllDayFieldsFromConfirm({
        allDay: opts?.allDay ?? false,
        startAllDay: opts?.startAllDay ?? opts?.allDay ?? false,
        endAllDay: opts?.endAllDay ?? opts?.allDay ?? false,
      });
      const { cloudSynced: scheduleSynced } = await schedules.add({
        text,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        ...allDayFields,
        repeat: opts?.repeat ?? null,
        alarm: alarmPayload.alarm ?? false,
        alarm_at: alarmPayload.alarm
          ? (alarmPayload as { alarm_at: string }).alarm_at
          : null,
        source_id: it.source_id ?? it.id,
        raw_text: it.raw_text ?? it.text,
        brain_mirror: it.brain_mirror ?? null,
        status: "active",
      });
      const archiveSynced = await remove(it.id);
      track("archive_swiped_schedule", { text_length: it.text.length });
      haptic([6, 18, 8]);
      if (allCloudSynced(scheduleSynced, archiveSynced)) {
        toast.success(t("그때 다시 떠올릴게요", "I'll remember this for then"));
      }
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
        softLabels
        disabled={swipeDisabled}
        leftLabel={t("삭제하기", "Delete")}
        rightLabel={t("할 일", "Tasks")}
        onLongPress={selecting ? undefined : () => enterSelection(it.id)}
        onSwipe={(dir) => {
          if (dir === "right") openScheduleSheet(it);
          else void removeWithUndo(it);
        }}
      >
        <div
          ref={(el) => {
            cardRefs.current[it.id] = el;
          }}
          draggable={!selecting && finePointer}
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
        >
          <ArchiveMemoryCard
            item={it}
            locale={locale}
            expanded={expandedId === it.id}
            selected={isSel}
            selecting={selecting}
            pinned={pins.has(it.id)}
            isDragging={isDragging}
            showRecalledHint={
              !!q.trim() && !!hitById.get(it.id)?.semantic
            }
            showLinkedHint={
              !!q.trim() && !!hitById.get(it.id)?.connected
            }
            allItems={items}
            onToggleExpand={() => toggleExpand(it.id)}
            onToggleSelect={() => toggleSelect(it.id)}
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

  const isSpaceView =
    featureEnabled("ARCHIVE_THOUGHT_MAP") &&
    !isSearching &&
    layoutMode === "space" &&
    groupFilter === "all";

  return (
    <div
      className={`flex h-full flex-col ${
        isSpaceView ? "archive-space-page" : "bg-white"
      }`}
    >
      <SyncIndicator
        syncing={syncState === "syncing"}
        error={syncState === "error"}
        onRetry={retrySync}
      />
      <div
        className={`sticky top-0 z-10 shrink-0 pb-2 ${
          isSpaceView ? "bg-transparent" : "bg-white"
        }`}
      >
        <div className="px-5 pb-2 pt-6">
          {isSpaceView && (
            <p className="mb-2 text-[12px] font-medium text-[color:var(--archive-text-soft)]">
              {t("생각 보관함", "Vault")} › {t("생각 지도", "Thought map")}
            </p>
          )}
          <h1
            className={`font-bold tracking-[-0.02em] ${
              isSpaceView
                ? "text-[26px] text-[color:var(--archive-text)]"
                : "page-title"
            }`}
          >
            {isSpaceView
              ? t("생각 지도", "Thought map")
              : t("보관함", "Archive")}
          </h1>
          <p
            className={`mt-2 leading-relaxed ${
              isSpaceView
                ? "text-[13px] text-[color:var(--archive-text-soft)]"
                : "page-eyebrow text-ink-soft"
            }`}
          >
            {isSpaceView
              ? t(
                  "맡긴 생각들이 연결된 지도예요",
                  "A map of the thoughts you entrusted",
                )
              : t(
                  "저장한 생각을 다시 찾아보세요.",
                  "Find what you saved, when you need it.",
                )}
          </p>
        </div>
        {items.length >= 2 &&
          !isSpaceView &&
          featureEnabled("ARCHIVE_AI_GROUPING") && (
          <div className="flex items-center justify-end px-5 pb-2">
            <button
              type="button"
              onClick={openOrganizeSheet}
              className="touch-press text-[12px] font-medium text-ink-soft/80 underline-offset-2 hover:text-ink-soft active:underline"
            >
              {t("키워드로 모아보기", "Gather by theme")}
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2 px-5 pb-2">
            <div
              className={`flex items-center gap-2 rounded-[var(--radius-lg)] px-3.5 py-2 ${
                isSpaceView
                  ? "archive-space-search shadow-none"
                  : "border border-ink/[0.08] bg-white shadow-card"
              }`}
            >
              <Search
                size={16}
                className={`shrink-0 ${
                  isSpaceView
                    ? "text-[color:var(--archive-text-soft)]"
                    : "text-ink-soft"
                }`}
              />
              <input aria-label={t(
                  "기억하고 싶은 걸 찾아보세요",
                  "Find a thought you kept",
                )}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setExpandedId(null);
                }}
                placeholder={t(
                  "기억하고 싶은 걸 찾아보세요",
                  "Find a thought you kept",
                )}
                className={`flex-1 bg-transparent text-[15px] font-medium focus:outline-none ${
                  isSpaceView
                    ? "text-[color:var(--archive-text)] placeholder:text-[color:var(--archive-text-soft)]"
                    : "text-ink placeholder:text-ink-soft/70"
                }`}
              />
              {q.trim() && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="touch-target shrink-0 rounded-full text-ink-soft"
                  aria-label={t("검색어 지우기", "Clear search")}
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
                    {searchMeta.usedConnected && (
                      <span className="ml-1.5 text-primary">
                        · {t("연결된 기억도", "linked memories too")}
                      </span>
                    )}
                  </>
                ) : (
                  t("검색 결과가 없어요", "Nothing matched")
                )}
              </p>
            )}
            {!isSearching && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none"
              data-testid="archive-category-filters"
            >
                {featureEnabled("ARCHIVE_THOUGHT_MAP") ||
                featureEnabled("ARCHIVE_REVISIT") ? (
                  <div
                    className={`mr-1 flex shrink-0 rounded-full p-0.5 ${
                      isSpaceView ? "archive-space-toggle" : "bg-ink/[0.05]"
                    }`}
                  >
                    {featureEnabled("ARCHIVE_THOUGHT_MAP") && (
                      <>
                        <button
                          type="button"
                          onClick={() => setLayoutMode("list")}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                            layoutMode === "list"
                              ? isSpaceView
                                ? "archive-space-toggle-active"
                                : "bg-white text-ink shadow-card"
                              : isSpaceView
                                ? "text-[color:var(--archive-text-soft)]"
                                : "text-ink-soft"
                          }`}
                        >
                          {t("목록", "List")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLayoutMode("space")}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                            layoutMode === "space"
                              ? isSpaceView
                                ? "archive-space-toggle-active"
                                : "bg-white text-ink shadow-card"
                              : isSpaceView
                                ? "text-[color:var(--archive-text-soft)]"
                                : "text-ink-soft"
                          }`}
                        >
                          {t("생각 지도", "Thought map")}
                        </button>
                      </>
                    )}
                    {featureEnabled("ARCHIVE_REVISIT") && (
                      <Link
                        to="/rediscovery"
                        onClick={tap}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold touch-press ${
                          isSpaceView
                            ? "archive-space-chip text-[color:var(--archive-text-soft)]"
                            : "bg-ink/[0.06] text-ink-soft"
                        }`}
                      >
                        {t("다시 만나기", "Revisit")}
                      </Link>
                    )}
                  </div>
                ) : null}
                {VAULT_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setGroupFilter(f.key)}
                    className={`filter-chip ${
                      groupFilter === f.key
                        ? isSpaceView
                          ? "archive-space-chip-active font-semibold"
                          : "filter-chip-active"
                        : isSpaceView
                          ? "archive-space-chip"
                          : "filter-chip-inactive"
                    }`}
                  >
                    {lang === "en" ? f.en : f.ko}
                  </button>
                ))}
                {featureEnabled("ARCHIVE_NEARBY_SORT") && (
                  <select
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value as "newest" | "oldest")
                    }
                    className="ml-auto shrink-0 rounded-full bg-ink/[0.06] px-3 py-1.5 text-[12px] font-medium text-ink-soft focus:outline-none"
                    aria-label={t("순서", "Order")}
                  >
                    <option value="newest">{t("가까운 순", "Recent first")}</option>
                    <option value="oldest">{t("먼 순", "Oldest first")}</option>
                  </select>
                )}
              </div>
            )}
            {isSearching && featureEnabled("ARCHIVE_NEARBY_SORT") && (
              <div className="mt-2 flex justify-end">
                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as "newest" | "oldest")
                  }
                  className="rounded-full bg-ink/[0.06] px-3 py-1.5 text-[12px] font-medium text-ink-soft focus:outline-none"
                  aria-label={t("순서", "Order")}
                >
                  <option value="newest">{t("가까운 순", "Recent first")}</option>
                  <option value="oldest">{t("먼 순", "Oldest first")}</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-5 px-5 ${selecting ? "pb-28" : "pb-8"}`}>
        {syncState === "syncing" && items.length === 0 ? (
          <ArchiveGridSkeleton />
        ) : items.length === 0 ? (
          <Empty dark={isSpaceView} />
        ) : filtered.length === 0 ? (
          <div
            className="max-h-[220px] rounded-[20px] bg-ink/[0.04] px-5 py-8 text-center"
            data-testid="archive-empty-filter"
          >
            <p className="text-[15px] font-semibold text-ink">
              {q.trim()
                ? t("비슷한 생각을 못 찾았어요", "No similar thoughts found")
                : t("이 묶음은 비어 있어요", "This group is empty")}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {q.trim()
                ? t("다른 키워드로 검색해 보세요", "Try different keywords")
                : t("다른 묶음을 살펴보세요", "Try another group")}
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
        ) : isSearching ? (
          <section data-testid="archive-search-results">
            <div className="flex flex-col gap-3">
              {filtered.map((it) => (
                <ArchiveListRow
                  key={it.id}
                  item={it}
                  locale={locale}
                  categoryLabel={vaultCategoryLabel(vaultCategory(it.text), lang)}
                  groupLabel={groupLabelFor(it.id, it.text)}
                  pinned={pins.has(it.id)}
                  onOpen={() => {
                    recordArchiveVisit(it.id);
                    setDetailItem(it);
                  }}
                  onEditTitle={() => {
                    setEditItem(it);
                    setEditTitle(
                      readArchiveTitles()[it.id] ??
                        archiveDisplayTitle(it.id, it),
                    );
                  }}
                />
              ))}
            </div>
          </section>
        ) : isSpaceView ? (
          <>
            {featureEnabled("REDISCOVERY") &&
              revival &&
              revival.sourceKind === "archive" && (
                <MemoryRevivalHint
                  hint={revival}
                  onRevisit={(id) => {
                    jumpToMemory(id);
                    clearRevivalHint();
                    setRevival(null);
                  }}
                  onDismiss={() => {
                    clearRevivalHint();
                    setRevival(null);
                  }}
                />
              )}
            <ArchiveConnectedGrid
              items={items}
              pins={pins}
              selectedMonth={timelineMonth}
              onSelectMonth={setTimelineMonth}
              onOpenDetail={(it, clusterIds) => {
                recordArchiveVisit(it.id);
                setDetailClusterIds(clusterIds);
                setDetailItem(it);
              }}
            />
          </>
        ) : featureEnabled("ARCHIVE_AI_GROUPING") ? (
          <div
            data-testid="archive-grouped-list"
            className={listStagger.className}
            data-stagger={listStagger["data-stagger"]}
          >
            {featureEnabled("REDISCOVERY") &&
              revival &&
              revival.sourceKind === "archive" && (
                <MemoryRevivalHint
                  hint={revival}
                  onRevisit={(id) => {
                    jumpToMemory(id);
                    clearRevivalHint();
                    setRevival(null);
                  }}
                  onDismiss={() => {
                    clearRevivalHint();
                    setRevival(null);
                  }}
                />
              )}

            {featureEnabled("ARCHIVE_FREQUENT_THOUGHTS") && !isSearching && (
              <ThinkingInsightsSection
                insights={insightsForArchive}
                onRevisit={jumpToMemory}
              />
            )}

            {featureEnabled("ARCHIVE_JOURNEY") && !isSearching && (
              <MemoryJourneySection
                chapters={journeyChapters}
                thoughts={journeyThoughts}
                archiveItems={items}
                onOpenMemory={jumpToMemory}
              />
            )}

            {featureEnabled("ARCHIVE_CONTINUING_THOUGHTS") && !isSearching && (
              <ArchiveDiscoverySection
                lenses={lenses}
                items={items}
                onOpenMemory={jumpToMemory}
              />
            )}

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
                  onDragOver={
                    finePointer
                      ? (e) => {
                          e.preventDefault();
                          if (dragOver !== g.key) setDragOver(g.key);
                        }
                      : undefined
                  }
                  onDragLeave={
                    finePointer
                      ? () => {
                          if (dragOver === g.key) setDragOver(null);
                        }
                      : undefined
                  }
                  onDrop={
                    finePointer
                      ? (e) => {
                          e.preventDefault();
                          const id =
                            e.dataTransfer.getData("text/plain") || dragId;
                          if (id) moveToGroup(id, g.key);
                          setDragOver(null);
                          setDragId(null);
                        }
                      : undefined
                  }
                  className={`rounded-[24px] transition-colors duration-200 ${
                    isDropTarget && finePointer
                      ? "bg-primary/8 ring-2 ring-primary/40"
                      : ""
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
          </div>
        ) : (
          <section
            className="flex flex-col gap-2"
            data-testid="archive-v1-list"
          >
            {v1ListItems.map((it) => (
              <ArchiveListRow
                key={it.id}
                item={it}
                locale={locale}
                categoryLabel={vaultCategoryLabel(vaultCategory(it.text), lang)}
                groupLabel={groupLabelFor(it.id, it.text)}
                pinned={pins.has(it.id)}
                onOpen={() => {
                  recordArchiveVisit(it.id);
                  setDetailItem(it);
                }}
                onEditTitle={() => {
                  setEditItem(it);
                  setEditTitle(
                    readArchiveTitles()[it.id] ??
                      archiveDisplayTitle(it.id, it),
                  );
                }}
              />
            ))}
          </section>
        )}
      </div>

      {/* Selection bottom bar */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 animate-fade-in">
          <div className="glass-strong card-radius flex items-center gap-2 p-2 shadow-float">
            <button type="button"
              onClick={exitSelection}
              className="touch-target flex items-center justify-center rounded-full text-ink-soft hover:bg-white/60"
              aria-label={t("취소", "Cancel")}
            >
              <X size={18} />
            </button>
            <div className="flex-1 px-1 text-[13px] font-semibold text-ink">
              {selected.size}
              {t("개 골랐어요", " picked")}
            </div>
            <button type="button"
              onClick={() => setMoveSheetOpen(true)}
              disabled={selected.size === 0}
              className="touch-press inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-3 py-2 text-[12px] font-semibold text-ink disabled:opacity-50"
            >
              <FolderInput size={14} />
              {t("옮기기", "Move")}
            </button>
            <button type="button"
              onClick={() => setGroupModal(true)}
              disabled={selected.size === 0}
              className="pill-yellow inline-flex items-center gap-1 disabled:opacity-50"
            >
              <FolderPlus size={14} /> {t("모아두기", "Gather")}
            </button>
          </div>
        </div>
      )}

      {/* Create-group modal */}
      {groupModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-center animate-fade-in">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-md"
            onClick={() => setGroupModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-[24px] bg-white/95 p-6 shadow-float backdrop-blur-xl animate-scale-in">
            <div className="text-[17px] font-extrabold text-ink">
              {t("새로 모아두기", "New gathering")}
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {selected.size}
              {t("개 생각을 여기에 모아요.", " thoughts will gather here.")}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
                className="h-12 w-14 rounded-full bg-white/80 text-center text-2xl text-ink input-focus-ring"
                aria-label={t("이모지", "Emoji")}
              />
              <input aria-label={t("이름", "Name")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("이름", "Name")}
                autoFocus
                className="h-12 flex-1 rounded-full bg-white/80 px-4 text-[15px] font-medium text-ink placeholder:text-ink-soft/70 input-focus-ring"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button"
                onClick={() => setGroupModal(false)}
                className="flex-1 rounded-full bg-white/70 py-3 text-[14px] font-semibold text-ink-soft"
              >
                {t("취소", "Cancel")}
              </button>
              <button type="button"
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
          className="fixed inset-0 z-50 flex flex-col justify-end"
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
              {t("생각은 그대로 남아요.", "Your thoughts stay.")}
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
          className="fixed inset-0 z-50 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-edit-title"
          data-testid="archive-edit-dialog"
          onClick={() => setEditItem(null)}
        >
          <div className="flex-1 animate-fade-in bg-ink/30 backdrop-blur-sm" />
          <div
            className="animate-slide-up rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="archive-edit-title" className="text-[17px] font-bold text-ink">
              {t("이름 다듬기", "Refine name")}
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
                toast.success(t("다듬었어요", "Refined"));
              }}
              className="mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink"
            >
              {t("다듬기", "Refine")}
            </button>
          </div>
        </div>
      )}
      <ArchiveMemoryDetail
        item={detailItem}
        allItems={items}
        pinned={detailItem ? pins.has(detailItem.id) : false}
        clusterMemberIds={detailClusterIds}
        dark={isSpaceView}
        onClose={() => {
          setDetailItem(null);
          setDetailClusterIds(undefined);
        }}
        onTogglePin={() => {
          if (!detailItem) return;
          toggleArchivePin(detailItem.id);
          setPins(readArchivePins());
        }}
        onRemove={
          detailItem
            ? () => {
                void removeWithUndo(detailItem);
                setDetailItem(null);
                setDetailClusterIds(undefined);
              }
            : undefined
        }
        onOpenRelated={(rel) => {
          recordArchiveVisit(rel.id);
          setDetailItem(rel);
        }}
      />
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
          void confirmScheduleFromArchive(text, start, end, opts);
        }}
      />
    </div>
  );
}

function Empty({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "text-[color:var(--archive-text-soft)]" : undefined}>
      <EmptyState
        emoji="🗂"
        titleKo="아직 여기에 둔 게 없어요"
        titleEn="Nothing tucked away yet"
        hintKo="나중에 꺼낼 때를 위해."
        hintEn="For when you want it back."
      />
    </div>
  );
}
