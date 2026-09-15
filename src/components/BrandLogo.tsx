type BrandLogoSize = "app" | "native" | "micro";

type BrandLogoProps = {
  size?: BrandLogoSize;
  className?: string;
};

const WORDMARK_SRC = "/brand/itjima-wordmark-v8.png";
const WORDMARK_WIDTH = 1192;
const WORDMARK_HEIGHT = 746;

/**
 * Canonical Itjima wordmark.
 * Source of truth: padded lowercase lockup (repaired 2026-09-15 after corrupt export).
 *
 * Deliberately uses v8-only class names so retired logo CSS cannot crop it.
 */
export function BrandLogo({ size = "app", className = "" }: BrandLogoProps) {
  return (
    <span
      data-testid="brand-logo"
      data-brand-source="final-2026-09-14-jost"
      data-brand-size={size}
      className={`itjima-wordmark-v8 itjima-wordmark-v8--${size} ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        className="itjima-wordmark-v8-image"
        src={WORDMARK_SRC}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        alt=""
        draggable={false}
      />
    </span>
  );
}
