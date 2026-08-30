# Visual QA Report — 2026-08-30

## Scope

Visual-only audit against the current landing brand direction and the app chrome contract. Product behavior is intentionally out of scope.

## Locked baseline

- Canonical logo: lowercase `itjima`
- Logo type: Playpen Sans Medium 500
- Mobile chrome: 56px header / 20px horizontal gutter / 44px minimum touch target
- Product titles: Pretendard, no brand dot
- Brand dot and product action yellow remain separate concepts

## High-priority discrepancies to keep watching

1. **Brand drift across surfaces**
   - No Korean `잊지마` or uppercase `ITJIMA` may reappear in logo positions.
   - Auth, landing, tablet, desktop, and mobile chrome must share the same wordmark treatment.

2. **Multiple CSS override layers**
   - Current UI styling is spread across many sequential CSS files.
   - Pixel fixes should consolidate existing rules instead of adding a new last-wins override whenever possible.
   - Any visual regression that depends on import order is treated as a system issue, not a one-off spacing issue.

3. **Header alignment**
   - Mobile header target: 56px.
   - Left/right gutter target: 20px.
   - Search/account controls: 44×44px minimum.
   - Logo should not jump horizontally or vertically between Home and Schedule.

4. **Composer and bottom navigation**
   - Resting composer height and bottom-safe-area spacing must be identical across equivalent Home states.
   - Stateful composer growth is allowed; unexplained resting-state movement is not.
   - Bottom navigation should not shift because of route-specific CSS overrides.

5. **Typography hierarchy**
   - Logo: Playpen Sans Medium only.
   - Functional UI: Pretendard/system.
   - Avoid introducing editorial/brand typography into dense controls, form labels, schedule details, or settings.

6. **Color semantics**
   - Launcher master yellow: `#FFF986`.
   - Logo wordmark ink: `#2E2E2E`.
   - Landing logo dot: `#FFE658`.
   - Product schedule/action yellow remains a separate semantic token.
   - Marketing blue may appear on landing/editorial surfaces but should not silently become a core schedule/status color.

7. **Radius / shadow consistency**
   - Pills should be intentional, not the accidental result of a later CSS file overriding a component radius.
   - Sheets/cards should use a small, repeatable elevation set rather than per-screen shadow invention.

## Brand asset QA

- Launcher icon visually matches the approved `ij` artwork.
- 192 and 512 PWA images use fresh v4 URLs.
- favicon uses the same `ij` master.
- social preview uses the same symbol and yellow field at 1200×630.
- manifest, static HTML metadata, and runtime SEO point to the same assets.

## Fix policy during full QA

- Blocker: invisible/broken UI, overlap, unreachable primary control.
- Major: layout shift that changes comprehension or tap behavior; brand mark mismatch.
- Minor: 4–8px inconsistency, type/spacing mismatch visible in normal use.
- Polish: sub-4px optical alignment, shadow/radius refinements.

Do not mix functional feature work into visual-only fixes unless the visual bug is caused by an actual state/behavior defect.
