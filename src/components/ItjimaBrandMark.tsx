type Props = {
  size?: number;
  className?: string;
};

export function ItjimaBrandMark({ size = 40, className = "" }: Props) {
  return (
    <span
      className={`itjima-brand-mark ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" role="presentation" focusable="false">
        <rect x="2" y="2" width="44" height="44" rx="14" className="itjima-brand-mark-bg" />
        <path
          d="M13.5 13.5h18.8c3.15 0 5.7 2.55 5.7 5.7v7.8c0 3.15-2.55 5.7-5.7 5.7H23l-7.1 5.8v-5.8h-2.4c-3.04 0-5.5-2.46-5.5-5.5v-8.2c0-3.04 2.46-5.5 5.5-5.5Z"
          className="itjima-brand-mark-bubble"
        />
        <circle cx="17" cy="23" r="2.35" className="itjima-brand-mark-dot itjima-brand-mark-dot-a" />
        <circle cx="24" cy="23" r="2.35" className="itjima-brand-mark-dot itjima-brand-mark-dot-b" />
        <circle cx="31" cy="23" r="2.35" className="itjima-brand-mark-dot itjima-brand-mark-dot-c" />
      </svg>
    </span>
  );
}
