import { test } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import { phone } from "./helpers";

const OUT_DIR = join(process.cwd(), "e2e-screenshots", "chat-home");

test.describe("Chat home mobile screenshots", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("capture four chat home states at 375px", async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });

    await page.goto("/");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("itjima.")) localStorage.removeItem(k);
      }
      localStorage.setItem("itjima_lang", "ko");
      sessionStorage.clear();
    });
    await page.reload();
    await phone(page).getByRole("link", { name: /^던지기/ }).waitFor();

    await phone(page).screenshot({
      path: join(OUT_DIR, "01-empty-chat.png"),
    });

    const submit = async (text: string) => {
      const frame = phone(page);
      await frame.locator("textarea").first().fill(text);
      await frame.getByRole("button", { name: "남기기", exact: true }).click();
      await frame.getByTestId("chat-turn").last().waitFor({
        state: "visible",
      });
      await page.waitForTimeout(350);
    };

    await submit("여행");
    await phone(page).screenshot({
      path: join(OUT_DIR, "02-travel-turn.png"),
    });

    await submit("내일 오후 3시 치과");
    await phone(page).screenshot({
      path: join(OUT_DIR, "03-schedule-proposal.png"),
    });

    await submit("세제 사기");
    await submit("나중에 볼 링크 https://example.com");
    await submit("주말에 친구 만나기");
    await page.waitForTimeout(300);
    await phone(page).screenshot({
      path: join(OUT_DIR, "04-long-conversation.png"),
    });
  });
});
