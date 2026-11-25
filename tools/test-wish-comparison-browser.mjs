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

 // Exercise the actual app context menus together with the legacy transfer module.
 const appSource=await readFile('src/ui/app.js','utf8');
 await page.evaluate(()=>{const K=KCDP;K.auth={has:()=>false,canEditWish:()=>false};K.person=id=>({personId:id,name:'Test '+id});K.shifts=[];window.dialogs=[];window.confirm=msg=>{dialogs.push(msg);return false};document.body.insertAdjacentHTML('beforeend','<div id="contextMenu" class="hidden"></div>');document.querySelectorAll('.person-row').forEach(row=>{row.insertAdjacentHTML('afterbegin','<div class="person-cell" data-person="'+row.dataset.person+'">Test '+row.dataset.person+'</div>');const c=row.querySelector('.timeline-cell');c.dataset.timelinePerson=row.dataset.person;c.style.cssText='width:900px;height:70px;position:relative'});});
 await page.addStyleTag({content:'.hidden{display:none}#contextMenu{position:fixed;z-index:100;background:white}#contextMenu button{display:block} .person-cell{height:30px}'});
 const contextSource=appSource.slice(appSource.indexOf('function openContext('),appSource.indexOf('function settingsTabsHtml('));
 const bindingStart=appSource.indexOf('function bindPlannerEvents('),bindingEnd=appSource.indexOf('\nfunction ',bindingStart+1);
 await page.addScriptTag({content:'const K=window.KCDP,$=id=>document.getElementById(id),day=()=>K.day(),fmtTime=String,snapTime=x=>x;function quickPlanPointerDown(){} function shiftPointerDown(){};'+contextSource+'\n'+appSource.slice(bindingStart,bindingEnd)+'\nbindPlannerEvents();'});
 await page.addScriptTag({content:await readFile('src/ui/plan-transfer.js','utf8')});
 await page.locator('[data-person="A"] > .person-cell').click({button:'right'});
 await page.getByRole('button',{name:'Wunschvergleich für diese Person einblenden',exact:true}).click();await page.locator('[data-person="A"] .plan-wish-guide').waitFor();
 await page.locator('[data-person="A"] .plan-wish-guide').click({button:'right'});
 await page.getByRole('button',{name:'Wunschvergleich für diese Person ausblenden',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-person="A"] .plan-wish-guide'));
 await page.locator('[data-person="A"] .timeline-cell').click({button:'right',position:{x:10,y:10}});
 await page.getByRole('button',{name:'Wunschvergleich für gesamten Plan einblenden',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.plan-wish-guide').length===2);
 await page.locator('[data-person="B"] .plan-wish-guide').click({button:'right'});await page.getByRole('button',{name:'Wunschvergleich überall ausblenden',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.plan-wish-guide'));
 assert.deepEqual(await page.evaluate(()=>dialogs),[],'right-click never requests Soll-to-Ist transfer');
 await page.evaluate(()=>{KCDP.state.layer='wish';KCDP.wishBarComposite.decorate()});assert.equal(await page.locator('.plan-wish-guide').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify([KCDP.wishes,KCDP.shifts])===before),true);assert.deepEqual(errors,[]);
 const app=await readFile('src/ui/app.js','utf8');assert(app.includes('comparisonItems?.(s.personId)'));assert(app.includes('comparisonItems?.(p.personId)'));
 console.log('PASS wish comparison: default hidden, individual/all toggles, browser persistence, standalone wishes, layer isolation, no planning mutations.');
}finally{await browser.close();}
