import {test,expect,type Page} from '@playwright/test';
import {backend,fixture,ID} from './detail-fixture';
const CONTENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',SECOND='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
async function setup(page:Page,mode:'normal'|'lost'|'pending'='normal',multiple=false){
 const data=fixture();data.notes='initial note';data.v03_contents[0].id=CONTENT;data.v03_contents[0].revision=0;
 data.v03_sources[0].v03_reviews.push({candidate:{candidate_id:'manual_registration',origin:'manual',entry:{collaboration:{title:data.title,notes:data.notes},content:{platform:'Instagram'}}}});
 if(multiple)data.v03_contents.push({id:SECOND,title:'두 번째 콘텐츠',platform:'TikTok',revision:0,v03_tasks:[]});
 const requests:Record<string,any>[]=[],receipts=new Map<string,unknown>();let release!:()=>void;const pending=new Promise<void>(r=>{release=r;});
 const api=await backend(page,async()=>({status:200,body:[structuredClone(data)]}));
 await page.route('**/rest/v1/rpc/v03_update_basic_info',async route=>{
  const b=route.request().postDataJSON();requests.push(b);const reply=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(receipts.has(b.p_request_id))return reply(receipts.get(b.p_request_id));
  const content=data.v03_contents.find(c=>c.id===b.p_content_id);
  if(data.revision!==b.p_expected_revision||(content&&content.revision!==b.p_expected_content_revision))return reply({message:'v03_basic_conflict'},400);
  data.title=b.p_title;data.notes=b.p_notes;data.revision++;if(content){content.platform=b.p_platform;content.revision!++;}
  const result={id:ID,revision:data.revision,content_id:b.p_content_id,content_revision:content?.revision??null};receipts.set(b.p_request_id,result);
  if(mode==='pending'&&requests.length===1)await pending;
  if(mode==='lost'&&requests.length===1)return reply({message:'private diagnostic'},503);
  return reply(result);
 });
 await page.goto(`/#/collaborations/${ID}`);await api.login();await expect(page.getByRole('button',{name:'기본 정보 수정',exact:true})).toBeVisible();return {data,requests,release};
}
async function edit(page:Page){await page.getByRole('button',{name:'기본 정보 수정',exact:true}).click();}
test('prefills values, cancel sends nothing and blank name blocks save',async({page})=>{
 const m=await setup(page);await edit(page);await expect(page.getByLabel('협찬 이름 수정 (필수)',{exact:true})).toHaveValue('브랜드 A 캠페인');await expect(page.getByLabel('메모 수정 (선택)',{exact:true})).toHaveValue('initial note');await expect(page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)',{exact:true})).toHaveValue('Instagram');
 await page.getByLabel('협찬 이름 수정 (필수)',{exact:true}).fill('  ');await expect(page.getByRole('button',{name:'기본 정보 저장',exact:true})).toBeDisabled();await page.getByRole('button',{name:'수정 취소',exact:true}).click();expect(m.requests).toHaveLength(0);await edit(page);await expect(page.getByLabel('협찬 이름 수정 (필수)',{exact:true})).toHaveValue('브랜드 A 캠페인');
});
test('saves current name/platform/notes to detail, home and reload while initial snapshot remains',async({page})=>{
 const m=await setup(page);const before=structuredClone(m.data);await edit(page);await page.getByLabel('협찬 이름 수정 (필수)',{exact:true}).fill('새 캠페인');await page.getByLabel('메모 수정 (선택)',{exact:true}).fill('현재 메모');await page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)',{exact:true}).fill('YouTube');await page.getByRole('button',{name:'기본 정보 저장',exact:true}).click();await expect(page.locator('.detail-intro h1')).toHaveText('새 캠페인');
 await page.getByText('최초 수동 입력 보기 · 현재 운영 정보와 별도',{exact:true}).click();const region=page.getByRole('region',{name:'현재 운영 정보'});await expect(region).toContainText('initial note');await expect(region).toContainText('Instagram');expect(m.data.v03_sources).toEqual(before.v03_sources);expect(m.data.status).toBe(before.status);expect(m.data.v03_contents[0].v03_tasks).toEqual(before.v03_contents[0].v03_tasks);
 await page.getByRole('link',{name:'← 홈',exact:true}).click();await expect(page.getByRole('link',{name:'새 캠페인 상세 보기',exact:true})).toBeVisible();await page.reload();await page.getByRole('link',{name:'새 캠페인 상세 보기',exact:true}).click();await expect(page.locator('.detail-intro h1')).toHaveText('새 캠페인');await expect(page.getByRole('region',{name:'현재 운영 정보'})).toContainText('YouTube');
 await page.getByText('V03 계정 · 로그인됨',{exact:true}).click();await page.getByRole('region',{name:'현재 운영 정보'}).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/basic-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('multi-content requires explicit platform target and never changes another content',async({page})=>{
 const m=await setup(page,'normal',true);await edit(page);await expect(page.getByLabel('플랫폼 수정 대상 콘텐츠')).toHaveValue('');await expect(page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)')).toHaveCount(0);await page.getByLabel('플랫폼 수정 대상 콘텐츠').selectOption(SECOND);await expect(page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)')).toHaveValue('TikTok');await page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)').fill('');await page.getByLabel('메모 수정 (선택)').fill('');await page.getByRole('button',{name:'기본 정보 저장',exact:true}).click();await expect(page.getByText('변경을 저장했어요. 최신 DB 내용을 확인해요.')).toBeVisible();expect(m.requests[0].p_content_id).toBe(SECOND);expect(m.data.v03_contents[0].platform).toBe('Instagram');expect(m.data.v03_contents[1].platform).toBeNull();expect(m.data.notes).toBeNull();
});
test('stale content version blocks overwrite until refresh and explicit re-entry',async({page})=>{
 const m=await setup(page);await edit(page);await page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)').fill('YouTube');m.data.v03_contents[0].platform='TikTok';m.data.v03_contents[0].revision=1;await page.getByRole('button',{name:'기본 정보 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('다른 변경이 먼저 저장됐어요.');await expect(page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)')).toBeDisabled();await page.getByRole('button',{name:'최신 내용 불러오기',exact:true}).click();await expect(page.getByRole('button',{name:'기본 정보 수정',exact:true})).toBeVisible();await edit(page);await expect(page.getByLabel('선택 콘텐츠 플랫폼 수정 (선택)')).toHaveValue('TikTok');
});
test('lost response retries identical UUID and rereads newer current info',async({page})=>{
 const m=await setup(page,'lost');await edit(page);await page.getByLabel('협찬 이름 수정 (필수)').fill('Saved once');await page.getByRole('button',{name:'기본 정보 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했어요.');m.data.title='Newer';m.data.revision=2;m.data.v03_contents[0].revision=2;m.data.v03_contents[0].platform='Newer platform';await page.getByRole('button',{name:'같은 요청 다시 시도',exact:true}).click();await expect(page.locator('.detail-intro h1')).toHaveText('Newer');expect(m.requests[0]).toEqual(m.requests[1]);await expect(page.getByText('private diagnostic')).toHaveCount(0);
});
test('pending save prevents duplicate actions and ignores late response after logout',async({page})=>{
 const m=await setup(page,'pending');await edit(page);await page.getByLabel('협찬 이름 수정 (필수)').fill('Pending');await page.getByRole('button',{name:'기본 정보 저장',exact:true}).dblclick();await expect(page.getByText('저장 중이에요. 다른 변경은 잠시 기다려주세요.')).toBeVisible();expect(m.requests).toHaveLength(1);await expect(page.getByRole('button',{name:'수정 취소',exact:true})).toBeDisabled();await page.getByRole('button',{name:'로그아웃',exact:true}).click();m.release();await expect(page.getByText('협찬을 보려면 위의 V03 계정에서 로그인해주세요.')).toBeVisible();await expect(page.getByRole('region',{name:'현재 운영 정보'})).toHaveCount(0);
});
test('stalled basic save times out and recovers the identical request receipt',async({page})=>{
 await page.clock.install();const m=await setup(page,'pending');await edit(page);await page.getByLabel('협찬 이름 수정 (필수)').fill('Saved once');await page.getByRole('button',{name:'기본 정보 저장',exact:true}).click();await expect(page.getByText('저장 중이에요. 다른 변경은 잠시 기다려주세요.')).toBeVisible();await page.clock.fastForward(15001);await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했어요.');await page.getByRole('button',{name:'같은 요청 다시 시도',exact:true}).click();await expect(page.locator('.detail-intro h1')).toHaveText('Saved once');expect(m.requests[0]).toEqual(m.requests[1]);expect(m.data.revision).toBe(1);m.release();
});
