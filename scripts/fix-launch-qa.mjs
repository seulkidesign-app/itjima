import fs from "node:fs";

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(from)) {
    throw new Error(`Pattern not found in ${path}: ${from.slice(0, 120)}`);
  }
  fs.writeFileSync(path, source.replace(from, to));
}

function write(path, content) {
  fs.writeFileSync(path, content.trimStart());
}

replaceOnce(
  "src/components/BottomSheet.tsx",
  '  const panelRef = useRef<HTMLDivElement | null>(null);\n',
  '  const panelRef = useRef<HTMLDivElement | null>(null);\n  const previousFocusRef = useRef<HTMLElement | null>(null);\n',
);
replaceOnce(
  "src/components/BottomSheet.tsx",
  '    const previousFocus =\n      document.activeElement instanceof HTMLElement ? document.activeElement : null;\n',
  '    previousFocusRef.current =\n      document.activeElement instanceof HTMLElement ? document.activeElement : null;\n',
);
replaceOnce(
  "src/components/BottomSheet.tsx",
  '      window.requestAnimationFrame(() => {\n        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });\n      });\n',
  '',
);
replaceOnce(
  "src/components/BottomSheet.tsx",
  '    <AnimatePresence>\n',
  '    <AnimatePresence\n      onExitComplete={() => {\n        const previousFocus = previousFocusRef.current;\n        previousFocusRef.current = null;\n        window.requestAnimationFrame(() => {\n          if (previousFocus?.isConnected) {\n            previousFocus.focus({ preventScroll: true });\n          }\n        });\n      }}\n    >\n',
);

replaceOnce(
  "src/components/InlinePromise.tsx",
  '      data-intent={card.nlIntent}\n      data-needs-confirmation={confirmation ? "true" : "false"}\n',
  '      data-intent={card.nlIntent}\n      data-confidence={card.confidenceLevel}\n      data-sensitive={card.isSensitive ? "true" : "false"}\n      data-needs-confirmation={confirmation ? "true" : "false"}\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '          <div className="mt-3 grid grid-cols-3 gap-1.5">\n',
  '          <div\n            className="mt-3 grid grid-cols-3 gap-1.5"\n            data-testid="promise-clarify-chips"\n          >\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '                type="button"\n                onClick={() => finish(onConfirmClarify(item, pick))}\n',
  '                type="button"\n                data-testid={`promise-clarify-${pick}`}\n                onClick={() => finish(onConfirmClarify(item, pick))}\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '            type="button"\n            onClick={() => openManualSchedule("clarify")}\n',
  '            type="button"\n            data-testid="promise-manual"\n            onClick={() => openManualSchedule("clarify")}\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '            type="button"\n            onClick={() => finish(onConfirmTaskLater(item))}\n',
  '            type="button"\n            data-testid="promise-primary"\n            onClick={() => finish(onConfirmTaskLater(item))}\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '            type="button"\n            onClick={() => openManualSchedule("adjust")}\n            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"\n          >\n            {t("날짜 추가", "Add date")}\n',
  '            type="button"\n            data-testid="promise-add-date"\n            onClick={() => openManualSchedule("adjust")}\n            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"\n          >\n            {t("날짜 추가", "Add date")}\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '            type="button"\n            onClick={() => openManualSchedule("ambiguity")}\n',
  '            type="button"\n            data-testid="promise-manual"\n            onClick={() => openManualSchedule("ambiguity")}\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '            type="button"\n            onClick={() => finish(onConfirmScheduleQuick(item))}\n',
  '            type="button"\n            data-testid="promise-primary"\n            onClick={() => finish(onConfirmScheduleQuick(item))}\n',
);
replaceOnce(
  "src/components/InlinePromise.tsx",
  '            type="button"\n            onClick={() => openManualSchedule("adjust")}\n            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"\n          >\n            {t("수정", "Adjust")}\n',
  '            type="button"\n            data-testid="promise-manual"\n            onClick={() => openManualSchedule("adjust")}\n            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"\n          >\n            {t("수정", "Adjust")}\n',
);

