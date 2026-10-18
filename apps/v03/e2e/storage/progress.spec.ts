import { expect, test, type Page } from "@playwright/test";
import { backend, fixture, ID, TASK } from "./detail-fixture";
async function setup(page:Page,mode:"normal"|"lost"|"pending"="normal") {
 const data=fixture();const requests:Record<string,unknown>[]=[];const receipts=new Map<string,unknown>();
 let release!:()=>void;const pending=new Promise<void>((resolve)=>{release=resolve;});
 const api=await backend(page,async()=>({status:200,body:[structuredClone(data)]}));
 await page.route('**/rest/v1/rpc/v03_*',async(route)=>{
  const body=route.request().postDataJSON();requests.push(body);
  const reply=(result:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  if(receipts.has(body.p_request_id))return reply(receipts.get(body.p_request_id));
  const isStatus=new URL(route.request().url()).pathname.endsWith('v03_update_collaboration_status');
  const row=isStatus?data:data.v03_contents[0].v03_tasks.find((t)=>t.id===body.p_id)!;
  if(row.revision!==body.p_expected_revision)return reply({message:'v03_progress_conflict',code:'P0001'},400);
  row.revision++;
  if(isStatus)data.status=body.p_status;
  else (row as typeof data.v03_contents[0]['v03_tasks'][number]).completed_at=body.p_completed?'2026-10-15T03:00:00Z':null;
  const result=isStatus?{id:ID,status:data.status,revision:data.revision}:{id:row.id,completed_at:(row as typeof data.v03_contents[0]['v03_tasks'][number]).completed_at,revision:row.revision};
  receipts.set(body.p_request_id,result);
  if(mode==='pending'&&requests.length===1)await pending;
  if(mode==='lost'&&requests.length===1)return reply({message:'private diagnostic'},503);
  return reply(result);
 });
 await page.goto(`/#/collaborations/${ID}`);await api.login();
 await expect(page.getByRole('heading',{name:data.title,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'상태 수정',exact:true}).click();
 return {data,requests,release};
}
test('status skips, reversals and every allowed value are reflected without completing tasks',async({page})=>{
 const m=await setup(page);
 for(const [value,label] of [['completed','완료'],['discussion','제안/협의'],['on_hold','보류'],['scheduled','업로드 예정'],['in_review','컨펌 중'],['draft_sent','가편 전달'],['producing','제작 중']]){
  if(await page.getByLabel('협찬 상태 변경').count()===0)await page.getByRole('button',{name:'상태 수정',exact:true}).click();
  await page.getByLabel('협찬 상태 변경',{exact:true}).selectOption(value);
  await page.getByRole('button',{name:'상태 저장',exact:true}).click();
  await expect(page.locator('.detail-intro .badge')).toHaveText(label);
 }
 expect(m.data.v03_contents[0].v03_tasks.every(t=>t.completed_at===null)).toBe(true);
 await page.getByText('V03 계정 · 로그인됨',{exact:true}).click();
 await page.locator('.detail-intro').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/progress-mobile.png'});
 await page.reload();await expect(page.locator('.detail-intro .badge')).toHaveText('제작 중');
});
test('task completion and undo never change status, and home reads the saved result',async({page})=>{
 const m=await setup(page);
 await page.getByRole('button',{name:'가편 전달 완료로 표시',exact:true}).click();
 await expect(page.getByRole('button',{name:'가편 전달 미완료로 되돌리기',exact:true})).toBeVisible();
 expect(m.data.status).toBe('producing');
 await page.getByRole('link',{name:'← 홈',exact:true}).click();
 await expect(page.getByRole('region',{name:'다음 해야 할 일'}).getByRole('link')).toHaveCount(2);
 await page.getByRole('link',{name:'브랜드 A 캠페인 상세 보기',exact:true}).click();
 await page.getByRole('button',{name:'가편 전달 미완료로 되돌리기',exact:true}).click();
 await expect(page.getByRole('button',{name:'가편 전달 완료로 표시',exact:true})).toBeVisible();
 expect(m.data.v03_contents[0].v03_tasks.find(t=>t.id===TASK)?.completed_at).toBeNull();
 expect(m.data.status).toBe('producing');
});
test('conflict blocks edits until fresh data is loaded and user chooses again',async({page})=>{
 const m=await setup(page);
 if(await page.getByLabel('협찬 상태 변경').count()===0)await page.getByRole('button',{name:'상태 수정',exact:true}).click();
  await page.getByLabel('협찬 상태 변경').selectOption('completed');
 m.data.status='on_hold';m.data.revision=1;
 await page.getByRole('button',{name:'상태 저장',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('다른 변경이 먼저 저장됐어요.');
 await expect(page.getByLabel('협찬 상태 변경')).toBeDisabled();
 expect(m.data.status).toBe('on_hold');
 await page.getByRole('button',{name:'최신 내용 불러오기',exact:true}).click();
 await page.getByRole('button',{name:'상태 수정',exact:true}).click();await expect(page.getByLabel('협찬 상태 변경')).toHaveValue('on_hold');
 if(await page.getByLabel('협찬 상태 변경').count()===0)await page.getByRole('button',{name:'상태 수정',exact:true}).click();
  await page.getByLabel('협찬 상태 변경').selectOption('discussion');
 await page.getByRole('button',{name:'상태 저장',exact:true}).click();
 await expect(page.locator('.detail-intro .badge')).toHaveText('제안/협의');
 expect(m.requests[1].p_expected_revision).toBe(1);
});
test('lost response retries the identical request and refetches current DB values',async({page})=>{
 const m=await setup(page,'lost');
 if(await page.getByLabel('협찬 상태 변경').count()===0)await page.getByRole('button',{name:'상태 수정',exact:true}).click();
  await page.getByLabel('협찬 상태 변경').selectOption('completed');
 await page.getByRole('button',{name:'상태 저장',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했어요.');
 await expect(page.getByRole('button',{name:'가편 전달 완료로 표시',exact:true})).toBeDisabled();
 // A newer write exists before replaying the old success receipt.
 m.data.status='on_hold';m.data.revision=2;
 await page.getByRole('button',{name:'같은 요청 다시 시도',exact:true}).click();
 await expect(page.locator('.detail-intro .badge')).toHaveText('보류');
 expect(m.requests[0]).toEqual(m.requests[1]);expect(m.data.revision).toBe(2);
 await expect(page.getByText('private diagnostic')).toHaveCount(0);
});
test('saving prevents double actions and ignores a reply after logout',async({page})=>{
 const m=await setup(page,'pending');
 if(await page.getByLabel('협찬 상태 변경').count()===0)await page.getByRole('button',{name:'상태 수정',exact:true}).click();
  await page.getByLabel('협찬 상태 변경').selectOption('completed');
 await page.getByRole('button',{name:'상태 저장',exact:true}).dblclick();
 await expect(page.getByText('저장 중이에요. 다른 변경은 잠시 기다려주세요.')).toBeVisible();
 expect(m.requests).toHaveLength(1);
 await expect(page.getByRole('button',{name:'가편 전달 완료로 표시',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();m.release();
 await expect(page.getByText('협찬을 보려면 위의 V03 계정에서 로그인해주세요.')).toBeVisible();
 await expect(page.getByRole('heading',{name:'브랜드 A 캠페인',exact:true})).toHaveCount(0);
 await expect(page.getByText('변경을 저장했어요. 최신 DB 내용을 확인해요.')).toHaveCount(0);
});
test('a stalled mutation times out and same-ID retry recovers its committed receipt',async({page})=>{
 await page.clock.install();const m=await setup(page,'pending');
 await page.getByRole('button',{name:'가편 전달 완료로 표시',exact:true}).click();
 await expect(page.getByText('저장 중이에요. 다른 변경은 잠시 기다려주세요.')).toBeVisible();
 await page.clock.fastForward(15001);
 await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했어요.');
 await page.getByRole('button',{name:'같은 요청 다시 시도',exact:true}).click();
 await expect(page.getByRole('button',{name:'가편 전달 미완료로 되돌리기',exact:true})).toBeVisible();
 m.release();expect(m.requests[0]).toEqual(m.requests[1]);
});
