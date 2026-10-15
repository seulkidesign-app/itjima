import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentSchedule, saveSchedule, validScheduleDate, type ScheduleOperation } from "../src/integrations/schedule";
import { scheduleSummary, type SavedTask } from "../src/integrations/collaboration";
import { ProgressError } from "../src/integrations/progress";
const contentId="77777777-7777-4777-8777-777777777777",requestId="88888888-8888-4888-8888-888888888888";
const operation:ScheduleOperation={contentId,requestId,type:"draft_delivery",informationState:"present",dueDate:"2026-10-22",revision:0,taskRevision:0};
function client(response:unknown){const query={abortSignal:vi.fn().mockReturnThis(),retry:vi.fn().mockResolvedValue(response)};const rpc=vi.fn().mockReturnValue(query);return {rpc,client:{rpc} as unknown as SupabaseClient};}
describe("new schedule boundary",()=>{
 it("sends separate schedule/task versions and a stable retry UUID",async()=>{
  const m=client({error:null,data:{content_id:contentId,type:"draft_delivery",revision:1}});
  const signal=new AbortController().signal;await saveSchedule(m.client,operation,signal);await saveSchedule(m.client,operation,signal);
  expect(m.rpc.mock.calls[0]).toEqual(m.rpc.mock.calls[1]);
  expect(m.rpc).toHaveBeenCalledWith("v03_update_schedule",{p_content_id:contentId,p_type:"draft_delivery",p_information_state:"present",p_due_date:"2026-10-22",p_expected_revision:0,p_expected_task_revision:0,p_request_id:requestId});
 });
 it.each(["2026-02-30","2026-02-29","10-20","2026-10-20T09:00:00Z","0000-01-01"])("rejects invalid or inferred date %s",async(date)=>{
  const m=client({});expect(validScheduleDate(date)).toBe(false);
  await expect(saveSchedule(m.client,{...operation,dueDate:date},new AbortController().signal)).rejects.toEqual(new ProgressError("invalid"));expect(m.rpc).not.toHaveBeenCalled();
 });
 it("accepts a valid leap date and sends null only for unresolved dates",async()=>{
  expect(validScheduleDate("2024-02-29")).toBe(true);
  const m=client({error:null,data:{content_id:contentId,type:"draft_delivery",revision:1}});
  await saveSchedule(m.client,{...operation,informationState:"uncertain",dueDate:null},new AbortController().signal);
  await expect(saveSchedule(m.client,{...operation,informationState:"uncertain"},new AbortController().signal)).rejects.toEqual(new ProgressError("invalid"));
 });
 it.each([["v03_schedule_conflict","conflict"],["v03_schedule_unavailable","unavailable"],["v03_schedule_invalid_retry","invalid"],["untrusted message","unknown"]] as const)("sanitizes %s",async(message,kind)=>{
  await expect(saveSchedule(client({error:{message},status:400}).client,operation,new AbortController().signal)).rejects.toEqual(new ProgressError(kind));
 });
 it("uses current state while preserving the first review and never substitutes its old date",()=>{
  const task:SavedTask={id:"task",type:"draft_delivery",title:"가편",due_date:null,completed_at:"2026-10-01T00:00:00Z",revision:4};
  const content={id:contentId,v03_tasks:[task],v03_schedule_states:[{type:"draft_delivery" as const,information_state:"uncertain" as const,revision:2}]};
  const reviews=[{candidate:{candidate_id:"draft_due",information_state:"present" as const,due_date:"2026-10-20"}}];
  const snapshot=JSON.stringify({task,reviews});const value=currentSchedule(content,reviews,"draft_delivery");
  expect(value.informationState).toBe("uncertain");expect(value.taskRevision).toBe(4);expect(value.initial?.due_date).toBe("2026-10-20");
  expect(scheduleSummary({v03_contents:[content],v03_sources:[{v03_reviews:reviews}]},"draft_delivery","draft_due")).toBe("현재 일정 불명확");
  expect(JSON.stringify({task,reviews})).toBe(snapshot);
 });
 it("flags ambiguous same-role tasks instead of choosing one to overwrite",()=>{
  const t={id:"a",type:"publish",title:"업로드",due_date:"2026-10-20",completed_at:null,revision:0};
  expect(currentSchedule({id:contentId,v03_tasks:[t,{...t,id:"b"}]},[],"publish").ambiguous).toBe(true);
 });
});

it('summarizes each content without hiding missing dates behind another content date', () => {
 expect(scheduleSummary({v03_contents:[{v03_tasks:[{id:'x',type:'publish',title:'upload',due_date:'2026-10-22',completed_at:null,revision:0}]},{v03_tasks:[]}],v03_sources:[{v03_reviews:[{candidate:{candidate_id:'publish_due',information_state:'uncertain'}}]}]},'publish','publish_due')).toBe('2026. 10. 22. / 불명확 · 판독 불가');
});