write("e2e/nl-beta.spec.ts", String.raw`
import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function installAnalyticsSpy(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents = [];
    window.gtag = (...args: unknown[]) => {
      (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents.push(args);
    };
  });
}

async function readAnalytics(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents ?? [],
  );
}

async function submitKo(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "남기기", exact: true }).click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

test.describe("Focused natural-language guards", () => {
  test.beforeEach(async ({ page }) => {
    await installAnalyticsSpy(page);
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
  });

  test("acknowledged interpretation stays hidden after reload", async ({ page }) => {
    await submitKo(page, "내일 오후 3시에 치과");
    const frame = phone(page);
    await expect(frame.getByTestId("inline-promise").last()).toBeVisible();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{ id: string }>;
    expect(inbox).toHaveLength(1);
    await page.evaluate((id) => {
      localStorage.setItem("itjima.nl.acknowledged.guest", JSON.stringify([id]));
    }, inbox[0]!.id);
    await page.reload();
    await expect(frame.getByText("내일 오후 3시에 치과", { exact: true }).first()).toBeVisible();
    await expect(frame.getByTestId("inline-promise")).toHaveCount(0);
  });

  test("double tap schedule confirmation creates one event", async ({ page }) => {
    await submitKo(page, "내일 오후 3시에 치과");
    const button = phone(page).getByTestId("inline-promise").last().getByTestId("promise-primary");
    await button.dblclick();
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key) || "[]").length === 1,
      GUEST_SCHEDULE_KEY,
    );
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("capture never opens a calendar automatically", async ({ page }) => {
    await submitKo(page, "내일 오후 3시에 치과");
    await expect(phone(page).getByTestId("inline-promise").last()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("analytics never include captured text", async ({ page }) => {
    const secret = "SECRET-999 내일 오후 3시 회의";
    await submitKo(page, secret);
    await expect(phone(page).getByTestId("inline-promise").last()).toBeVisible();
    const blob = JSON.stringify(await readAnalytics(page));
    expect(blob).not.toContain(secret);
    expect(blob).not.toContain("SECRET-999");
    expect(blob).toContain("nl_thought_submitted");
  });

  test("debug UI stays unavailable even with a query flag", async ({ page }) => {
    await page.goto("/?nlDebug=1");
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
    await submitKo(page, "내일 오후 3시에 치과");
    await expect(phone(page).getByTestId("nl-debug-panel")).toHaveCount(0);
  });

  test("plain notes remain in Capture without an interpretation card", async ({ page }) => {
    await submitKo(page, "오늘 커피가 맛있었다");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });
});
`);

