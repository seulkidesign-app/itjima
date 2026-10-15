import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProgressError, saveProgress, type ProgressOperation } from "../src/integrations/progress";
const id="77777777-7777-4777-8777-777777777777", requestId="88888888-8888-4888-8888-888888888888";
const op:ProgressOperation={kind:"status",id,requestId,revision:0,value:"completed"};
function client(response:unknown) {
 const builder={abortSignal:vi.fn().mockReturnThis(),retry:vi.fn().mockResolvedValue(response)};
 const rpc=vi.fn().mockReturnValue(builder);
 return {rpc,builder,client:{rpc} as unknown as SupabaseClient};
}
describe("progress RPC boundary",()=>{
 it("sends revision and stable request ID and accepts only a confirmed result",async()=>{
  const m=client({data:{id,status:"completed",revision:1},error:null});
  await saveProgress(m.client,op,new AbortController().signal);
  expect(m.rpc).toHaveBeenCalledWith("v03_update_collaboration_status",{p_id:id,p_status:"completed",p_expected_revision:0,p_request_id:requestId});
  expect(m.builder.retry).toHaveBeenCalledWith(false);
 });
 it.each(["v03_progress_conflict","v03_progress_unavailable","v03_progress_invalid"])("classifies %s without exposing details",async(message)=>{
  const kind=message.replace("v03_progress_","");
  await expect(saveProgress(client({error:{message},status:400}).client,op,new AbortController().signal)).rejects.toEqual(new ProgressError(kind as ProgressError["kind"]));
 });
 it("treats lost or malformed responses as unknown and reuses the request unchanged",async()=>{
  const m=client({error:null,data:{id,status:"completed",revision:0}});
  await expect(saveProgress(m.client,op,new AbortController().signal)).rejects.toEqual(new ProgressError("unknown"));
  await expect(saveProgress(m.client,op,new AbortController().signal)).rejects.toThrow();
  expect(m.rpc.mock.calls[0]).toEqual(m.rpc.mock.calls[1]);
 });
 it("rejects invalid local values before network access",async()=>{
  const m=client({});
  await expect(saveProgress(m.client,{...op,revision:-1},new AbortController().signal)).rejects.toEqual(new ProgressError("invalid"));
  await expect(saveProgress(m.client,{...op,value:true},new AbortController().signal)).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
 });
});
