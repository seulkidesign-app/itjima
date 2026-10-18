import {test,expect,type Page} from '@playwright/test';
import {backend,fixture,ID} from './detail-fixture';
async function openSchedule(page:Page){await page.getByRole('button',{name:'일정 수정',exact:true}).click();}
const CONTENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function setup(page:Page,mode:'normal'|'lost'|'pending'='normal',kind='dated',completed=true){
 const data=fixture(),content=data.v03_contents[0];content.id=CONTENT;content.v03_schedule_states=[];content.v03_tasks[0].completed_at=completed?'2026-10-16T00:00:00Z':null;
 const review=data.v03_sources[0].v03_reviews[0].candidate;review.due_date='2026-10-20';
 if(kind!=='dated'){
  content.v03_tasks[0].due_date=null;
  if(kind==='legacy')content.v03_schedule_states=[{type:'draft_delivery',information_state:'uncertain',revision:3}];
  else{content.v03_tasks=content.v03_tasks.filter(t=>t.type!=='draft_delivery');review.due_date=null;if(kind==='not_entered'){review.origin='manual';review.information_state=undefined;review.input_state='not_entered';}else review.information_state=kind as 'not_mentioned'|'uncertain';}
 }
 const requests:Record<string,any>[]=[],receipts=new Map<string,unknown>();let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});
 const api=await backend(page,async()=>({status:200,body:[structuredClone(data)]}));
 await page.route('**/rest/v1/rpc/v03_update_schedule',async route=>{
  const b=route.request().postDataJSON();requests.push(b);const reply=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(receipts.has(b.p_request_id))return reply(receipts.get(b.p_request_id));
  let state=content.v03_schedule_states!.find(s=>s.type===b.p_type);const task=content.v03_tasks.find(t=>t.type===b.p_type)!;
  if((state?.revision??0)!==b.p_expected_revision||task.revision!==b.p_expected_task_revision)return reply({message:'v03_schedule_conflict'},400);
  task.due_date=b.p_due_date;task.revision++;
  if(!state){state={type:b.p_type,information_state:null,revision:0};content.v03_schedule_states!.push(state);}
  state.information_state=b.p_information_state==='removed'?null:b.p_information_state;state.date_state=b.p_information_state==='removed'?'removed':null;state.revision++;
  const result={content_id:CONTENT,type:b.p_type,revision:state.revision};receipts.set(b.p_request_id,result);
  if(mode==='pending'&&requests.length===1)await wait;
  if(mode==='lost'&&requests.length===1)return reply({message:'private diagnostic'},503);return reply(result);
 });
 await page.goto(`/#/collaborations/${ID}`);await api.login();await page.getByRole('button',{name:'일정 수정',exact:true}).click();await expect(page.getByRole('region',{name:'일정 수정'})).toBeVisible();return{data,content,requests,release};
}
async function remove(page:Page){await page.getByRole('button',{name:'가편 전달일 제거',exact:true}).click();await page.getByRole('button',{name:'가편 전달일 제거 확인',exact:true}).click();}
test('explicit removal and restore preserve completed Task, other date, status and original review across home/reload',async({page})=>{
 const m=await setup(page),before=structuredClone(m.data),task=m.content.v03_tasks[0];await remove(page);
 await expect(page.getByRole('region',{name:'주요 일정'})).toContainText('사용자가 날짜 제거함');expect(m.requests[0].p_information_state).toBe('removed');expect(task.id).toBe(before.v03_contents[0].v03_tasks[0].id);expect(task.completed_at).toBe(before.v03_contents[0].v03_tasks[0].completed_at);expect(m.data.v03_sources).toEqual(before.v03_sources);expect(m.data.status).toBe(before.status);expect(m.content.v03_tasks[1]).toEqual(before.v03_contents[0].v03_tasks[1]);
 await openSchedule(page);await page.getByText('가편 전달일 최초 검토 보기',{exact:true}).click();await expect(page.getByRole('region',{name:'일정 수정'})).toContainText('2026. 10. 20.');
 await page.getByRole('link',{name:'← 홈',exact:true}).click();await expect(page.getByRole('link',{name:'브랜드 A 캠페인 상세 보기',exact:true})).toContainText('사용자가 날짜 제거함');await page.reload();await page.getByRole('link',{name:'브랜드 A 캠페인 상세 보기',exact:true}).click();
 await openSchedule(page);await page.getByLabel('가편 전달일 정보 상태',{exact:true}).selectOption('present');await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('2026-11-01');await page.getByRole('button',{name:'가편 전달일 저장',exact:true}).click();await expect(page.getByRole('region',{name:'주요 일정'})).toContainText('2026. 11. 01.');expect(task.id).toBe(before.v03_contents[0].v03_tasks[0].id);expect(task.completed_at).toBeTruthy();expect(m.content.v03_schedule_states![0].date_state).toBeNull();
});
for(const [kind,label] of [['not_mentioned','원문에 미기재'],['uncertain','불명확 · 판독 불가'],['not_entered','수동 등록 시 입력하지 않음']])test(`undated ${kind} remains distinct and cannot be marked as removed`,async({page})=>{
 const m=await setup(page,'normal',kind);await expect(page.getByRole('region',{name:'주요 일정'})).toContainText(label);await expect(page.getByRole('button',{name:'가편 전달일 제거',exact:true})).toHaveCount(0);expect(m.requests).toHaveLength(0);
});
test('legacy cleared state stays legacy with no inferred removal',async({page})=>{const m=await setup(page,'normal','legacy');await expect(page.getByRole('region',{name:'주요 일정'})).toContainText('현재 일정 불명확');await expect(page.getByRole('region',{name:'주요 일정'})).not.toContainText('사용자가 날짜 제거함');expect(m.content.v03_schedule_states![0].date_state).toBeUndefined();expect(m.requests).toHaveLength(0);});
test('unfinished removed Task remains on home with explicit removal meaning',async({page})=>{await setup(page,'normal','dated',false);await remove(page);await expect(page.getByRole('region',{name:'주요 일정'})).toContainText('사용자가 날짜 제거함');await page.getByRole('link',{name:'← 홈',exact:true}).click();await expect(page.getByRole('region',{name:'다음 해야 할 일'})).toContainText('사용자가 날짜 제거함 · 기한 없음');});
test('stale task version refuses removal until refresh',async({page})=>{const m=await setup(page);m.content.v03_tasks[0].revision=1;m.content.v03_tasks[0].due_date='2026-10-25';await remove(page);await expect(page.getByRole('alert')).toContainText('다른 변경이 먼저 저장됐어요.');await page.getByRole('button',{name:'최신 내용 불러오기',exact:true}).click();await openSchedule(page);await expect(page.getByLabel('가편 전달일 (연도 포함)',{exact:true})).toHaveValue('2026-10-25');});
test('old removal receipt retry reads a newer restored date',async({page})=>{const m=await setup(page,'lost');await remove(page);await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했어요.');m.content.v03_tasks[0].due_date='2026-11-02';m.content.v03_tasks[0].revision=2;m.content.v03_schedule_states![0]={type:'draft_delivery',information_state:'present',date_state:null,revision:2};await page.getByRole('button',{name:'같은 요청 다시 시도',exact:true}).click();await expect(page.getByRole('region',{name:'주요 일정'})).toContainText('2026. 11. 02.');expect(m.requests[0]).toEqual(m.requests[1]);});
test('pending removal prevents duplicates and ignores a reply after logout',async({page})=>{const m=await setup(page,'pending');await page.getByRole('button',{name:'가편 전달일 제거',exact:true}).click();await page.getByRole('button',{name:'가편 전달일 제거 확인',exact:true}).dblclick();await expect(page.getByText('저장 중이에요. 다른 변경은 잠시 기다려주세요.')).toBeVisible();expect(m.requests).toHaveLength(1);await page.getByRole('button',{name:'로그아웃',exact:true}).click();m.release();await expect(page.getByText('협찬을 보려면 위의 V03 계정에서 로그인해주세요.')).toBeVisible();});
