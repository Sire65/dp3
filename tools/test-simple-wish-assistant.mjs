import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true,channel:'chrome'});
try{const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8774/twinkey-test.html?kc_update=224');
await page.locator('[data-tw-mode=guided]').click();await page.locator('[data-tw-task=wish]').click();
assert(await page.locator('.sw-root').isVisible());
await page.evaluate(()=>{KCDP.wishes=[];KCDP.simpleWishAssistant.open('2026-12-04')});
assert.equal(await page.locator('.sw-cards .sw-card').count(),3);
assert.equal(await page.locator('.as-overview').count(),0);
assert.equal(await page.locator('input[type=time]').count(),0);
await page.locator('.sw-card').first().click();
assert.match(await page.locator('.sw-root').innerText(),/Deine Auswahl/);
assert.equal(await page.locator('.sw-cards').count(),0);
await page.locator('#swOnly').check();assert.doesNotMatch(await page.locator('.mm-summary').innerText(),/Wunschzeit/);
await page.locator('#swOnly').uncheck();assert.equal(await page.locator('.mm-chip.preferred').count(),1);
assert.equal(await page.evaluate(()=>KCDP.wishes.length),0);
await page.locator('#swNext').click();await page.locator('#swNext').click();
assert.match(await page.locator('.sw-root').innerText(),/gespeichert/);
assert.equal(await page.evaluate(()=>KCDP.wishes.filter(w=>w.wishType==='preferred').length),1);
// Existing data remains visible; own entry and blocked time validation.
await page.evaluate(()=>{KCDP.wishes=[];KCDP.simpleWishAssistant.open('2026-12-04')});
await page.locator('#swOwn').click();await page.locator('#swFrom').fill('12:00');await page.locator('#swTo').fill('14:00');await page.locator('#swZone').selectOption('H');await page.locator('#swUseOwn').click();
assert.match(await page.locator('.mm-summary').innerText(),/12:00–14:00/);
await page.locator('#swNext').click();await page.locator('#swNext').click();
assert.equal(await page.evaluate(()=>KCDP.wishes.find(w=>w.wishType==='preferred').wishZone),'H');
await page.evaluate(()=>{KCDP.wishes=[];KCDP.simpleWishAssistant.open('2026-12-04')});
for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
await page.setViewportSize({width:390,height:844});await mkdir('tmp/simple-qa',{recursive:true});await page.screenshot({path:'tmp/simple-qa/auswahl-handy.png',fullPage:true});
await page.locator('.sw-card').first().click();await page.locator('.sw-extra summary').click();await page.locator('#swAdvanced').click();
assert(await page.locator('.wa-question h1').innerText().then(t=>t.includes('nicht kannst')));
assert.equal(await page.evaluate(()=>KCDP.wishes.length),0,'Advanced handoff never saves automatically');
await page.evaluate(()=>{KCDP.wishes=[{id:'block',personId:KCDP.currentUser.personId,date:'2026-12-04',start:12,end:14,wishType:'unavailable',wishZone:'B',scope:'time',status:'confirmed'}];KCDP.simpleWishAssistant.open('2026-12-04')});
await page.locator('#swOwn').click();await page.locator('#swFrom').fill('12:00');await page.locator('#swTo').fill('13:00');await page.locator('#swUseOwn').click();
assert.match(await page.locator('#swError').innerText(),/Sperre/);
assert.deepEqual(errors,[]);
console.log('Simple guided flow OK: three cards, quiet confirmation, can-only toggle, explicit save, custom times, preserved blocks, unsaved advanced handoff, 320–1280px.');
}finally{await browser.close()}

