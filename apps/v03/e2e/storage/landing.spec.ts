import {test,expect} from '@playwright/test';
import {backend,fixture,ID} from './detail-fixture';
test('public landing stays public, explains manual product and CTA opens legacy home',async({page})=>{
 const api=await backend(page);await page.goto('/');
 await expect(page.getByRole('heading',{name:'협찬의 다음 단계, 한곳에서.'})).toBeVisible();await expect(page.getByText('가상 데이터',{exact:true})).toBeVisible();await expect(page.getByText('직접 입력하고 확인하는 수동 등록 제품이에요.')).toBeVisible();expect(api.reads).toBe(0);
 for(const width of [320,390,430,1024]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.tmp/landing-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'협찬 관리 시작하기',exact:true}).first().click();await expect(page).toHaveURL(/#\/$/);await expect(page.getByText('위의 V03 계정에서 로그인하면 내 협찬과 할 일을 볼 수 있어요.')).toBeVisible();
 await page.getByRole('link',{name:'서비스 소개',exact:true}).click();await expect(page).toHaveURL(/#\/landing$/);
});
test('signed-in landing, home, detail reload and original import URLs remain compatible',async({page})=>{
 const data=fixture();const api=await backend(page);await page.goto('/');await api.login();expect(api.reads).toBe(0);
 await page.getByRole('link',{name:'내 협찬',exact:true}).click();await expect(page.getByRole('link',{name:`${data.title} 상세 보기`,exact:true})).toBeVisible();await page.getByRole('link',{name:'서비스 소개',exact:true}).click();await page.reload();await expect(page.getByText('가상 데이터',{exact:true})).toBeVisible();
 await page.goto(`/#/collaborations/${ID}`);await expect(page.getByRole('heading',{name:data.title,exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:data.title,exact:true})).toBeVisible();await page.getByRole('link',{name:'← 홈',exact:true}).click();await expect(page).toHaveURL(/#\/$/);
 await page.goto('/#/brief/new');await expect(page.getByLabel('브리프 텍스트')).toBeVisible();
});
