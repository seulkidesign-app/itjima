import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dueState, isActive, loadHome, localDate, pendingTasks, type HomeCollaboration } from "../src/integrations/home";
import { DetailError, scheduleSummary } from "../src/integrations/collaboration";
function item(id = "a"): HomeCollaboration {
  return { id, title: "협찬", status: "producing", v03_contents: [{ id: "content", title: "제작물", v03_tasks: [
    { id: "undated", title: "기한 없음", type: "custom", due_date: null, revision: 0, completed_at: null },
    { id: "late", title: "지난 기한", type: "draft_delivery", due_date: "2026-10-10", revision: 0, completed_at: null },
    { id: "future", title: "예정", type: "publish", due_date: "2026-10-20", revision: 0, completed_at: null },
    { id: "done", title: "완료", type: "custom", due_date: "2026-10-01", revision: 0, completed_at: "2026-10-02T00:00:00Z" },
  ] }], v03_sources: [] };
}
function backend(pages: { data: unknown; status?: number; error?: unknown }[]) {
  const calls: unknown[][] = [];
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), retry: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(),
    then(resolve: (value: unknown) => unknown) { const page = pages.shift(); calls.push([]); return Promise.resolve({ error: null, status: 200, ...page }).then(resolve); },
  };
  return { query, calls, client: { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient };
}
describe("home priorities without date inference", () => {
  it("separates completed and held collaborations without modifying stored status", () => {
    const active = item(); const held = { ...item("b"), status: "on_hold" as const }; const done = { ...item("c"), status: "completed" as const };
    expect([active, held, done].filter(isActive)).toEqual([active]);
    expect(pendingTasks([held, done])).toHaveLength(6);
    expect(held.status).toBe("on_hold"); expect(done.status).toBe("completed");
  });
  it("keeps overdue and undated unfinished tasks; removes only completed tasks", () => {
    const tasks = pendingTasks([item()]);
    expect(tasks.map((task) => task.id)).toEqual(["late", "future", "undated"]);
    expect(tasks[0].collaborationId).toBe("a");
    expect(tasks[2].due_date).toBeNull();
  });
  it("labels dates by calendar day without assigning a time", () => {
    expect(dueState("2026-10-14", "2026-10-15")).toBe("기한 지남 · 미완료");
    expect(dueState("2026-10-15", "2026-10-15")).toBe("오늘");
    expect(dueState("2026-10-16", "2026-10-15")).toBe("예정");
    expect(dueState(null, "2026-10-15")).toBe("기한 없음");
    expect(localDate(new Date(2026, 9, 15, 0, 1))).toBe("2026-10-15");
    expect(localDate(new Date(2026, 9, 15, 23, 59))).toBe("2026-10-15");
  });
  it("does not treat missing information as not mentioned or turn uncertainty into a Task", () => {
    const value = item(); value.v03_contents = [];
    value.v03_sources = [{ v03_reviews: [
      { candidate: { candidate_id: "draft_due", information_state: "not_mentioned" } },
      { candidate: { candidate_id: "publish_due", information_state: "uncertain" } },
    ] }];
    expect(scheduleSummary(value, "draft_delivery", "draft_due")).toBe("원문에 미기재");
    expect(scheduleSummary(value, "publish", "publish_due")).toBe("불명확 · 판독 불가");
    expect(pendingTasks([value])).toEqual([]);
  });
});
describe("owner-scoped home query", () => {
  it("reads all pages with a stable cursor and does not request performance, codes or source text", async () => {
    const first = Array.from({ length: 100 }, (_, n) => item(String(n).padStart(3, "0")));
    const m = backend([{ data: first }, { data: [item("100")] }]);
    const signal = new AbortController().signal;
    expect(await loadHome(m.client, "owner", signal)).toHaveLength(101);
    expect(m.query.eq.mock.calls).toEqual([["user_id", "owner"], ["user_id", "owner"]]);
    expect(m.query.gt).toHaveBeenCalledWith("id", "099");
    expect(m.query.abortSignal).toHaveBeenCalledWith(signal);
    expect(m.query.retry).toHaveBeenCalledWith(false);
    const columns = m.query.select.mock.calls[0][0];
    expect(columns).not.toMatch(/performance|ad_code|raw_text|notes/);
  });
  it("returns an empty result only for a successful empty page", async () => {
    expect(await loadHome(backend([{ data: [] }]).client, "owner", new AbortController().signal)).toEqual([]);
    await expect(loadHome(backend([{ data: null }]).client, "owner", new AbortController().signal)).rejects.toThrow(DetailError);
  });
  it.each([[401, "signin"], [403, "network"], [503, "network"]] as const)("classifies HTTP %s without exposing server details", async (status, kind) => {
    const m = backend([{ data: null, status, error: { message: "private diagnostic" } }]);
    await expect(loadHome(m.client, "owner", new AbortController().signal)).rejects.toEqual(new DetailError(kind));
  });
  it("discards results after cancellation", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(loadHome(backend([{ data: [item()] }]).client, "owner", controller.signal)).rejects.toThrow(DetailError);
  });
});
