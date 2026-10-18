import {expect,test,type Page} from '@playwright/test';
import {backend,fixture,ID} from './detail-fixture';
async function openSchedule(page:Page){await page.getByRole('button',{name:'일정 수정',exact:true}).click();}
const CONTENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function setup(page:Page,mode:'normal'|'lost'|'pending'='normal'){
 const data=fixture(),content=data.v03_contents[0];content.id=CONTENT;content.v03_schedule_states=[];
 content.v03_tasks[0].completed_at='2026-10-15T00:00:00Z';
 data.v03_sources[0].v03_reviews[0].candidate.due_date='2026-10-20';
 const requests:Record<string,any>[]=[];const receipts=new Map<string,unknown>();
 let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});
 const api=await backend(page,async()=>({status:200,body:[structuredClone(data)]}));
 await page.route('**/rest/v1/rpc/v03_update_schedule',async route=>{
  const b=route.request().postDataJSON();requests.push(b);
  const reply=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(receipts.has(b.p_request_id))return reply(receipts.get(b.p_request_id));
  let state=content.v03_schedule_states!.find(s=>s.type===b.p_type);
  const task=content.v03_tasks.find(t=>t.type===b.p_type)!;
  if((state?.revision??0)!==b.p_expected_revision||task.revision!==b.p_expected_task_revision)return reply({message:'v03_schedule_conflict'},400);
  task.due_date=b.p_due_date;task.revision++;
  if(state){state.revision++;state.information_state=b.p_information_state;}
  else{state={type:b.p_type,information_state:b.p_information_state,revision:1};content.v03_schedule_states!.push(state);}
  const result={content_id:CONTENT,type:b.p_type,revision:state.revision};receipts.set(b.p_request_id,result);
  if(mode==='pending'&&requests.length===1)await wait;
  if(mode==='lost'&&requests.length===1)return reply({message:'private diagnostic'},503);
  return reply(result);
 });
 await page.goto(`/#/collaborations/${ID}`);await api.login();await page.getByRole('button',{name:'일정 수정',exact:true}).click();
 await expect(page.getByRole('region',{name:'일정 수정'})).toBeVisible();return{data,content,requests,release};
}
test('mobile current dates persist to detail, home and reload while original review stays fixed',async({page})=>{
 const m=await setup(page);
 await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('2026-10-28');
 await page.getByRole('button',{name:'가편 전달일 저장',exact:true}).click();
 await openSchedule(page);await expect(page.getByLabel('가편 전달일 (연도 포함)',{exact:true})).toHaveValue('2026-10-28');
 await expect(page.getByText('변경을 저장했어요. 최신 DB 내용을 확인해요.')).toBeVisible();
 await page.getByText('가편 전달일 최초 검토 보기',{exact:true}).click();
 await expect(page.getByRole('region',{name:'일정 수정'})).toContainText('2026. 10. 20.');
 expect(m.data.status).toBe('producing');expect(m.content.v03_tasks[0].completed_at).toBe('2026-10-15T00:00:00Z');
 await page.getByRole('link',{name:'← 홈',exact:true}).click();
 await expect(page.getByRole('link',{name:'브랜드 A 캠페인 상세 보기',exact:true})).toContainText('2026. 10. 28.');
 await page.reload();await expect(page.getByRole('link',{name:'브랜드 A 캠페인 상세 보기',exact:true})).toContainText('2026. 10. 28.');
 await page.getByRole('link',{name:'브랜드 A 캠페인 상세 보기',exact:true}).click();
 await openSchedule(page);await page.getByLabel('업로드 예정일 (연도 포함)',{exact:true}).fill('2026-11-02');
 await page.getByRole('button',{name:'업로드 예정일 저장',exact:true}).click();
 await expect(page.getByText('변경을 저장했어요. 최신 DB 내용을 확인해요.')).toBeVisible();
 expect(m.content.v03_tasks[0].due_date).toBe('2026-10-28');
 await page.getByText('V03 계정 · 로그인됨',{exact:true}).click();
 await page.getByRole('region',{name:'주요 일정'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/schedule-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('blank date cannot save and explicit removal can be cancelled without a write',async({page})=>{
 const m=await setup(page);await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('');
 await expect(page.getByRole('button',{name:'가편 전달일 저장',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'가편 전달일 제거',exact:true}).click();await page.getByRole('button',{name:'제거 취소',exact:true}).click();expect(m.requests).toHaveLength(0);expect(m.content.v03_tasks[0].due_date).toBe('2026-10-20');
});
test('stale schedule conflict requires refresh and explicit choice',async({page})=>{
 const m=await setup(page);await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('2026-10-28');
 m.content.v03_tasks[0].due_date='2026-10-27';m.content.v03_tasks[0].revision=1;
 m.content.v03_schedule_states=[{type:'draft_delivery',information_state:'present',revision:1}];
 await page.getByRole('button',{name:'가편 전달일 저장',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('다른 변경이 먼저 저장됐어요.');
 await expect(page.getByLabel('가편 전달일 정보 상태')).toBeDisabled();
 await page.getByRole('button',{name:'최신 내용 불러오기',exact:true}).click();await openSchedule(page);
 await expect(page.getByLabel('가편 전달일 (연도 포함)',{exact:true})).toHaveValue('2026-10-27');
 await expect(page.getByRole('button',{name:'가편 전달일 저장',exact:true})).toBeDisabled();
});
test('lost response retries identical UUID and reads newer schedule',async({page})=>{
 const m=await setup(page,'lost');await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('2026-10-28');
 await page.getByRole('button',{name:'가편 전달일 저장',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했어요.');
 m.content.v03_tasks[0].due_date='2026-10-29';m.content.v03_tasks[0].revision=2;m.content.v03_schedule_states![0].revision=2;
 await page.getByRole('button',{name:'같은 요청 다시 시도',exact:true}).click();
 await openSchedule(page);await expect(page.getByLabel('가편 전달일 (연도 포함)',{exact:true})).toHaveValue('2026-10-29');
 expect(m.requests[0]).toEqual(m.requests[1]);await expect(page.getByText('private diagnostic')).toHaveCount(0);
});
test('saving blocks duplicate actions and ignores late response after logout',async({page})=>{
 const m=await setup(page,'pending');await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('2026-10-28');
 await page.getByRole('button',{name:'가편 전달일 저장',exact:true}).dblclick();
 await expect(page.getByText('저장 중이에요. 다른 변경은 잠시 기다려주세요.')).toBeVisible();expect(m.requests).toHaveLength(1);
 await expect(page.getByLabel('업로드 예정일 정보 상태')).toBeDisabled();
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();m.release();
 await expect(page.getByText('협찬을 보려면 위의 V03 계정에서 로그인해주세요.')).toBeVisible();
 await expect(page.getByRole('region',{name:'일정 수정'})).toHaveCount(0);
});
test('stalled schedule times out and identical retry recovers receipt',async({page})=>{
 await page.clock.install();const m=await setup(page,'pending');
 await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('2026-10-28');
 await page.getByRole('button',{name:'가편 전달일 저장',exact:true}).click();
 await expect(page.getByText('저장 중이에요. 다른 변경은 잠시 기다려주세요.')).toBeVisible();
 await page.clock.fastForward(15001);
 await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했어요.');
 await page.getByRole('button',{name:'같은 요청 다시 시도',exact:true}).click();
 await expect(page.getByText('변경을 저장했어요. 최신 DB 내용을 확인해요.')).toBeVisible();
 expect(m.requests[0]).toEqual(m.requests[1]);expect(m.content.v03_tasks[0].revision).toBe(1);m.release();
});
