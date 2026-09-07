import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:8774/twinkey-test.html?kc_update=220');
 await page.locator('[data-tw-mode=guided]').click();
 await page.locator('[data-tw-task=wish]').click();
 assert.match(await page.locator('.wa-heading').innerText(),/Trage deine Zeiten wie gewohnt ein/);
 await page.locator('[data-wa-day]').first().click();
 assert.match(await page.locator('#waCurrentSummary').innerText(),/Besetzung auf einen Blick/);
 assert.equal(await page.locator('#waDemandLive details').count(),0);
 assert(await page.locator('.as-overview').isVisible());
 await page.locator('[data-choice=status][data-value=yes]').click();
 assert(await page.locator('[data-slot-key=can]').first().isVisible());
 assert(await page.locator('#waNext').isEnabled());
 console.log('Real local Twinkey entry OK: direct selection, staffing overview, enabled Next on the served local page.');
}finally{await browser.close()}

