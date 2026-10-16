import {it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {currentSchedule,saveSchedule} from '../src/integrations/schedule';
import {scheduleSummary,type SavedReview,type ScheduleState} from '../src/integrations/collaboration';
const id='11111111-1111-4111-8111-111111111111';
it.each([['not_mentioned','원문에 미기재'],['uncertain','불명확 · 판독 불가'],['not_entered','수동 등록 시 입력하지 않음'],['removed','사용자가 날짜 제거함']] as const)('distinguishes %s without mutating initial evidence', (kind,label)=>{
 const reviews:SavedReview[]=[{candidate:{candidate_id:'draft_due',...(kind==='not_entered'?{origin:'manual',input_state:'not_entered' as const}:kind==='removed'?{origin:'manual',information_state:'present' as const,due_date:'2026-11-10'}:{information_state:kind})}}];
 const states:ScheduleState[]=kind==='removed'?[{type:'draft_delivery',information_state:null,date_state:'removed',revision:1}]:[];
 const content={id,v03_tasks:[],v03_schedule_states:states},before=JSON.stringify(reviews);expect(scheduleSummary({v03_contents:[content],v03_sources:[{v03_reviews:reviews}]},'draft_delivery','draft_due')).toBe(label);expect(currentSchedule(content,reviews,'draft_delivery').informationState).toBe(kind);expect(JSON.stringify(reviews)).toBe(before);
});
it('never infers removal from old cleared state or a null Task date',()=>{
 for(const information_state of ['uncertain','not_mentioned'] as const){const content={id,v03_tasks:[],v03_schedule_states:[{type:'draft_delivery' as const,information_state,revision:3}]};expect(currentSchedule(content,[],'draft_delivery').informationState).toBe(information_state);}
 expect(currentSchedule({id,v03_tasks:[{id,type:'draft_delivery',title:'task',due_date:null,completed_at:null,revision:2}]},[{candidate:{candidate_id:'draft_due',information_state:'present',due_date:'2026-11-10'}}],'draft_delivery').informationState).toBeUndefined();
});
it('sends explicit removal command with the same version/request boundary',async()=>{
 const query={abortSignal:vi.fn().mockReturnThis(),retry:vi.fn().mockResolvedValue({data:{content_id:id,type:'draft_delivery',revision:2},error:null})},rpc=vi.fn().mockReturnValue(query);
 await saveSchedule({rpc} as unknown as SupabaseClient,{contentId:id,type:'draft_delivery',informationState:'removed',dueDate:null,revision:1,taskRevision:2,requestId:id},new AbortController().signal);expect(rpc.mock.calls[0][1]).toMatchObject({p_information_state:'removed',p_due_date:null,p_expected_revision:1,p_expected_task_revision:2});
});
