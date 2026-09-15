type BrandLogoSize = "app" | "native" | "micro";

type BrandLogoProps = {
  size?: BrandLogoSize;
  className?: string;
};

const WORDMARK_SRC = "/brand/itjima-wordmark-v8.png";

/**
 * Canonical Itjima wordmark.
 * Source of truth: Jost-based final brand artwork approved 2026-09-14.
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
        width={809}
        height={347}
        alt=""
        draggable={false}
      />
    </span>
  );
}
