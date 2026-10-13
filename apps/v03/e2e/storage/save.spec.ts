import { test, expect } from "@playwright/test";
import { openReview, confirmAll } from "../helpers";
test("V03 authentication and reviewed RPC save preserve V02 session", async ({
  page,
}) => {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "creator@example.test",
    aud: "authenticated",
    role: "authenticated",
  };
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test-signature`;
  const calls: string[] = [];
  await page.route(
    "https://abcdefghijklmnopqrst.supabase.co/**",
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const reply = (body: unknown) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (path.endsWith("/token"))
        return reply({
          access_token: token,
          refresh_token: "test-refresh-only",
          expires_in: 3600,
          token_type: "bearer",
          user,
        });
      if (path.endsWith("/user")) return reply(user);
      if (path.endsWith("/v03_imports")) return reply([]);
      if (path.includes("/rpc/")) {
        calls.push(path.split("/").at(-1)!);
        if (path.endsWith("/v03_prepare_import")) {
          expect(
            route
              .request()
              .postDataJSON()
              .p_payload.review.every(
                (c: { review_state: string }) =>
                  c.review_state !== "unreviewed",
              ),
          ).toBe(true);
          return reply({ state: "pending" });
        }
        if (path.endsWith("/v03_commit_import"))
          return reply("77777777-7777-4777-8777-777777777777");
      }
      throw new Error(`Unexpected backend call: ${path}`);
    },
  );
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("v02-auth-sentinel", "unchanged"),
  );
  await page.getByText("V03 계정 · 로그인 필요").click();
  await page.getByLabel("이메일", { exact: true }).fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByText("V03 계정 · 로그인됨")).toBeVisible();
  await openReview(page);
  expect(calls).toEqual([]);
  await confirmAll(page);
  await page
    .getByRole("button", { name: "확인하고 저장", exact: true })
    .click();
  await expect(
    page.getByText("V03에 저장했어요.", { exact: false }),
  ).toBeVisible();
  expect(calls).toEqual(["v03_prepare_import", "v03_commit_import"]);
  expect(
    await page.evaluate(() => localStorage.getItem("v02-auth-sentinel")),
  ).toBe("unchanged");
  expect(
    (await page.evaluate(() => Object.keys(localStorage))).some((key) =>
      key.startsWith("itjima-v03-auth-"),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "확인하고 저장", exact: true }),
  ).toBeDisabled();
});