write("e2e/nl-schedule.spec.ts", String.raw`
import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  gotoScheduleUpcoming,
} from "./helpers";

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.locator('form.composer-hero button[type="submit"]').click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

async function submitKo(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "남기기", exact: true }).click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

test.describe("Natural-language scheduling", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("clear English schedule confirms in one tap", async ({ page }) => {
    await submit(page, "Dentist tomorrow at 3pm");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_exact");
    await expect(promise).toHaveAttribute("data-confidence", "high");
    await expect(promise.getByTestId("promise-primary")).toHaveText("Add to schedule");
    await promise.getByTestId("promise-primary").click();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    await gotoScheduleUpcoming(page);
    await expect(phone(page).getByText(/Dentist/i).first()).toBeVisible();
  });

  test("ambiguous English schedule resolves with inline choices", async ({ page }) => {
    await submit(page, "Watch it next week or so");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await expect(promise).toHaveAttribute("data-confidence", "medium");
    const choices = promise.getByTestId("promise-clarify-chips");
    await expect(choices).toBeVisible();
    await choices.getByRole("button").first().click();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("task remains a later task without forcing a date", async ({ page }) => {
    await submit(page, "Call mom");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "task");
    await expect(promise.getByTestId("promise-primary")).toHaveText("Keep as later task");
    await expect(promise.getByTestId("promise-add-date")).toBeVisible();
    await promise.getByTestId("promise-primary").click();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{ decision?: string }>;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.decision).toBe("later");
  });

  test("sensitive reference notes are not auto-routed", async ({ page }) => {
    await submit(page, "Passport number");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });

  test("Adjust opens manual scheduling and Escape returns to the card", async ({ page }) => {
    await submit(page, "Dentist tomorrow at 3pm");
    const promise = phone(page).getByTestId("inline-promise").last();
    await promise.getByTestId("promise-manual").click();
    await expect(page.getByRole("dialog").last()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(promise).toBeVisible();
  });
});

test.describe("Natural-language scheduling in Korean", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
  });

  test("명확한 일정은 한 번에 추가된다", async ({ page }) => {
    await submitKo(page, "내일 오후 3시에 치과");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_exact");
    await expect(promise).toHaveAttribute("data-needs-confirmation", "false");
    await expect(promise.getByTestId("promise-primary")).toHaveText("일정에 추가");
    await promise.getByTestId("promise-primary").click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("주말 표현은 토요일과 일요일 중 선택하게 한다", async ({ page }) => {
    await submitKo(page, "주말에 영화 보기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-needs-confirmation", "true");
    const choices = promise.getByTestId("promise-confirmation-choices");
    await expect(choices).toBeVisible();
    await choices.getByRole("button").first().click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("애매한 날짜는 카드 안에서 해결한다", async ({ page }) => {
    await submitKo(page, "다음주쯤 보기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await promise.getByTestId("promise-clarify-chips").getByRole("button").first().click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("날짜 없는 할 일은 나중 할 일로 둔다", async ({ page }) => {
    await submitKo(page, "엄마한테 전화하기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "task");
    await expect(promise.getByTestId("promise-primary")).toHaveText("나중 할 일로 두기");
    await promise.getByTestId("promise-primary").click();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{ decision?: string }>;
    expect(inbox[0]?.decision).toBe("later");
  });

  test("할 일에서 날짜 추가를 누르면 수동 일정 화면이 열린다", async ({ page }) => {
    await submitKo(page, "엄마한테 전화하기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await promise.getByTestId("promise-add-date").click();
    await expect(page.getByRole("dialog").last()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(promise).toBeVisible();
  });

  test("민감한 참고 정보는 자동 분류하지 않는다", async ({ page }) => {
    await submitKo(page, "여권 번호");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });
});
`);

write("e2e/product-reset.spec.ts", String.raw`
import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  openContextMenu,
  contextMenuDialog,
  completeScheduleDialog,
  gotoScheduleUpcoming,
  GUEST_INBOX_KEY,
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function submitThought(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "Capture", exact: true }).click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

test.describe("Current product information architecture", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Capture to context menu to Archive preserves the original text", async ({ page }) => {
    await submitThought(page, "Travel");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    await openContextMenu(page, "Travel");
    await contextMenuDialog(page)
      .getByRole("menuitem", { name: "Save to vault", exact: true })
      .click();

    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await expect(phone(page).getByRole("heading", { name: "Archive", exact: true })).toBeVisible();
    await expect(phone(page).getByText("Travel").first()).toBeVisible();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_ARCHIVE_KEY)).length).toBe(1);
  });

  test("context menu scheduling keeps Capture until confirmation", async ({ page }) => {
    await submitThought(page, "Dentist tomorrow at 3pm");
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    await openContextMenu(page, "Dentist tomorrow at 3pm");
    await contextMenuDialog(page)
      .getByRole("menuitem", { name: "Bring it back then", exact: true })
      .click();
    await completeScheduleDialog(page);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    await gotoScheduleUpcoming(page);
    await expect(phone(page).getByText(/Dentist/i).first()).toBeVisible();
  });

  test("legacy thought map remains behind its feature flag", async ({ page }) => {
    await page.evaluate(({ archiveKey }) => {
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({ ARCHIVE_THOUGHT_MAP: true, ARCHIVE_AI_GROUPING: true }),
      );
      localStorage.setItem(
        archiveKey,
        JSON.stringify([{ id: "qa-map", text: "Map memory seed", images: [], created_at: new Date().toISOString() }]),
      );
    }, { archiveKey: GUEST_ARCHIVE_KEY });
    await page.reload();
    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await expect(phone(page).getByText("Map memory seed").first()).toBeVisible();
    await phone(page).getByRole("button", { name: "Thought map" }).click();
    await expect(phone(page).getByText("Vault › Thought map")).toBeVisible();
  });
});
`);

