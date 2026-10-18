import {test,expect} from '@playwright/test';
import {backend,ID} from './detail-fixture';
test('compact account menu supports keyboard dismissal and contains authentication outside main',async({page})=>{
 const api=await backend(page);await page.goto('/');
 await expect(page.locator('header .account-menu')).toBeVisible();await expect(page.locator('main .account-menu')).toHaveCount(0);
 await page.getByText('V03 계정 · 로그인 필요',{exact:true}).click();await page.getByLabel('이메일',{exact:true}).focus();await page.keyboard.press('Escape');await expect(page.getByLabel('이메일',{exact:true})).toBeHidden();
 await api.login();await page.getByText('V03 계정 · 로그인됨',{exact:true}).click();
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});
test('detail prioritizes reading, explicitly opens editors and cancel discards unsaved changes',async({page})=>{
 const api=await backend(page);await page.goto(`/#/collaborations/${ID}`);await api.login();
 await expect(page.getByRole('region',{name:'주요 일정'})).toBeVisible();
 await expect(page.getByLabel('협찬 상태 변경')).toHaveCount(0);await expect(page.getByLabel('가편 전달일 (연도 포함)',{exact:true})).toHaveCount(0);
 const labels=await page.locator('main h2').allTextContents();expect(labels.indexOf('주요 일정')).toBeLessThan(labels.indexOf('협찬 정보'));expect(labels.indexOf('원본 가이드')).toBeLessThan(labels.indexOf('협찬 정보'));
 await page.getByRole('button',{name:'상태 수정',exact:true}).click();await page.getByLabel('협찬 상태 변경').selectOption('completed');await page.getByRole('button',{name:'상태 수정 취소',exact:true}).click();await page.getByRole('button',{name:'상태 수정',exact:true}).click();await expect(page.getByLabel('협찬 상태 변경')).toHaveValue('producing');
 await page.getByRole('button',{name:'일정 수정',exact:true}).click();await page.getByLabel('가편 전달일 (연도 포함)',{exact:true}).fill('2026-12-25');await page.getByRole('button',{name:'일정 수정 취소',exact:true}).click();await page.getByRole('button',{name:'일정 수정',exact:true}).click();await expect(page.getByLabel('가편 전달일 (연도 포함)',{exact:true})).toHaveValue('2026-10-20');expect(api.calls).toEqual([]);
});
