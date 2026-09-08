import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({headless:true,channel:'chrome'});
try{const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8774/twinkey-test.html?kc_update=225');
await page.locator('[data-tw-mode=guided]').click();await page.locator('[data-tw-task=wish]').click();
const reset=async()=>page.evaluate(()=>{const K=KCDP;K.wishes=[];K.shifts=[];K.state.wishPhase='open';K.requirementFor=()=>({front:1,back:1,total:2});K.baseRequirementFor=K.requirementFor;K.simpleWishAssistant.open('2026-12-04');});
const fill=async(i,start,end)=>{await page.locator('[data-list=times][data-i="'+i+'"][data-field=start]').fill(start);await page.locator('[data-list=times][data-i="'+i+'"][data-field=end]').fill(end);};
await reset();await page.locator('#swDayBlock').check();
assert(await page.locator('fieldset input').first().isDisabled());assert(await page.locator('#swTimeBlock').isDisabled());
await page.locator('#swNext').click();await page.locator('#swNext').click();
assert.equal(await page.evaluate(()=>KCDP.wishes[0].scope),'day');
// Enter blocks first; overlap is visible and cannot advance.
await reset();await page.locator('#swTimeBlock').check();await page.locator('#swNext').click();assert.match(await page.locator('#swError').innerText(),/Sperrzeit/);
await page.locator('[data-list=blocks][data-field=start]').fill('14:00');await page.locator('[data-list=blocks][data-field=end]').fill('15:00');await page.locator('#swNext').click();
await fill(0,'13:00','16:00');assert.match(await page.locator('[data-time-error="0"]').innerText(),/14:00–15:00/);await page.locator('#swNext').click();assert.match(await page.locator('#swError').innerText(),/gesperrt/);
await fill(0,'12:00','14:00');await page.locator('[data-zone="0"]').selectOption('V');
await page.locator('#swAddTime').click();await fill(1,'16:00','18:00');await page.locator('[data-zone="1"]').selectOption('H');
// Planned person fills front. The second own time must remain through alternative choice.
await page.evaluate(()=>KCDP.shifts=[{id:'plan',personId:'TW-DEMO-2',date:'2026-12-04',start:12,end:14,zone:'front',layer:'planned',status:'published'}]);
await page.locator('#swNext').click();assert(await page.locator('#swKeep').isVisible());assert.equal(await page.locator('#swNext').count(),0);
await page.locator('#swTeamToggle').click();assert.match(await page.locator('#swTeam').innerText(),/Anna Beispiel.*geplant/s);
await page.locator('#swAlternatives').click();const alt=page.locator('[data-alt]').filter({hasText:'12:00–14:00 · Hinten'});assert.equal(await alt.count(),1);
await alt.click();assert.match(await page.locator('.sw-root').innerText(),/Hier fehlen/);
assert.equal(await page.evaluate(()=>KCDP.wishes.length),0);
await page.locator('#swNext').click();await page.locator('#swNext').click();
const saved=await page.evaluate(()=>KCDP.wishes);assert(saved.some(w=>w.wishType==='preferred'&&w.start===12&&w.end===14&&w.wishZone==='H'));assert(saved.some(w=>w.wishType==='preferred'&&w.start===16&&w.end===18));assert(saved.some(w=>w.wishType==='unavailable'&&w.start===14));
// Full time can be explicitly retained.
await reset();await page.locator('#swNext').click();await fill(0,'12:00','14:00');await page.locator('[data-zone="0"]').selectOption('V');
await page.evaluate(()=>KCDP.shifts=[{id:'plan',personId:'TW-DEMO-2',date:'2026-12-04',start:12,end:14,zone:'front',layer:'planned',status:'published'}]);
await page.locator('#swNext').click();await page.locator('#swKeep').click();await page.locator('#swNext').click();assert.equal(await page.evaluate(()=>KCDP.wishes.find(w=>w.wishType==='preferred').wishZone),'V');
// A new full slot appearing after review requires a new decision.
await reset();await page.locator('#swNext').click();await fill(0,'12:00','14:00');await page.locator('[data-zone="0"]').selectOption('V');await page.locator('#swNext').click();await page.locator('#swNext').click();
await page.evaluate(()=>KCDP.shifts=[{id:'late',personId:'TW-DEMO-2',date:'2026-12-04',start:12,end:14,zone:'front',layer:'planned',status:'published'}]);await page.locator('#swNext').click();assert(await page.locator('#swKeep').isVisible());assert.equal(await page.evaluate(()=>KCDP.wishes.length),0);
for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await mkdir('tmp/blocks-first-qa',{recursive:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/blocks-first-qa/besetzungspruefung.png',fullPage:true});
await reset();await page.locator('#swNext').click();await fill(0,'12:00','14:00');await page.screenshot({path:'tmp/blocks-first-qa/zeiten.png',fullPage:true});
await page.evaluate(()=>KCDP.state.wishPhase='closed');await page.locator('#swNext').click();assert.match(await page.locator('#swError').innerText(),/geändert/);
assert.deepEqual(errors,[]);
console.log('Blocks-first flow OK: day lock, invalid blocks, overlap warning, two times, named planned staffing, direct alternative replacement, keep-full consent, stale coverage consent, phase lock, 320–1280px.');
}finally{await browser.close()}

