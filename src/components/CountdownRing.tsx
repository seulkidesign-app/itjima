import { formatRemainingCompact } from "@/lib/scheduleTime";

type Props = {
  progress: number;
  target: Date;
  lang: "ko" | "en";
  size?: number;
  urgent?: boolean;
  className?: string;
};

export function CountdownRing({
  progress,
  target,
  lang,
  size = 56,
  urgent,
  className = "",
}: Props) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = c * (1 - clamped);
  const label = formatRemainingCompact(target, lang);
  const past = target.getTime() <= Date.now();

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-ink/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={
            past ? "text-ink/30" : urgent ? "text-ink" : "text-primary"
          }
          style={{ transition: "stroke-dashoffset 0.35s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-num text-center font-extrabold leading-none text-ink ${
            size >= 64 ? "text-[13px]" : "text-[11px]"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
