import {test,expect} from '@playwright/test';
import {backend,ID,PNG} from './detail-fixture';
import {openReview,confirmAll} from '../helpers';
async function manual(page:import('@playwright/test').Page){await page.goto('/#/brief/new');await page.getByRole('button',{name:'원본 미리보기',exact:false}).click();await page.getByRole('button',{name:'직접 입력하기',exact:false}).click();}
test('actual entry starts empty, supports optional dates and arbitrary editable lists with explicit summary gate',async({page})=>{
 const api=await backend(page);await page.goto('/');await api.login();await manual(page);
 await expect(page.getByLabel('협찬 이름',{exact:true})).toHaveValue('');await expect(page.getByLabel('플랫폼 (선택)',{exact:true})).toHaveValue('');await expect(page.getByText('이 후보 확인',{exact:true})).toHaveCount(0);
 await page.getByLabel('협찬 이름',{exact:true}).fill('브랜드 A 캠페인');await page.getByLabel('플랫폼 (선택)',{exact:true}).fill('YouTube');await page.getByLabel('메모 (선택)',{exact:true}).fill('합성 메모');
 await page.getByLabel('업로드 예정일 (선택 · 연도 포함)',{exact:true}).fill('2026-11-05');
 await page.getByRole('button',{name:'할 일 추가',exact:true}).click();await page.getByLabel('할 일 1',{exact:true}).fill('촬영');await page.getByLabel('할 일 1',{exact:true}).fill('제품 촬영');
 await page.getByRole('button',{name:'할 일 추가',exact:true}).click();await page.getByLabel('할 일 2',{exact:true}).fill('삭제할 항목');await page.getByRole('button',{name:'할 일 2 삭제',exact:true}).click();
 await page.getByRole('button',{name:'제작 조건 추가',exact:true}).click();await page.getByLabel('제작 조건 1',{exact:true}).fill('가격 표시 금지');
 await page.getByRole('button',{name:'저장 전 요약 보기',exact:true}).click();await expect(page.getByRole('region',{name:'저장 전 요약'})).toContainText('입력하지 않음');await expect(page.getByRole('button',{name:'확인하고 실제 등록'})).toBeDisabled();
 await page.getByRole('button',{name:'입력 수정',exact:true}).click();await expect(page.getByLabel('할 일 1',{exact:true})).toHaveValue('제품 촬영');await page.getByRole('button',{name:'저장 전 요약 보기',exact:true}).click();await page.getByRole('checkbox').check();
 const request=page.waitForRequest(r=>r.url().endsWith('/v03_prepare_manual_import'));await page.getByRole('button',{name:'확인하고 실제 등록'}).click();const p=(await request).postDataJSON().p_payload;
 expect(p.tasks).toHaveLength(1);expect(p.constraints).toHaveLength(1);expect(p.schedules).toEqual({draft_delivery:null,publish:'2026-11-05'});expect(p.origin).toBe('manual');expect(p.review).toBeUndefined();expect(p.collaboration.notes).toBe('합성 메모');await expect(page).toHaveURL(new RegExp(ID));
});
test('sample never writes even with a logged-in V03 account',async({page})=>{const api=await backend(page);await page.goto('/');await api.login();await openReview(page);await confirmAll(page);await page.getByRole('button',{name:'샘플 요약 보기',exact:true}).click();await expect(page.getByTestId('creation-payload')).toBeVisible();expect(api.calls).toEqual([]);});
test('image selection and preview are retained in manual summary and upload uses manual endpoints',async({page})=>{
 const api=await backend(page);await page.goto('/');await api.login();await page.goto('/#/brief/new');
 await page.getByLabel('이미지 선택',{exact:true}).setInputFiles({name:'manual-guide.png',mimeType:'image/png',buffer:PNG});await expect(page.getByRole('img',{name:'선택한 스크린샷 1'})).toBeVisible();
 await page.getByRole('button',{name:'원본 미리보기',exact:false}).click();await expect(page.getByRole('img',{name:'원본 스크린샷 1: manual-guide.png',exact:true})).toBeVisible();await page.getByRole('button',{name:'직접 입력하기',exact:false}).click();await page.getByLabel('협찬 이름',{exact:true}).fill('브랜드 A 캠페인');await page.getByRole('button',{name:'저장 전 요약 보기',exact:true}).click();await expect(page.getByRole('region',{name:'저장 전 요약'})).toContainText('이미지 1장');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'확인하고 실제 등록'}).click();await expect(page).toHaveURL(new RegExp(ID));expect(api.calls).toEqual(['v03_prepare_manual_import','v03_commit_manual_import']);
});
test('unknown save result freezes input and retries the identical manual request',async({page})=>{
 const api=await backend(page);await page.goto('/');await api.login();const requests:Record<string,unknown>[]=[];
 await page.route('**/rest/v1/rpc/v03_prepare_manual_import',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(requests.length===1?{state:'pending'}:{state:'committed',collaboration_id:ID})});});
 await page.route('**/rest/v1/rpc/v03_commit_manual_import',route=>route.fulfill({status:400,contentType:'application/json',body:'{"message":"synthetic failure"}'}));
 await page.route('**/rest/v1/v03_imports*',route=>route.fulfill({status:400,contentType:'application/json',body:'{"message":"synthetic read failure"}'}));
 await manual(page);await page.getByLabel('협찬 이름',{exact:true}).fill('브랜드 A 캠페인');await page.getByRole('button',{name:'저장 전 요약 보기',exact:true}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'확인하고 실제 등록'}).dblclick();
 await expect(page.getByRole('alert')).toContainText('같은 요청');expect(requests).toHaveLength(1);await expect(page.getByRole('button',{name:'입력 수정',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'같은 요청으로 다시 저장',exact:true}).click();await expect(page).toHaveURL(new RegExp(ID));expect(requests[0]).toEqual(requests[1]);
});
test('editing original before save preserves entered manual fields and requires summary again',async({page})=>{
 await backend(page);await manual(page);await page.getByLabel('협찬 이름',{exact:true}).fill('유지할 이름');await page.getByRole('button',{name:'원본 수정',exact:true}).click();await page.getByLabel('브리프 텍스트',{exact:true}).fill('추가 원본');await page.getByRole('button',{name:'원본 미리보기',exact:false}).click();await page.getByRole('button',{name:'직접 입력하기',exact:false}).click();await expect(page.getByLabel('협찬 이름',{exact:true})).toHaveValue('유지할 이름');await page.getByRole('button',{name:'저장 전 요약 보기',exact:true}).click();await expect(page.getByRole('button',{name:'확인하고 실제 등록'})).toBeDisabled();
});
