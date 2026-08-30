type BrandLogoSize = "app" | "native" | "micro";

type BrandLogoProps = {
  size?: BrandLogoSize;
  className?: string;
};

/**
 * Canonical Itjima lockup.
 * Source of truth: Figma landing node 455:33.
 *
 * Do not replace the wordmark with a product UI font. Functional screen titles
 * remain Pretendard and must not borrow the yellow brand dot.
 */
export function BrandLogo({ size = "app", className = "" }: BrandLogoProps) {
  return (
    <span
      data-testid="brand-logo"
      data-brand-source="figma-455-33"
      className={`itjima-brand-logo itjima-brand-logo--${size} ${className}`.trim()}
      aria-hidden="true"
    >
      <span className="itjima-brand-logo-dot" />
      <span className="itjima-brand-logo-wordmark">itjima</span>
    </span>
  );
}
