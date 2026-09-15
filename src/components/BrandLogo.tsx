type BrandLogoSize = "app" | "native" | "micro";

type BrandLogoProps = {
  size?: BrandLogoSize;
  className?: string;
};

/** Cache-bust when artwork changes so CDN/PWA never keep a corrupt export. */
export const WORDMARK_VERSION = "20260915-2";
export const WORDMARK_SRC = `/brand/itjima-wordmark-v8.svg?v=${WORDMARK_VERSION}`;
export const WORDMARK_WIDTH = 593;
export const WORDMARK_HEIGHT = 307;

/**
 * Canonical Itjima wordmark.
 * Uses the SVG lockup so tittles/descenders cannot be cropped by a bad PNG export.
 */
export function BrandLogo({ size = "app", className = "" }: BrandLogoProps) {
  return (
    <span
      data-testid="brand-logo"
      data-brand-source="wordmark-v8-svg"
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