write("e2e/responsive-ui.spec.ts", String.raw`
import { test, expect, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport + 1);
}

const scheduleViewports = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

test.describe("responsive UI safeguards", () => {
  for (const viewport of scheduleViewports) {
    test("schedule stays aligned at " + viewport.width + "px", async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/schedule?lang=en");
      for (const id of ["schedule-tab-today", "schedule-tab-list", "schedule-tab-cal"]) {
        await expect(page.locator("#" + id)).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);

      if (viewport.width < 640) {
        await expect(page.locator(".mobile-app-header")).toBeVisible();
        await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
        await expect(page.locator(".tablet-app-nav")).toBeHidden();
        await expect(page.locator(".itjima-desktop-shell")).toHaveCount(0);
      } else if (viewport.width < 1024) {
        await expect(page.locator(".mobile-app-header")).toBeHidden();
        await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
        await expect(page.locator(".tablet-app-nav")).toBeVisible();
        await expect(page.locator(".itjima-desktop-shell")).toHaveCount(0);
      } else {
        const shell = page.locator(".itjima-desktop-shell");
        await expect(shell).toBeVisible();
        await expect(page.locator(".itjima-desktop-nav")).toBeVisible();
        await expect(page.locator(".mobile-app-header")).toHaveCount(0);
        await expect(page.locator(".tablet-app-nav")).toHaveCount(0);
        const box = await shell.boundingBox();
        expect(Math.abs((box?.width ?? 0) - viewport.width)).toBeLessThanOrEqual(2);
        expect(Math.abs((box?.height ?? 0) - viewport.height)).toBeLessThanOrEqual(2);
      }
    });
  }

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ] as const) {
    for (const route of ["/", "/archive", "/auth"] as const) {
      test(route + " has no horizontal overflow at " + viewport.width + "px", async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(route + "?lang=en");
        await expectNoHorizontalOverflow(page);
      });
    }
  }

  test("desktop uses an independent full-browser workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/?lang=en");
    const shell = page.locator(".itjima-desktop-shell");
    const nav = page.locator(".itjima-desktop-nav");
    const chat = page.locator(".home-chat-lane");
    const composer = page.locator("form.composer-hero");
    await expect(shell).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(chat).toBeVisible();
    await expect(composer).toBeVisible();
    const [shellBox, navBox, chatBox, composerBox] = await Promise.all([
      shell.boundingBox(), nav.boundingBox(), chat.boundingBox(), composer.boundingBox(),
    ]);
    expect(shellBox?.width ?? 0).toBeGreaterThanOrEqual(1438);
    expect(navBox?.width ?? 0).toBeGreaterThanOrEqual(180);
    expect(chatBox?.width ?? 0).toBeLessThanOrEqual(760);
    expect(composerBox?.width ?? 0).toBeLessThanOrEqual(760);
    const chatCenter = (chatBox?.x ?? 0) + (chatBox?.width ?? 0) / 2;
    const composerCenter = (composerBox?.x ?? 0) + (composerBox?.width ?? 0) / 2;
    expect(Math.abs(chatCenter - composerCenter)).toBeLessThanOrEqual(3);
  });

  test("tablet uses its own compact toolbar", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/?lang=en");
    await expect(page.locator(".tablet-app-nav")).toBeVisible();
    await expect(page.locator(".mobile-app-header")).toBeHidden();
    await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
    await expect(page.locator(".itjima-desktop-nav")).toBeHidden();
  });

  test("desktop shortcuts navigate and focus Capture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/schedule?lang=en");
    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press("Meta+K");
    await expect(page.locator("#capture-input")).toBeFocused();
    await page.keyboard.press("Meta+3");
    await expect(page).toHaveURL(/\/archive$/);
  });

  test("desktop dialog remains inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/schedule?lang=en");
    await page.getByRole("button", { name: /Add task/i }).click();
    const root = page.locator(".bottom-sheet-root");
    const panel = page.locator('.bottom-sheet-panel[role="dialog"]');
    await expect(panel).toBeVisible();
    const [rootBox, panelBox] = await Promise.all([root.boundingBox(), panel.boundingBox()]);
    expect(rootBox?.width ?? 0).toBeGreaterThanOrEqual(1023);
    expect(panelBox?.width ?? 0).toBeGreaterThan(430);
    expect(panelBox?.width ?? 0).toBeLessThanOrEqual(681);
    expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(1024);
  });
});
`);

console.log("Launch QA repairs applied.");
