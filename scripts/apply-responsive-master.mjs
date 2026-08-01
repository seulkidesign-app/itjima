import fs from "node:fs";
import path from "node:path";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
  console.log(`Updated ${file}`);
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing source for ${label}`);
  return source.replace(before, after);
}

const responsiveCss = `/*
 * Itjima responsive master layer
 * Device-specific layout contracts from 320px phones to 1920px workstations.
 */

:root {
  --ij-shell-gap: clamp(0px, 1.4vw, 24px);
  --ij-mobile-inline: clamp(12px, 4vw, 18px);
  --ij-tablet-inline: clamp(24px, 4vw, 44px);
  --ij-desktop-inline: clamp(32px, 4vw, 64px);
  --ij-readable: 70rem;
  --ij-chat-readable: 55rem;
}

html,
body,
#root {
  width: 100%;
  min-width: 320px;
  min-height: 100%;
  overflow-x: clip;
}

body {
  min-height: 100svh;
  min-height: 100dvh;
  overscroll-behavior-x: none;
}

.itjima-app-stage {
  min-height: 100svh;
  min-height: 100dvh;
  width: 100%;
  overflow: clip;
}

.itjima-app-workspace {
  isolation: isolate;
  container-type: inline-size;
  container-name: itjima-workspace;
}

.itjima-app-content,
.itjima-app-scroll {
  min-width: 0;
  min-height: 0;
}

