import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useArchive, useInbox, useSchedules, type InboxItem } from "@/lib/store";
import { featureEnabled } from "@/lib/features";
import { useLang, useT } from "@/lib/i18n";
import {
  buildRediscoveryPool,
  dismissRediscovery,
  markRediscoverySessionShown,
  pickRediscoveryCandidate,
  rediscoveryDisplayTitle,
  snoozeRediscovery,
  type RediscoveryPick,
} from "@/lib/rediscoveryPick";
import {
  trackRediscoveryAction,
  trackRediscoveryUt,
} from "@/lib/rediscoveryAnalytics";
import { recordArchiveVisit } from "@/lib/archiveMeta";
import { setRevivalJumpTarget } from "@/lib/memoryRevival";

export function HomeRediscoveryCard() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const inbox = useInbox();
  const archive = useArchive();
  const schedules = useSchedules();
  const enabled = featureEnabled("REDISCOVERY");
  const [selected, setSelected] = useState<RediscoveryPick | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [handled, setHandled] = useState(false);
  const impressionRef = useRef<string | null>(null);

  const pool = useMemo(
    () => (enabled ? buildRediscoveryPool(inbox.items, archive.items) : []),
    [enabled, inbox.items, archive.items],
  );
  const candidate = useMemo(
    () => (enabled ? pickRediscoveryCandidate(pool, schedules.items) : null),
    [enabled, pool, schedules.items],
  );

  useEffect(() => {
    if (!selected && candidate) setSelected(candidate);
  }, [candidate, selected]);

  const pick = selected;

  useEffect(() => {
    if (!pick || handled || impressionRef.current === pick.key) return;
    impressionRef.current = pick.key;
    markRediscoverySessionShown(pick.key);
    trackRediscoveryUt("impression", pick);
  }, [pick, handled]);

  if (!enabled || !pick || handled) return null;

  const title = rediscoveryDisplayTitle(pick.memory);
  const relatedTitle = pick.relatedContext
    ? rediscoveryDisplayTitle(pick.relatedContext)
    : null;

  const reasonLabel =
    pick.reason === "upcoming_schedule"
      ? t("곧 필요한 기록", "You may need this soon")
      : pick.reason === "related_capture"
        ? t("최근 기록과 이어지는 생각", "May connect with a recent capture")
        : pick.reason === "long_unvisited"
          ? t("오래 묻혀 있던 기록", "A record that's been quiet")
          : t("오늘 다시 떠오른 기록", "A record resurfaced today");

  const openOriginal = () => {
    trackRediscoveryAction("open_record", pick);
    recordArchiveVisit(pick.key);

    if (pick.memory.rediscovery_source === "archive") {
      setRevivalJumpTarget(pick.memory.id);
      void navigate({ to: "/archive" });
      return;
    }

    window.dispatchEvent(
      new CustomEvent<InboxItem>("itjima:open-record-detail", {
        detail: pick.memory as InboxItem,
      }),
    );
  };

  const openSchedule = () => {
    if (pick.relatedSchedule?.id) {
      sessionStorage.setItem("itjima.openScheduleEdit", pick.relatedSchedule.id);
    }
    trackRediscoveryAction("view_schedule", pick);
    void navigate({ to: "/schedule" });
  };

  return (
    <section
      className="mt-2 rounded-[24px] border border-ink/[0.06] bg-[#FFF8CF] px-5 py-4 shadow-card"
      data-testid="home-rediscovery-card"
      aria-label={t("다시 떠오른 기록", "Resurfaced record")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.03em] text-ink-soft/65">
            {t("다시 떠오른 기록", "RESURFACED")}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-ink/75">
            {reasonLabel}
          </p>
        </div>
        <span className="shrink-0 text-[12px] font-bold text-ink/35">&gt;ij&lt;</span>
      </div>

      <h3 className="mt-3 text-[17px] font-bold leading-[1.45] tracking-[-0.02em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft">
        {lang === "en" ? pick.nudgeEn : pick.nudgeKo}
      </p>

      {expanded && (
        <div className="mt-4 rounded-[18px] bg-white/65 px-4 py-3">
          {pick.reason === "related_capture" && relatedTitle && (
            <>
              <p className="text-[11px] font-semibold text-ink-soft/65">
                {t("최근 남긴 기록", "RECENT CAPTURE")}
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-[1.45] text-ink/80">
                {relatedTitle}
              </p>
              <p className="mt-1 text-[12px] leading-[1.45] text-ink-soft/75">
                {t(
                  "겹치는 주제가 보여 함께 떠올려볼 수 있게 꺼냈어요.",
                  "A few shared topics made this worth resurfacing together.",
                )}
              </p>
            </>
          )}

          {pick.reason !== "related_capture" && (
            <p className="text-[12px] leading-[1.5] text-ink-soft/80">
              {pick.reason === "upcoming_schedule"
                ? t(
                    "연결된 일정이 7일 안으로 다가오고 있어요.",
                    "A connected schedule is within the next 7 days.",
                  )
                : pick.reason === "long_unvisited"
                  ? t(
                      "오랫동안 다시 열어보지 않은 기록 중 하나예요.",
                      "This is one of your records you haven't opened in a while.",
                    )
                  : t(
                      "최근 다시 보지 않은 기록 중 하나를 가볍게 꺼냈어요.",
                      "This is one of your records that hasn't resurfaced recently.",
                    )}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!expanded ? (
          <button
            type="button"
            onClick={() => {
              trackRediscoveryUt("open", pick);
              recordArchiveVisit(pick.key);
              setExpanded(true);
            }}
            className="touch-press rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            {t("왜 다시 보여줬지?", "Why this now?")}
          </button>
        ) : pick.reason === "upcoming_schedule" ? (
          <button
            type="button"
            onClick={openSchedule}
            className="touch-press rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            {t("연결된 일정 보기", "View schedule")}
          </button>
        ) : (
          <button
            type="button"
            onClick={openOriginal}
            className="touch-press rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            {t("원래 기록 열기", "Open original")}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            trackRediscoveryUt("later", pick);
            snoozeRediscovery(pick.key);
            setHandled(true);
          }}
          className="touch-press rounded-full px-3 py-2.5 text-[12px] font-semibold text-ink-soft"
        >
          {t("3일 뒤", "In 3 days")}
        </button>
        <button
          type="button"
          onClick={() => {
            trackRediscoveryUt("hide", pick);
            dismissRediscovery(pick.key);
            setHandled(true);
          }}
          className="touch-press rounded-full px-3 py-2.5 text-[12px] font-medium text-ink-soft/65"
        >
          {t("다시 안 보기", "Don't resurface")}
        </button>
      </div>
    </section>
  );
}
