import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://comparison.test/**',r=>r.fulfill({contentType:'text/html',body:'<main id="mainView"><div class="person-row" data-person="A"><div class="timeline-cell"></div></div><div class="person-row" data-person="B"><div class="timeline-cell"></div></div></main>'}));
 async function boot(){await page.goto('https://comparison.test/');await page.evaluate(()=>{const K=window.KCDP={state:{layer:'planned',view:'day'},days:[{date:'2030-12-01',start:8,end:23}],shifts:[],wishes:[{id:'a',personId:'A',date:'2030-12-01',start:10,end:18,wishType:'available'},{id:'p',personId:'A',date:'2030-12-01',start:12,end:16,wishType:'preferred'},{id:'b',personId:'B',date:'2030-12-01',start:11,end:15,wishType:'preferred'}]};K.day=()=>K.days[0];window.before=JSON.stringify([K.wishes,K.shifts]);});await page.addScriptTag({content:await readFile('src/ui/wish-bar-composite.js','utf8')});await page.locator('#wishComparisonToggle').waitFor();}
 await boot();assert.equal(await page.locator('.plan-wish-guide').count(),0);
 await page.evaluate(()=>KCDP.wishBarComposite.comparisonItems('A')[0].action());await page.locator('[data-person="A"] .plan-wish-guide').waitFor();assert.equal(await page.locator('[data-person="B"] .plan-wish-guide').count(),0);
 await boot();await page.locator('[data-person="A"] .plan-wish-guide').waitFor();assert.equal(await page.locator('[data-person="B"] .plan-wish-guide').count(),0);
 await page.locator('#wishComparisonToggle').click();await page.waitForFunction(()=>!document.querySelector('.plan-wish-guide'));
 await page.locator('#wishComparisonToggle').click();await page.waitForFunction(()=>document.querySelectorAll('.plan-wish-guide').length===2);
 await page.evaluate(()=>KCDP.wishBarComposite.comparisonItems('A')[0].action());await page.waitForFunction(()=>!document.querySelector('[data-person="A"] .plan-wish-guide'));assert.equal(await page.locator('[data-person="B"] .plan-wish-guide').count(),1);
 await page.evaluate(()=>{KCDP.state.layer='wish';KCDP.wishBarComposite.decorate()});assert.equal(await page.locator('.plan-wish-guide').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify([KCDP.wishes,KCDP.shifts])===before),true);assert.deepEqual(errors,[]);
 const app=await readFile('src/ui/app.js','utf8');assert(app.includes('comparisonItems?.(s.personId)'));assert(app.includes('comparisonItems?.(p.personId)'));
 console.log('PASS wish comparison: default hidden, individual/all toggles, browser persistence, standalone wishes, layer isolation, no planning mutations.');
}finally{await browser.close();}
