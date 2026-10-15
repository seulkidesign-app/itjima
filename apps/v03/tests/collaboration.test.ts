import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DetailError, loadCollaboration, scheduleSummary, type Collaboration } from "../src/integrations/collaboration";
const id = "77777777-7777-4777-8777-777777777777";
function mock(data: unknown, status = 200) {
  const query = {
    retry: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, status, error: status === 200 ? null : { message: "private backend error" } }),
  };
  const from = vi.fn().mockReturnValue(query);
  return { query, from, client: { from } as unknown as SupabaseClient };
}
describe("saved collaboration reads", () => {
  it("filters by URL ID and current owner, supports cancellation", async () => {
    const m = mock({ id }); const signal = new AbortController().signal;
    expect(await loadCollaboration(m.client, id, "owner", signal)).toEqual({ id });
    expect(m.query.eq.mock.calls).toEqual([["id", id], ["user_id", "owner"]]);
    expect(m.query.abortSignal).toHaveBeenCalledWith(signal);
  });
  it("does not request malformed IDs", async () => {
    const m = mock(null);
    expect(await loadCollaboration(m.client, "../other", "owner")).toBeNull();
    expect(m.from).not.toHaveBeenCalled();
  });
  it("treats missing and RLS-hidden records alike", async () => {
    expect(await loadCollaboration(mock(null).client, id, "owner")).toBeNull();
  });
  it.each([[401, "signin"], [403, "unavailable"], [503, "network"]] as const)("classifies HTTP %s without leaking the response", async (status, kind) => {
    await expect(loadCollaboration(mock(null, status).client, id, "owner")).rejects.toEqual(new DetailError(kind));
  });
  it("uses actual Task dates and keeps unresolved review states distinct", () => {
    const detail = {
      v03_contents: [{ v03_tasks: [{ type: "draft_delivery", due_date: "2026-10-20" }] }],
      v03_sources: [{ v03_reviews: [{ candidate: { candidate_id: "draft_due", information_state: "uncertain" } }, { candidate: { candidate_id: "publish_due", information_state: "not_mentioned" } }] }],
    } as Collaboration;
    expect(scheduleSummary(detail, "draft_delivery", "draft_due")).toBe("2026. 10. 20.");
    expect(scheduleSummary(detail, "publish", "publish_due")).toBe("원문에 미기재");
    detail.v03_sources[0].v03_reviews[1].candidate.information_state = "uncertain";
    expect(scheduleSummary(detail, "publish", "publish_due")).toBe("불명확 · 판독 불가");
    expect(scheduleSummary(detail, "unknown", "unknown")).toBe("확인 정보 없음");
  });
});
