type BrandLogoSize = "app" | "native" | "micro";

type BrandLogoProps = {
  size?: BrandLogoSize;
  className?: string;
};

const WORDMARK_SRC = "/brand/itjima-wordmark-v7.png";

/**
 * Canonical Itjima wordmark.
 * Source of truth: final brand artwork approved 2026-09-02.
 *
 * Product UI typography remains independent from the logo artwork.
 */
export function BrandLogo({ size = "app", className = "" }: BrandLogoProps) {
  return (
    <span
      data-testid="brand-logo"
      data-brand-source="final-2026-09-02"
      className={`itjima-brand-logo itjima-brand-logo--${size} ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        className="itjima-brand-logo-wordmark"
        src={WORDMARK_SRC}
        alt=""
        draggable={false}
      />
    </span>
  );
}