.itjima-app-scroll {
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.phone-frame :where(h1, h2, h3, p, li, span, small, strong, button, a) {
  overflow-wrap: anywhere;
}

.phone-frame :where(img, svg, video, canvas) {
  max-width: 100%;
}

.phone-frame :where(button, a, [role="button"], [role="tab"], [role="menuitem"]) {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.phone-frame .page-shell,
.phone-frame .home-chat-lane,
.phone-frame form.composer-hero {
  min-width: 0;
}

.bottom-sheet-root {
  padding-inline: max(0px, env(safe-area-inset-left));
}

.bottom-sheet-panel {
  width: min(100%, 680px) !important;
  max-height: min(var(--sheet-max-h), calc(100dvh - 16px)) !important;
}

.phone-frame [data-testid="inbox-context-menu"] {
  width: min(calc(100% - 24px), 430px);
  max-height: min(68dvh, 620px);
  margin-inline: auto !important;
  overflow-y: auto;
  overscroll-behavior: contain;
}

@media (pointer: coarse) {
  .phone-frame :where(button, a, [role="button"], [role="tab"], [role="menuitem"]) {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (hover: hover) and (pointer: fine) {
  .itjima-desktop-nav-item,
  .phone-frame button,
  .phone-frame a {
    transition-duration: 160ms;
  }
}

/* Small and standard phones: one-hand reach, full-bleed surface. */
@media (max-width: 639px) {
  .itjima-app-stage[data-layout="app"] {
    padding: 0 !important;
    align-items: stretch !important;
  }

  .itjima-responsive-frame {
    width: 100% !important;
    max-width: none !important;
    height: 100svh !important;
    height: 100dvh !important;
    min-height: 100svh !important;
    min-height: 100dvh !important;
    border: 0 !important;
    border-radius: 0 !important;
  }

  .phone-frame .app-top-nav {
    flex: 0 0 auto;
  }

  .phone-frame .app-top-nav-bar {
    min-height: 52px;
    padding-inline: var(--ij-mobile-inline) !important;
  }

  .phone-frame .app-brand-trigger,
  .phone-frame .app-account-button,
  .phone-frame .app-primary-tab {
    min-height: 44px;
  }

  .phone-frame .app-primary-tabs {
    gap: 2px;
    padding-inline: max(8px, calc(var(--ij-mobile-inline) - 4px)) !important;
  }

  .phone-frame .app-primary-tab {
    padding-inline: 4px !important;
    white-space: normal !important;
    text-align: center;
  }

  .phone-frame .home-chat-lane {
    padding-inline: var(--ij-mobile-inline) !important;
    scroll-padding-bottom: calc(190px + env(safe-area-inset-bottom));
  }

  .phone-frame form.composer-hero {
    width: calc(100% - (var(--ij-mobile-inline) * 2)) !important;
    margin-inline: var(--ij-mobile-inline) !important;
    padding-bottom: max(6px, env(safe-area-inset-bottom));
  }

  .phone-frame form.composer-hero > div:first-child {
    scroll-snap-type: x proximity;
    scroll-padding-inline: 2px;
  }

  .phone-frame form.composer-hero > div:first-child > button {
    min-height: 44px !important;
    height: 44px !important;
    scroll-snap-align: start;
  }

  .phone-frame .capture-submit-button {
    min-width: 52px !important;
    min-height: 44px !important;
    height: 44px !important;
  }

  .phone-frame :where(input, textarea, select) {
    font-size: max(16px, 1em);
  }

  .bottom-sheet-root[data-layout="sheet"] {
    justify-content: flex-end;
  }

  .bottom-sheet-root[data-layout="sheet"] .bottom-sheet-panel {
    width: 100% !important;
    max-width: none !important;
    max-height: min(var(--sheet-max-h), calc(100dvh - 8px)) !important;
    border-radius: 26px 26px 0 0 !important;
  }

  .phone-frame [data-testid="inbox-context-menu"] {
    margin-bottom: calc(88px + env(safe-area-inset-bottom)) !important;
  }
}

@media (max-width: 359px) {
  .phone-frame .app-top-nav-bar {
    min-height: 48px;
    padding-block: 2px !important;
  }

  .phone-frame .app-brand-trigger {
    font-size: 17px !important;
  }

  .phone-frame .app-account-button {
    padding-inline: 10px !important;
  }

  .phone-frame .app-primary-tab {
    font-size: 11.5px !important;
    letter-spacing: -0.02em;
  }

  .phone-frame .itjima-empty-hero {
    padding-inline: 2px !important;
  }

  .phone-frame .itjima-empty-proof {
    min-width: 0;
  }
}

@media (min-width: 480px) and (max-width: 639px) {
  .phone-frame .home-chat-lane,
  .phone-frame form.composer-hero {
    width: min(calc(100% - 40px), 560px) !important;
    margin-inline: auto !important;
  }

  .phone-frame .itjima-empty-hero {
    width: min(100%, 560px);
    margin-inline: auto;
  }
}

/* Short phones and landscape phones: keep the composer and primary action reachable. */
@media (max-height: 620px) and (max-width: 1023px) {
  .phone-frame .app-top-nav-bar {
    min-height: 44px;
    padding-top: 1px !important;
    padding-bottom: 1px !important;
  }

  .phone-frame .app-primary-tab {
    min-height: 40px;
    padding-block: 5px !important;
  }

  .phone-frame .itjima-empty-orb {
    display: none;
  }

  .phone-frame .itjima-empty-hero {
    padding-top: 8px !important;
  }

  .phone-frame .home-chat-lane:has(.itjima-empty-hero) {
    padding-bottom: calc(176px + env(safe-area-inset-bottom)) !important;
  }

  .bottom-sheet-panel {
    max-height: calc(100dvh - 4px) !important;
  }
}

/* Portrait tablets: focused centered canvas with generous touch spacing. */
@media (min-width: 640px) and (max-width: 899px) {
  .itjima-app-stage[data-layout="app"] {
    padding: clamp(12px, 2.2vw, 20px) !important;
    align-items: center !important;
  }

  .itjima-responsive-frame {
    width: min(100%, 860px) !important;
    max-width: 860px !important;
    height: calc(100dvh - clamp(24px, 4.4vw, 40px)) !important;
    min-height: calc(100dvh - clamp(24px, 4.4vw, 40px)) !important;
    border-radius: clamp(22px, 3vw, 30px) !important;
  }

  .phone-frame .app-top-nav-bar {
    max-width: 780px !important;
    padding-inline: var(--ij-tablet-inline) !important;
  }

  .phone-frame .app-primary-tabs {
    width: min(100%, 620px) !important;
    max-width: 620px !important;
  }

  .phone-frame .home-chat-lane,
  .phone-frame form.composer-hero {
    width: min(calc(100% - 48px), 720px) !important;
    max-width: 720px !important;
    margin-inline: auto !important;
  }

  .phone-frame .itjima-empty-hero {
    width: min(100%, 720px);
    margin-inline: auto;
  }

  .phone-frame [data-testid="inbox-context-menu"] {
    margin-bottom: 32px !important;
  }

  .bottom-sheet-root[data-layout="panel"] {
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .bottom-sheet-root[data-layout="panel"] .bottom-sheet-panel {
    margin: auto !important;
    border-radius: 28px !important;
  }
}

/* Large / landscape tablets: wider reading rail without becoming a desktop app. */
@media (min-width: 900px) and (max-width: 1023px) {
  .itjima-app-stage[data-layout="app"] {
    padding: 18px !important;
    align-items: center !important;
  }

  .itjima-responsive-frame {
    width: min(calc(100vw - 36px), 990px) !important;
    max-width: 990px !important;
    height: calc(100dvh - 36px) !important;
    min-height: calc(100dvh - 36px) !important;
    border-radius: 30px !important;
  }

  .phone-frame .app-top-nav-bar {
    max-width: 900px !important;
    padding-inline: 40px !important;
  }

  .phone-frame .home-chat-lane,
  .phone-frame form.composer-hero {
    width: min(calc(100% - 64px), 800px) !important;
    max-width: 800px !important;
    margin-inline: auto !important;
  }

  .bottom-sheet-root[data-layout="panel"] {
    align-items: center;
    justify-content: center;
    padding: 28px;
  }

  .bottom-sheet-root[data-layout="panel"] .bottom-sheet-panel {
    margin: auto !important;
    max-width: 680px !important;
    border-radius: 30px !important;
  }
}

/* Compact desktops: sidebar workspace with enough room for actual work. */
@media (min-width: 1024px) and (max-width: 1279px) {
  :root {
    --ij-desktop-sidebar: 224px;
    --ij-desktop-content: 820px;
    --ij-desktop-chat: 700px;
  }

  .itjima-app-stage[data-layout="app"] {
    padding: 16px !important;
  }

  .itjima-responsive-frame {
    width: calc(100vw - 32px) !important;
    max-width: none !important;
    height: calc(100dvh - 32px) !important;
    min-height: calc(100dvh - 32px) !important;
    border-radius: 26px !important;
  }

  .itjima-desktop-nav {
    width: var(--ij-desktop-sidebar) !important;
  }

  .phone-frame .home-chat-lane,
  .phone-frame form.composer-hero {
    width: min(calc(100% - 48px), var(--ij-desktop-chat)) !important;
    margin-inline: auto !important;
  }
}

/* Standard desktops. */
@media (min-width: 1280px) and (max-width: 1599px) {
  :root {
    --ij-desktop-frame-max: 1400px;
    --ij-desktop-sidebar: 260px;
    --ij-desktop-content: 980px;
    --ij-desktop-chat: 820px;
  }

  .itjima-app-stage[data-layout="app"] {
    padding: clamp(18px, 1.8vw, 28px) !important;
  }

  .itjima-responsive-frame {
    width: min(calc(100vw - 40px), var(--ij-desktop-frame-max)) !important;
    max-width: var(--ij-desktop-frame-max) !important;
    height: calc(100dvh - 40px) !important;
    min-height: calc(100dvh - 40px) !important;
    border-radius: 30px !important;
  }

  .phone-frame .home-chat-lane,
  .phone-frame form.composer-hero {
    width: min(calc(100% - 64px), var(--ij-desktop-chat)) !important;
    margin-inline: auto !important;
  }
}

/* Wide and ultrawide desktops: cap line length while using the canvas. */
@media (min-width: 1600px) {
  :root {
    --ij-desktop-frame-max: 1520px;
    --ij-desktop-sidebar: 280px;
    --ij-desktop-content: 1060px;
    --ij-desktop-chat: 880px;
  }

  .itjima-app-stage[data-layout="app"] {
    padding: 28px !important;
  }

  .itjima-responsive-frame {
    width: min(calc(100vw - 56px), var(--ij-desktop-frame-max)) !important;
    max-width: var(--ij-desktop-frame-max) !important;
    height: calc(100dvh - 56px) !important;
    min-height: calc(100dvh - 56px) !important;
    border-radius: 34px !important;
  }

  .phone-frame .home-chat-lane,
  .phone-frame form.composer-hero {
    width: min(calc(100% - 80px), var(--ij-desktop-chat)) !important;
    margin-inline: auto !important;
  }

  .phone-frame .sticky:has(#schedule-tab-today) > div:first-of-type,
  .phone-frame .sticky:has(#schedule-tab-today) > div:nth-of-type(2),
  .phone-frame .sticky:has(#schedule-tab-today) + div {
    max-width: var(--ij-desktop-content) !important;
  }
}

@media (orientation: landscape) and (max-height: 700px) and (max-width: 1023px) {
  .itjima-app-stage[data-layout="app"] {
    padding: 0 !important;
  }

  .itjima-responsive-frame {
    width: 100% !important;
    max-width: none !important;
    height: 100dvh !important;
    min-height: 100dvh !important;
    border-radius: 0 !important;
    border: 0 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .itjima-app-workspace *,
  .itjima-app-workspace *::before,
  .itjima-app-workspace *::after {
    scroll-behavior: auto !important;
  }
}

@media (forced-colors: active) {
  .itjima-responsive-frame,
  .itjima-desktop-nav,
  .bottom-sheet-panel {
    border: 1px solid CanvasText !important;
  }
}
`;

write("src/ui-responsive-master.css", responsiveCss);

let main = read("src/main.tsx");
if (!main.includes('import "./ui-responsive-master.css";')) {
  main = replaceRequired(
    main,
    'import "./ui-responsive-pro.css";',
    'import "./ui-responsive-pro.css";\nimport "./ui-responsive-master.css";',
    "responsive master import",
  );
  write("src/main.tsx", main);
}

let root = read("src/routes/__root.tsx");
root = replaceRequired(
  root,
  '<div className="itjima-app-stage flex min-h-dvh w-full items-start justify-center">',
  '<div\n          className="itjima-app-stage flex min-h-dvh w-full items-start justify-center"\n          data-layout="app"\n          data-route={mainRouteKey}\n        >',
  "app stage attributes",
);
root = replaceRequired(
  root,
  '<div className="phone-frame itjima-responsive-frame flex flex-col lg:flex-row">',
  '<div className="phone-frame itjima-responsive-frame itjima-app-workspace flex flex-col lg:flex-row">',
  "workspace class",
);
root = replaceRequired(
  root,
  '<div className="flex min-h-0 min-w-0 flex-1 flex-col">\n              <div className="lg:hidden">',
  '<div className="itjima-app-content flex min-h-0 min-w-0 flex-1 flex-col">\n              <div className="lg:hidden">',
  "app content class",
);
root = replaceRequired(
  root,
  'className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"',
  'className="itjima-app-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"',
  "app scroll class",
);
write("src/routes/__root.tsx", root);

let config = read("playwright.config.ts");
if (!config.includes('name: "responsive-matrix-chrome"')) {
  config = replaceRequired(
    config,
    '      name: "mobile-chrome",\n      testMatch: "**/*.spec.ts",',
    '      name: "mobile-chrome",\n      testMatch: "**/*.spec.ts",\n      testIgnore: "**/responsive-matrix.spec.ts",',
    "mobile matrix ignore",
  );
  config = replaceRequired(
    config,
    '    {\n      name: "tablet-chrome",',
    '    {\n      name: "responsive-matrix-chrome",\n      testMatch: "**/responsive-matrix.spec.ts",\n      use: {\n        ...devices["Desktop Chrome"],\n        browserName: "chromium",\n        viewport: { width: 1440, height: 900 },\n      },\n    },\n    {\n      name: "tablet-chrome",',
    "matrix project",
  );
  write("playwright.config.ts", config);
}

const matrixSpec = `import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "phone-compact", width: 320, height: 568 },
  { name: "phone-android", width: 360, height: 800 },
  { name: "phone-iphone", width: 375, height: 812 },
  { name: "phone-standard", width: 390, height: 844 },
  { name: "phone-large", width: 430, height: 932 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-large", width: 820, height: 1180 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop-compact", width: 1280, height: 800 },
  { name: "desktop-standard", width: 1440, height: 900 },
  { name: "desktop-wide", width: 1920, height: 1080 },
] as const;

async function expectInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).toBeTruthy();
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

for (const viewport of viewports) {
  test(\`[matrix] \${viewport.name} \${viewport.width}x\${viewport.height}\`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/?lang=en");

    await expect(page.locator("#capture-input")).toBeVisible();
    await expectInsideViewport(page, ".itjima-responsive-frame");
    await expectInsideViewport(page, "form.composer-hero");
    await expectNoOverflow(page);

    if (viewport.width >= 1024) {
      await expect(page.locator(".itjima-desktop-nav")).toBeVisible();
      await expect(page.locator(".app-top-nav")).toBeHidden();
    } else {
      await expect(page.locator(".app-top-nav")).toBeVisible();
      await expect(page.locator(".itjima-desktop-nav")).toBeHidden();
    }

    const visibleControls = page.locator(
      '.phone-frame button:visible, .phone-frame a:visible, .phone-frame [role="button"]:visible, .phone-frame [role="tab"]:visible',
    );
    const undersized = await visibleControls.evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((item) => item.width < 44 || item.height < 44),
    );
    expect(undersized, JSON.stringify(undersized)).toEqual([]);

    const settings = page.locator('[data-testid="open-settings"]:visible');
    await expect(settings).toHaveCount(1);
    await settings.click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await expectInsideViewport(page, '.bottom-sheet-panel[role="dialog"]');
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Schedule", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
    await expectNoOverflow(page);

    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Archive", exact: true })).toBeVisible();
    await expectNoOverflow(page);
  });
}
`;
write("e2e/responsive-matrix.spec.ts", matrixSpec);

let qa = read(".github/workflows/product-qa.yml");
if (!qa.includes("Run full responsive viewport matrix")) {
  qa = replaceRequired(
    qa,
    '      - name: Upload responsive report\n        if: always()',
    '      - name: Run full responsive viewport matrix\n        run: npx playwright test e2e/responsive-matrix.spec.ts --project=responsive-matrix-chrome\n\n      - name: Upload responsive report\n        if: always()',
    "responsive matrix workflow step",
  );
  write(".github/workflows/product-qa.yml", qa);
}

let visual = read(".github/workflows/visual-smoke.yml");
if (!visual.includes("home-mobile-android-en.png")) {
  visual = replaceRequired(
    visual,
    '          capture 320 568 home-mobile-small-en.png "http://127.0.0.1:4173/?lang=en"\n          capture 390 844 home-mobile-en.png',
    '          capture 320 568 home-mobile-small-en.png "http://127.0.0.1:4173/?lang=en"\n          capture 360 800 home-mobile-android-en.png "http://127.0.0.1:4173/?lang=en"\n          capture 375 812 home-mobile-iphone-en.png "http://127.0.0.1:4173/?lang=en"\n          capture 390 844 home-mobile-en.png\n          capture 430 932 home-mobile-large-en.png "http://127.0.0.1:4173/?lang=en"\n          capture 390 844 home-mobile-en.png',
    "mobile visual matrix",
  );
  visual = visual.replace(
    '          capture 390 844 home-mobile-en.png\n          capture 430 932',
    '          capture 390 844 home-mobile-en.png "http://127.0.0.1:4173/?lang=en"\n          capture 430 932',
  );
  visual = replaceRequired(
    visual,
    '          capture 834 1112 about-tablet-en.png "http://127.0.0.1:4173/about?lang=en"\n\n          capture 1440 1000 home-desktop-en.png',
    '          capture 834 1112 about-tablet-en.png "http://127.0.0.1:4173/about?lang=en"\n          capture 1024 768 home-tablet-landscape-en.png "http://127.0.0.1:4173/?lang=en"\n\n          capture 1280 800 home-desktop-compact-en.png "http://127.0.0.1:4173/?lang=en"\n          capture 1440 1000 home-desktop-en.png',
    "tablet and desktop visual matrix",
  );
  visual = replaceRequired(
    visual,
    '          capture 1440 1000 about-desktop-ko.png "http://127.0.0.1:4173/about?lang=ko"',
    '          capture 1440 1000 about-desktop-ko.png "http://127.0.0.1:4173/about?lang=ko"\n          capture 1920 1080 home-desktop-wide-en.png "http://127.0.0.1:4173/?lang=en"',
    "wide desktop visual",
  );
  visual = replaceRequired(
    visual,
    '          verify_png home-mobile-small-en.png 320 568\n          verify_png home-mobile-en.png 390 844',
    '          verify_png home-mobile-small-en.png 320 568\n          verify_png home-mobile-android-en.png 360 800\n          verify_png home-mobile-iphone-en.png 375 812\n          verify_png home-mobile-en.png 390 844\n          verify_png home-mobile-large-en.png 430 932',
    "mobile visual verification",
  );
  visual = replaceRequired(
    visual,
    '          verify_png about-tablet-en.png 834 1112\n          verify_png home-desktop-en.png 1440 1000',
    '          verify_png about-tablet-en.png 834 1112\n          verify_png home-tablet-landscape-en.png 1024 768\n          verify_png home-desktop-compact-en.png 1280 800\n          verify_png home-desktop-en.png 1440 1000',
    "tablet desktop verification",
  );
  visual = replaceRequired(
    visual,
    '          verify_png about-desktop-ko.png 1440 1000',
    '          verify_png about-desktop-ko.png 1440 1000\n          verify_png home-desktop-wide-en.png 1920 1080',
    "wide desktop verification",
  );
  write(".github/workflows/visual-smoke.yml", visual);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(item) : [item];
  });
}

for (const file of walk("e2e").filter((item) => item.endsWith(".ts"))) {
  let source = read(file);
  const before = source;
  source = source
    .replaceAll("/^Throw/", "/^Capture/")
    .replaceAll('name: "Throw"', 'name: "Capture"')
    .replaceAll("name: 'Throw'", "name: 'Capture'")
    .replaceAll('"Drop it"', '"Capture"')
    .replaceAll("'Drop it'", "'Capture'")
    .replaceAll("던지기", "남기기")
    .replaceAll('"Try again"', '"Retry"')
    .replaceAll("'Try again'", "'Retry'")
    .replace(/\.getByRole\("button", \{ name: "Settings"(?:, exact: true)? \}\)/g, '.getByTestId("open-settings")');
  if (file.endsWith("helpers.ts")) {
    source = source.replace(
      '.getByRole("button", { name: label, exact: true })',
      '.getByRole("menuitem", { name: label, exact: true })',
    );
  }
  if (source !== before) write(file, source);
}

console.log("Responsive master migration complete.");
