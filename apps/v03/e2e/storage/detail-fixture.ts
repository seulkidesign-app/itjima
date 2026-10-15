import { expect, type Page } from "@playwright/test";
import type { Collaboration } from "../../src/integrations/collaboration";
export const ID = "77777777-7777-4777-8777-777777777777";
export const TASK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const USER = "11111111-1111-4111-8111-111111111111";
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=", "base64");
export function fixture(): Collaboration {
  return {
    id: ID, title: "브랜드 A 캠페인", status: "producing", revision: 0, contact_date: null, notes: null,
    v03_contents: [{ id: "content", title: "릴스 제작", platform: "Instagram", v03_tasks: [
      { id: TASK, type: "draft_delivery", title: "가편 전달", due_date: "2026-10-20", revision: 0, completed_at: null },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", type: "publish", title: "업로드", due_date: "2026-10-23", revision: 0, completed_at: null },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", type: "custom", title: "영상 제작", due_date: null, revision: 0, completed_at: null },
    ] }],
    v03_constraints: [
      { id: "thumbnail", type: "thumbnail", value: "썸네일 가격 표시 금지", information_state: "present", review_state: "confirmed" },
      { id: "rights", type: "usage_rights", value: null, information_state: "not_mentioned", review_state: "confirmed" },
      { id: "retention", type: "retention", value: null, information_state: "uncertain", review_state: "confirmed" },
    ],
    v03_sources: [{ id: "source", raw_text: "합성 원본 가이드입니다.", images: [{ path: `${USER}/import/image`, name: "guide.png", size: PNG.length, type: "image/png" }], v03_reviews: [
      { candidate: { candidate_id: "draft_due", information_state: "present", origin: "mock" } },
      { candidate: { candidate_id: "publish_due", information_state: "present", origin: "mock" } },
    ] }],
  };
}
type Reply = { status: number; body: unknown };
export async function backend(
  page: Page,
  detail: (url: URL) => Promise<Reply> = async () => ({ status: 200, body: [fixture()] }),
  home = detail,
) {
  const user = { id: USER, email: "creator@example.test", aud: "authenticated", role: "authenticated" };
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: USER, role: "authenticated", exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url")}.test-signature`;
  const calls: string[] = [];
  let reads = 0;
  let imageFailure = false;
  await page.route("https://abcdefghijklmnopqrst.supabase.co/**", async (route) => {
    const url = new URL(route.request().url()); const path = url.pathname;
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/token")) return reply({ access_token: token, refresh_token: "test-refresh-only", expires_in: 3600, token_type: "bearer", user });
    if (path.endsWith("/user")) return reply(user);
    if (path.endsWith("/logout")) return reply({});
    if (path.endsWith("/v03_imports")) return reply([]);
    if (path.endsWith("/v03_collaborations")) {
      reads++;
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
      const result = await (url.searchParams.has("id") ? detail : home)(url); return reply(result.body, result.status);
    }
    if (path.includes("/storage/v1/object/")) {
      return route.fulfill(imageFailure ? { status: 403, contentType: "application/json", body: '{}' } : { status: 200, contentType: "image/png", body: PNG });
    }
    if (path.includes("/rpc/")) {
      calls.push(path.split("/").at(-1)!);
      if (path.endsWith("/v03_prepare_import")) {
        expect(route.request().postDataJSON().p_payload.review.every((c: { review_state: string }) => c.review_state !== "unreviewed")).toBe(true);
        return reply({ state: "pending" });
      }
      if (path.endsWith("/v03_commit_import")) return reply(ID);
    }
    throw new Error(`Unexpected mock backend path: ${path}`);
  });
  return {
    calls, get reads() { return reads; }, set imageFailure(value: boolean) { imageFailure = value; },
    async login() {
      await page.getByText("V03 계정 · 로그인 필요", { exact: true }).click();
      await page.getByLabel("이메일", { exact: true }).fill(user.email);
      await page.getByLabel("비밀번호", { exact: true }).fill("test-password-only");
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await expect(page.getByText("V03 계정 · 로그인됨", { exact: true })).toBeVisible();
    },
  };
}
