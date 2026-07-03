import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { InboxItem } from "@/lib/store";
import { haptic } from "@/lib/haptics";

export type Bucket = "schedule" | "archive";

declare global {
  interface Window {
    __aiOrganizeState?: {
      flying: Record<string, Bucket>;
      glow: Record<string, Bucket>;
    };
  }
}

const SCHEDULE_KW = [
  "날짜",
  "시간",
  "오늘",
  "내일",
  "모레",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
  "일요일",
  "시",
  "오전",
  "오후",
  "저녁",
  "아침",
  "약속",
  "미팅",
  "예약",
  "마감",
];
const ARCHIVE_KW = [
  "카페",
  "식당",
  "여행",
  "맛집",
  "책",
  "영상",
  "유튜브",
  "영화",
  "드라마",
  "아이디어",
  "기획",
  "음악",
  "쇼핑",
  "구매",
  "링크",
  "참고",
];

export function classify(text: string): Bucket {
  const t = text || "";
  if (SCHEDULE_KW.some((k) => t.includes(k))) return "schedule";
  if (/\b\d{1,2}(시|:\d{2})\b/.test(t)) return "schedule";
  if (ARCHIVE_KW.some((k) => t.includes(k))) return "archive";
  return "archive";
}

type Props = {
  items: InboxItem[];
  /** Commit all moves at once, AFTER animation completes. */
  onCommit: (plan: { id: string; bucket: Bucket }[]) => Promise<void> | void;
  label: string;
  analyzing: string;
};

export function AIOrganizeButton({ items, onCommit, label, analyzing }: Props) {
  const [phase, setPhase] = useState<
    "idle" | "analyzing" | "animating" | "committing" | "done"
  >("idle");
  const [flying, setFlying] = useState<Record<string, Bucket>>({});
  const [glow, setGlow] = useState<Record<string, Bucket>>({});
  const [counts, setCounts] = useState({ s: 0, a: 0, total: 0 });

  const reset = () => {
    setPhase("idle");
    setFlying({});
    setGlow({});
    window.__aiOrganizeState = { flying: {}, glow: {} };
    window.dispatchEvent(new CustomEvent("ai-organize:state"));
  };

  const start = async () => {
    if (!items.length || phase !== "idle") return;
    haptic([6, 20, 10]);
    setPhase("analyzing");

    const plan = items.map((it) => ({ id: it.id, bucket: classify(it.text) }));
    const s = plan.filter((p) => p.bucket === "schedule").length;
    const a = plan.length - s;

    // pulsing "분석 중..." for 1.2s
    await new Promise((r) => setTimeout(r, 1200));
    setPhase("animating");

    // One-by-one glow → fly out (200ms per card). Cards remain rendered
    // (no removal yet) so the transform animation is actually visible.
    for (let i = 0; i < plan.length; i++) {
      const { id, bucket } = plan[i];
      setGlow((g) => ({ ...g, [id]: bucket }));
      await new Promise((r) => setTimeout(r, 120));
      setFlying((f) => ({ ...f, [id]: bucket }));
      haptic(5);
      await new Promise((r) => setTimeout(r, 200));
    }

    // Let the last card finish its flight before unmount
    await new Promise((r) => setTimeout(r, 350));

    setPhase("committing");
    await onCommit(plan);

    setCounts({ s, a, total: plan.length });
    setPhase("done");
    haptic([8, 30, 12]);
  };

  // expose flying/glow state to OrganizeFxWrapper via window event
  useEffect(() => {
    window.__aiOrganizeState = { flying, glow };
    window.dispatchEvent(new CustomEvent("ai-organize:state"));
  }, [flying, glow]);

  const reduction = counts.total ? 43 : 0;

  return (
    <>
      {items.length >= 1 && (
        <div className="px-5 pb-3">
          <button
            onClick={start}
            disabled={phase !== "idle"}
            className={`w-full bg-ink py-4 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white transition active:scale-[0.98] ${
              phase === "analyzing" ? "animate-pulse" : ""
            } disabled:opacity-80`}
            style={{ borderRadius: 999 }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Sparkles
                size={14}
                className={
                  phase === "analyzing"
                    ? "animate-spin text-primary"
                    : "text-primary"
                }
              />
              {phase === "analyzing" ? analyzing : label}
            </span>
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-md"
            onClick={reset}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-white/40 bg-white/70 p-7 text-center shadow-float backdrop-blur-xl animate-scale-in">
            <div className="text-6xl">🧠</div>
            <div className="mt-3 text-[20px] font-extrabold text-ink">
              머릿속이 가벼워졌어요
            </div>
            <div className="mt-2 text-sm text-ink-soft">
              📅 일정 {counts.s}개 &nbsp; 🗂 보관 {counts.a}개 로 정리했어요
            </div>
            <div className="mt-5 rounded-2xl bg-white/60 px-4 py-4 text-[18px] font-extrabold leading-snug text-ink">
              당신의 머릿속이 {reduction}% 가벼워졌어요.
            </div>
            <button
              onClick={reset}
              className="mt-5 w-full rounded-full bg-primary py-3 text-[15px] font-bold text-ink active:scale-95"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Subscribe to fly/glow state for one card id */
export function useOrganizeFx(id: string) {
  const [state, setState] = useState<{ flying?: Bucket; glow?: Bucket }>({});
  useEffect(() => {
    const read = () => {
      const s = window.__aiOrganizeState ?? { flying: {}, glow: {} };
      setState({ flying: s.flying[id], glow: s.glow[id] });
    };
    read();
    window.addEventListener("ai-organize:state", read);
    return () => window.removeEventListener("ai-organize:state", read);
  }, [id]);
  return state;
}
