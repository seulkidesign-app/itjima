import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { useLang, useT } from "@/lib/i18n";
import { useUserId, type ScheduleItem } from "@/lib/store";
import { resolveScheduleAllDayFlags } from "@/lib/scheduleTime";
import { scheduleDisplayTitle, rawPreview } from "@/lib/thoughtProvenance";

const MISSING_TARGET_TIMEOUT_MS = 10_000;

function scheduleStorageKeys(userId: string | null) {
  const keys = [`itjima.${userId ?? "guest"}.schedules`];
  if (userId) keys.push("itjima.guest.schedules");
  return keys;
}

function readScheduleTarget(
  id: string,
  userId: string | null,
): ScheduleItem | null {
  if (typeof window === "undefined") return null;

  for (const key of scheduleStorageKeys(userId)) {
    try {
      const rows = JSON.parse(localStorage.getItem(key) || "[]") as ScheduleItem[];
      const found = rows.find((row) => row.id === id);
      if (found) return found;
    } catch {
      // A damaged bucket should not block the rest of the app.
    }
  }

  return null;
}

function clearOpenParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete("open");
  const query = url.searchParams.toString();
  const next = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

function formatScheduleRange(
  item: ScheduleItem,
  lang: "ko" | "en",
): string {
  const locale = lang === "en" ? "en-US" : "ko-KR";
  const start = new Date(item.start_time);
  const end = new Date(item.end_time);
  const flags = resolveScheduleAllDayFlags(item);

  if (flags.startAllDay && flags.endAllDay) {
    const startLabel = start.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const endLabel = end.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  }

  const startLabel = start.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endLabel = end.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${startLabel} – ${endLabel}`;
}

export function ScheduleDeepLinkBridge() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const userId = useUserId();
  const t = useT();
  const { lang } = useLang();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [target, setTarget] = useState<ScheduleItem | null>(null);
  const missingNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname !== "/schedule") {
      setTargetId(null);
      setTarget(null);
      return;
    }

    const id = new URLSearchParams(window.location.search).get("open");
    setTargetId(id);
    setTarget(id ? readScheduleTarget(id, userId) : null);
  }, [pathname, userId]);

  useEffect(() => {
    if (!targetId || pathname !== "/schedule") return;

    const refresh = () => {
      const found = readScheduleTarget(targetId, userId);
      if (found) {
        missingNotifiedRef.current = null;
        setTarget(found);
      }
    };

    const onStorageUpdate = (event: Event) => {
      const key = (event as CustomEvent<string>).detail;
      if (typeof key === "string" && key.endsWith(".schedules")) refresh();
    };

    refresh();
    window.addEventListener("itjima:update", onStorageUpdate as EventListener);
    window.addEventListener("storage", refresh);

    const missingTimer = window.setTimeout(() => {
      if (readScheduleTarget(targetId, userId)) return;
      if (missingNotifiedRef.current === targetId) return;
      missingNotifiedRef.current = targetId;
      toast.message(
        t(
          "이 일정은 다른 기기에서 삭제됐거나 아직 동기화되지 않았어요.",
          "This schedule was removed elsewhere or has not synced yet.",
        ),
      );
      clearOpenParam();
      setTargetId(null);
    }, MISSING_TARGET_TIMEOUT_MS);

    return () => {
      window.clearTimeout(missingTimer);
      window.removeEventListener("itjima:update", onStorageUpdate as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname, targetId, t, userId]);

  const rangeLabel = useMemo(
    () => (target ? formatScheduleRange(target, lang === "en" ? "en" : "ko") : ""),
    [lang, target],
  );

  const close = () => {
    clearOpenParam();
    setTargetId(null);
    setTarget(null);
  };

  return (
    <BottomSheet
      open={pathname === "/schedule" && Boolean(target)}
      onClose={close}
      maxHeight="62dvh"
      title={t("일정 상세", "Schedule details")}
    >
      {target && (
        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
          <p className="text-[12px] font-semibold text-ink-soft">
            {t("알림에서 연 일정", "Opened from a reminder")}
          </p>
          <h2 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-ink">
            {scheduleDisplayTitle(target)}
          </h2>
          <p className="mt-3 rounded-[16px] bg-ink/[0.035] px-4 py-3 text-[14px] font-medium leading-relaxed text-ink">
            {rangeLabel}
          </p>
          {target.alarm && (
            <p className="mt-2 text-[13px] text-ink-soft">
              {t("알림이 설정된 일정이에요.", "A reminder is set for this schedule.")}
            </p>
          )}
          {rawPreview(target) && rawPreview(target) !== scheduleDisplayTitle(target) && (
            <div className="mt-4 rounded-[16px] border border-ink/[0.07] px-4 py-3">
              <p className="text-[11px] font-semibold text-ink-soft">
                {t("처음 남긴 내용", "Original thought")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                {rawPreview(target)}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={close}
            className="touch-press mt-5 min-h-12 w-full rounded-full bg-ink px-5 text-[15px] font-semibold text-white"
          >
            {t("일정 목록으로", "Back to schedules")}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
