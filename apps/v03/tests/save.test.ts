import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveReviewed, saveManual, AbortedSaveError } from "../src/integrations/save";
import {
  mockExtract,
  editCandidate,
  confirmCandidate,
  buildPayload,
} from "../src/domain/brief";
function payload() {
  let d = mockExtract({ text: "브리프", images: [] });
  for (const c of d.candidates) {
    if (c.group === "schedules")
      d = editCandidate(d, c.id, { dueDate: "2026-10-20" });
    d = confirmCandidate(d, c.id);
  }
  return buildPayload(d, "브랜드");
}
function mock(state: "pending" | "committed" | "unknown", fail = false) {
  const calls: string[] = [];
  const rpc = vi.fn(async (name: string) => {
    calls.push(name);
    if (name === "v03_prepare_import" || name === "v03_prepare_manual_import")
      return { data: { state: "pending", collaboration_id: "" }, error: null };
    if (name === "v03_abort_import") return { data: true, error: null };
    return fail
      ? { error: new Error("failure") }
      : { data: "collaboration-id", error: null };
  });
  const remove = vi.fn(async () => {
    calls.push("remove");
    return { error: null };
  });
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-a" } }, error: null }),
    },
    rpc,
    storage: {
      from: () => ({ upload: async () => ({ error: null }), remove }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            state === "unknown"
              ? { error: new Error("offline") }
              : { data: { state, collaboration_id: "recovered" }, error: null },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, rpc, remove, calls };
}
describe("storage compensation and ambiguous commit", () => {
  it("blocks backend calls for unreviewed candidates", async () => {
    const m = mock("pending");
    const p = payload();
    p.review[0].review_state = "unreviewed";
    await expect(
      saveReviewed(m.client, "id", p, { text: "브리프", images: [] }),
    ).rejects.toThrow("미확인");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("returns an already committed request", async () => {
    const m = mock("pending");
    m.rpc.mockResolvedValueOnce({
      data: { state: "committed", collaboration_id: "existing" },
      error: null,
    });
    expect(
      await saveReviewed(m.client, "id", payload(), {
        text: "브리프",
        images: [],
      }),
    ).toBe("existing");
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not delete successful files after lost response", async () => {
    const m = mock("committed", true);
    expect(
      await saveReviewed(m.client, "id", payload(), {
        text: "브리프",
        images: [],
      }),
    ).toBe("recovered");
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("keeps ambiguous requests for same-id recovery", async () => {
    const m = mock("unknown", true);
    await expect(
      saveReviewed(m.client, "id", payload(), { text: "브리프", images: [] }),
    ).rejects.toThrow("결과");
    expect(m.calls).not.toContain("v03_abort_import");
  });
  it("claims abort before compensation and triggers new-id retry", async () => {
    const m = mock("pending", true);
    const file = new File(["image"], "guide.png", { type: "image/png" });
    await expect(
      saveReviewed(m.client, "id", payload(), {
        text: "브리프",
        images: [
          {
            id: "image",
            name: file.name,
            size: file.size,
            type: file.type,
            file,
            url: "blob:source",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(AbortedSaveError);
    expect(m.calls).toEqual([
      "v03_prepare_import",
      "v03_commit_import",
      "v03_abort_import",
      "remove",
    ]);
  });
});


it("manual uses distinct RPCs and shares conservative unknown-result recovery",async()=>{
 const {buildManualPayload,emptyManual}=await import('../src/domain/manual');
 const p=buildManualPayload({...emptyManual(),title:'manual'},{text:'',images:[]},true);
 const m=mock('unknown',true);
 await expect(saveManual(m.client,'same-id',p,{text:'',images:[]})).rejects.toThrow('결과');
 expect(m.calls).toEqual(['v03_prepare_manual_import','v03_commit_manual_import']);expect(m.remove).not.toHaveBeenCalled();
});
it("manual failure aborts before compensating uploaded files",async()=>{
 const {buildManualPayload,emptyManual}=await import('../src/domain/manual');
 const source={text:'',images:[{id:'image',name:'qa.png',size:1,type:'image/png',file:new File(['x'],'qa.png',{type:'image/png'}),url:''}]};
 const p=buildManualPayload({...emptyManual(),title:'manual'},source,true),m=mock('pending',true);
 await expect(saveManual(m.client,'same-id',p,source)).rejects.toBeInstanceOf(AbortedSaveError);
 expect(m.calls).toEqual(['v03_prepare_manual_import','v03_commit_manual_import','v03_abort_import','remove']);
});
it("manual returns committed receipt without uploading again",async()=>{
 const {buildManualPayload,emptyManual}=await import('../src/domain/manual');const source={text:'',images:[]};const m=mock('pending');m.rpc.mockResolvedValueOnce({data:{state:'committed',collaboration_id:'existing'},error:null});
 expect(await saveManual(m.client,'same-id',buildManualPayload({...emptyManual(),title:'manual'},source,true),source)).toBe('existing');expect(m.calls).toHaveLength(0);expect(m.remove).not.toHaveBeenCalled();
});
