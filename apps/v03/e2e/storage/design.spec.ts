import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {backend,fixture} from './detail-fixture';
import type {Collaboration} from '../../src/integrations/collaboration';
const shots='.tmp/design';
// Fictional portfolio content, browser-only mock transport; never a production autofill.
function portfolio():Collaboration{
 const row=fixture();row.title='오브제 · 가을의 루틴';row.status='producing';row.notes='아침 루틴을 담은 30초 릴스. 차분한 자연광으로 촬영하기.';
 row.v03_contents[0].title='가을 루틴 릴스';row.v03_contents[0].v03_tasks[0].due_date='2026-10-25';row.v03_contents[0].v03_tasks[1].due_date='2026-10-28';row.v03_contents[0].v03_tasks[2].title='제품과 함께하는 아침 장면 촬영';
 row.v03_sources[0].raw_text='[가상 협찬 가이드]\n자연광 아래 제품 사용 장면을 담아주세요.\n제품 가격은 썸네일에 표시하지 않습니다.';row.v03_sources[0].images=[];row.v03_sources[0].v03_reviews.forEach(r=>r.candidate.origin='manual');
 return row;
}
async function capture(page:import('@playwright/test').Page,name:string){await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});await page.screenshot({path:`${shots}/${name}.png`,fullPage:true});await page.screenshot({path:`${shots}/${name}-viewport.png`,fullPage:false});}
test('V02 design inheritance: mobile home, registration, preview, summary and detail portfolio evidence',async({page})=>{
 mkdirSync(shots,{recursive:true});await page.setViewportSize({width:390,height:844});const data=portfolio();
 const second=portfolio();second.id='88888888-8888-4888-8888-888888888888';second.title='데일리룸 · 주말의 기록';second.status='in_review';second.v03_contents[0].v03_tasks=[];
 const api=await backend(page,async()=>({status:200,body:[data]}),async()=>({status:200,body:[data,second]}));
 await page.goto('/#/');await page.getByText('V03 계정 · 로그인 필요',{exact:true}).click();await capture(page,'login-mobile');await page.getByText('V03 계정 · 로그인 필요',{exact:true}).click();await api.login();await page.getByText('V03 계정 · 로그인됨',{exact:true}).click();
 await expect(page.getByRole('region',{name:'진행 중인 협찬'})).toContainText(data.title);
 const logo=page.locator('.brand-logo img');await expect(logo).toHaveAttribute('src','/brand/itjima-wordmark-v8.svg');expect(await logo.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBe(593);
 await capture(page,'home-mobile');
 await page.getByRole('link',{name:`${data.title} 상세 보기`,exact:true}).click();await expect(page.getByRole('heading',{name:data.title,exact:true})).toBeVisible();await capture(page,'detail-mobile');
 for(const width of [320,360,390,430,1024]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await page.goto('/#/brief/new');await page.getByLabel('브리프 텍스트').fill(data.v03_sources[0].raw_text);await page.getByRole('button',{name:'원본 미리보기 →'}).click();await capture(page,'preview-mobile');await page.getByRole('button',{name:'직접 입력하기 →'}).click();
 await page.getByLabel('협찬 이름',{exact:true}).fill('오브제 · 가을의 루틴');await page.getByLabel('플랫폼 (선택)',{exact:true}).fill('Instagram Reels');await page.getByLabel('메모 (선택)',{exact:true}).fill('아침 루틴을 담은 30초 릴스. 차분한 자연광으로 촬영하기.');await page.getByLabel('가편 전달일 (선택 · 연도 포함)').fill('2026-10-25');await page.getByLabel('업로드 예정일 (선택 · 연도 포함)').fill('2026-10-28');
 await page.getByRole('button',{name:'할 일 추가',exact:true}).click();await page.getByLabel('할 일 1',{exact:true}).fill('제품과 함께하는 아침 장면 촬영');await page.getByRole('button',{name:'제작 조건 추가',exact:true}).click();await page.getByLabel('제작 조건 1',{exact:true}).fill('썸네일에 제품 가격 표시 금지');await capture(page,'manual-mobile');
 const inputStyle=await page.getByLabel('협찬 이름',{exact:true}).evaluate(el=>{const s=getComputedStyle(el);return{size:s.fontSize,radius:s.borderRadius,font:s.fontFamily};});expect(inputStyle.size).toBe('16px');expect(inputStyle.radius).toBe('14px');expect(inputStyle.font).toContain('Pretendard');
 await page.getByRole('button',{name:'저장 전 요약 보기',exact:true}).click();await expect(page.getByRole('button',{name:'확인하고 실제 등록'})).toBeDisabled();await capture(page,'summary-mobile');const confirm=page.getByRole('checkbox');expect(await confirm.evaluate(el=>el.getBoundingClientRect().width)).toBe(24);await confirm.check();await expect(page.getByRole('button',{name:'확인하고 실제 등록'})).toBeEnabled();
 expect(api.calls).toEqual([]); // Screenshots do not create any collaboration.
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.getByRole('button',{name:'확인하고 실제 등록'}).evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('1e-05s');
});
