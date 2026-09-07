import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:8774/twinkey-test.html?kc_update=220');
 await page.locator('[data-tw-mode=guided]').click();
 await page.locator('[data-tw-task=wish]').click();
 assert.match(await page.locator('.wa-heading').innerText(),/Wähle deinen Tag/);
 await page.locator('[data-day]').first().click();
 assert(await page.locator('.sw-root').isVisible());
 await page.locator('#swCards').click();assert(await page.locator('.sw-cards .sw-card').count()<=3);
 await page.locator('.sw-card').first().click();if(await page.locator('#swConfirm').count())await page.locator('#swConfirm').click();assert(await page.locator('#swNext').isEnabled());
 console.log('Real local Twinkey entry OK: direct selection, staffing overview, enabled Next on the served local page.');
}finally{await browser.close()}

