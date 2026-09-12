import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:8774/twinkey-test.html?kc_update=226');
 await page.locator('[data-tw-mode=guided]').click();
 await page.locator('[data-tw-task=wish]').click();
 await page.locator('[data-tw-entry=manual]').click();
 assert.match(await page.locator('.sw-root h1').innerText(),/Wähle deinen Tag/);
 await page.locator('[data-day]').first().click();
 assert(await page.locator('#swTimeline').isVisible());
 await page.locator('#swEditDay').click();
 assert(await page.locator('.sw-root').isVisible());
 assert(await page.locator('#swDayBlock').isVisible());await page.locator('#swNext').click();assert(await page.locator('[data-list=can]').first().isVisible());assert(await page.locator('#swTeamToggle').isVisible());
 console.log('Real local Twinkey entry OK: direct selection, staffing overview, enabled Next on the served local page.');
}finally{await browser.close()}

