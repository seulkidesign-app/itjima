import {test,expect} from '@playwright/test';
import {backend,fixture,ID,PNG,USER} from './detail-fixture';
test('mobile preview, explicit append, reload and private guide reading preserve operating data',async({page})=>{
 const data=fixture(),before=JSON.stringify({...data,v03_sources:[]});
 const api=await backend(page,async()=>({status:200,body:[data]}));
 let prepared:any,commits=0;
 await page.route('**/rest/v1/rpc/v03_prepare_guide_import',async route=>{prepared=route.request().postDataJSON();expect(Object.keys(prepared.p_payload)).toEqual(['mode','confirmed','collaboration_id','source']);expect(prepared.p_payload.confirmed).toBe(true);await route.fulfill({json:{state:'pending'}});});
 await page.route('**/rest/v1/rpc/v03_commit_guide_import',async route=>{commits++;data.v03_sources.push({id:'followup',import_id:prepared.p_id,guide_order:1,registered_at:'2026-10-16T03:00:00Z',raw_text:prepared.p_payload.source.raw_text,images:prepared.p_payload.source.images.map((i:any)=>({...i,path:`${USER}/${prepared.p_id}/${i.id}`})),v03_reviews:[]});await route.fulfill({json:'followup'});});
 await page.goto(`/#/collaborations/${ID}`);await api.login();
 await page.getByRole('button',{name:'후속 가이드 추가',exact:true}).click();
 await expect(page.getByRole('button',{name:'원본 미리보기 →'})).toBeDisabled();
 await page.getByLabel('브리프 텍스트').fill('합성 후속 가이드');await page.getByLabel('이미지 선택',{exact:true}).setInputFiles({name:'followup.png',mimeType:'image/png',buffer:PNG});
 await expect(page.getByAltText('선택한 스크린샷 1')).toBeVisible();
 await page.getByRole('button',{name:'원본 미리보기 →'}).click();await expect(page.getByAltText('원본 스크린샷 1: followup.png')).toBeVisible();
 await expect(page.getByRole('button',{name:'가이드 추가 저장',exact:true})).toBeDisabled();
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'가이드 추가 저장',exact:true}).click();
 await expect(page.getByText('후속 가이드 1 · 원본 2 · 이미지 1장',{exact:true})).toBeVisible();expect(commits).toBe(1);expect(JSON.stringify({...data,v03_sources:[]})).toBe(before);
 await page.reload();await page.getByText('후속 가이드 1 · 원본 2 · 이미지 1장',{exact:true}).click();
 const followup=page.locator('details').filter({hasText:'후속 가이드 1'});await expect(followup.getByText('합성 후속 가이드',{exact:true})).toBeVisible();await expect(followup.locator('time')).toHaveAttribute('datetime','2026-10-16T03:00:00Z');await followup.getByRole('button',{name:'원본 이미지 보기',exact:true}).click();await expect(followup.getByAltText('원본 가이드: followup.png')).toBeVisible();
 await expect(page.getByText('합성 원본 가이드입니다.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('unknown outcome freezes payload and retries same UUID without deleting images',async({page})=>{
 const api=await backend(page);let ids:string[]=[],n=0;
 await page.route('**/rest/v1/rpc/v03_prepare_guide_import',async route=>{ids.push(route.request().postDataJSON().p_id);await route.fulfill({json:n?{state:'committed',source_id:'saved'}:{state:'pending'}});});
 await page.route('**/rest/v1/rpc/v03_commit_guide_import',async route=>{n++;await route.fulfill({status:400,json:{message:'lost'}});});await page.route('**/rest/v1/v03_imports?*',route=>route.fulfill({status:400,json:{message:'offline'}}));
 await page.goto(`/#/collaborations/${ID}`);await api.login();await page.getByRole('button',{name:'후속 가이드 추가',exact:true}).click();await page.getByLabel('브리프 텍스트').fill('합성 재시도');await page.getByRole('button',{name:'원본 미리보기 →'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'가이드 추가 저장',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'저장 결과 확인'})).toBeVisible();await expect(page.getByRole('button',{name:'입력으로 돌아가기'})).toBeDisabled();await page.getByRole('button',{name:'같은 요청으로 다시 추가 확인'}).click();await expect(page.getByRole('button',{name:'후속 가이드 추가',exact:true})).toBeVisible();expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
});
test('pending append blocks duplicates and ignores late response after logout',async({page})=>{
 const api=await backend(page);let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let commits=0;
 await page.route('**/rest/v1/rpc/v03_prepare_guide_import',route=>route.fulfill({json:{state:'pending'}}));
 await page.route('**/rest/v1/rpc/v03_commit_guide_import',async route=>{commits++;await gate;await route.fulfill({json:'saved'});});
 await page.goto(`/#/collaborations/${ID}`);await api.login();await page.getByRole('button',{name:'후속 가이드 추가',exact:true}).click();await page.getByLabel('브리프 텍스트').fill('합성 늦은 응답');await page.getByRole('button',{name:'원본 미리보기 →'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'가이드 추가 저장',exact:true}).click();await expect(page.getByRole('button',{name:'추가 중…',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'추가 취소',exact:true})).toBeDisabled();await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByText('협찬을 보려면 위의 V03 계정에서 로그인해주세요.',{exact:true})).toBeVisible();release();await expect(page.getByRole('heading',{name:'협찬을 확인해주세요'})).toBeVisible();expect(commits).toBe(1);await expect(page.getByRole('region',{name:'후속 가이드 추가',exact:true})).toHaveCount(0);
});
test('definite server validation rejection allows correcting input without losing original',async({page})=>{
 const api=await backend(page);await page.route('**/rest/v1/rpc/v03_prepare_guide_import',route=>route.fulfill({status:400,json:{code:'P0001',message:'invalid_guide'}}));await page.goto(`/#/collaborations/${ID}`);await api.login();await page.getByRole('button',{name:'후속 가이드 추가',exact:true}).click();await page.getByLabel('브리프 텍스트').fill('합성 거부');await page.getByRole('button',{name:'원본 미리보기 →'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'가이드 추가 저장',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'저장 준비가 거부'})).toBeVisible();await page.getByRole('button',{name:'입력으로 돌아가기'}).click();await expect(page.getByLabel('브리프 텍스트')).toHaveValue('합성 거부');await page.getByRole('button',{name:'추가 취소'}).click();await expect(page.getByText('합성 원본 가이드입니다.',{exact:true})).toBeVisible();
});
