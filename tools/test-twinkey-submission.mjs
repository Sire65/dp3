// Build 258: no readiness on a full blocked day; completion needs a real transport acknowledgement.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/*',r=>r.abort());await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="kcdpUxRoot"></div></body></html>');
 const html=await readFile(path.join(root,'index.html'),'utf8');for(const f of [...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g)].map(x=>x[1]).filter(x=>!x.startsWith('http')))await page.addStyleTag({content:await readFile(path.join(root,f),'utf8')});
 for(const f of ['core/model','core/wish-contract','core/planning','core/auth','core/workflow','core/actual','core/configuration','core/mobile-wish-matrix','ui/member-button-logic','ui/role-ux','ui/mobile-wish-matrix','ui/wish-assistant','ui/chef-companion','ui/twinkey','ui/assistant-staffing','ui/assistant-hours','ui/simple-wish-assistant'])await page.addScriptTag({content:await readFile(path.join(root,'src/'+f+'.js'),'utf8')});
 await page.evaluate(()=>{
  const K=KCDP,me=K.people[0].personId;K.days=K.days.filter(d=>d.date==='2026-12-10');K.wishes=[{id:'old',personId:me,date:'2026-12-10',start:21,end:23,wishType:'available',wishZone:'B',status:'confirmed'}];K.wishes.push({id:'old-block',personId:me,date:'2026-12-10',start:13,end:14,wishType:'unavailable',scope:'time',wishZone:'B',status:'confirmed'});K.shifts=[];K.actualShifts=[];K.planSharing=[];K.memberUxData={assistantStandby:{[me]:{'2026-12-10':{answer:'yes',slots:[{start:14,end:21}]}}}};K.currentUser={personId:me,role:'employee'};K.persistAll=async()=>true;K.latestPublishedVersion=()=>null;K.requirementFor=()=>({total:20,front:10,back:10});K.simpleWishAssistant.open('2026-12-10');
 });
 // Partial block retains readiness (the Steven example); it must not turn into a full-day restriction.
 await page.click('#swNoBlock');await page.click('#swNext');await page.click('#swNone');await page.click('#swNext');await page.click('#swNext');await page.waitForSelector('#swFinish');
 assert.deepEqual(await page.evaluate(()=>KCDP.memberUxData.assistantStandby[KCDP.currentUser.personId]['2026-12-10'].slots),[{start:14,end:21}]);
 assert.equal(await page.locator('#swSendMessage').count(),0,'day save must not announce dispatch');
 await page.evaluate(()=>KCDP.simpleWishAssistant.open('2026-12-10'));await page.check('#swDayBlock');assert.match(await page.locator('.sw-root').innerText(),/Bereitschaft für diesen Tag wurde entfernt/);await page.click('#swNext');assert.equal(await page.locator('#swNoStandby').count(),0);assert.match(await page.locator('.sw-root').innerText(),/Bereitschaft für diesen Tag wurde entfernt/);await page.click('#swNext');await page.waitForSelector('#swFinish');
 assert.deepEqual(await page.evaluate(()=>KCDP.memberUxData.assistantStandby[KCDP.currentUser.personId]['2026-12-10']),{answer:'no',slots:[]});
 assert.deepEqual(await page.evaluate(()=>KCDP.mobileWishMatrix.rows(KCDP.currentUser.personId).map(w=>[w.wishType,w.scope,w.assistantDay.standby])),[['unavailable','day',{answer:'no',slots:[]}]]);
 const before=await page.evaluate(()=>JSON.stringify(KCDP.wishes));
 // The Club connector's rejected promise must stay on the completion page and allow retry.
 await page.click('#swFinish');await page.locator('#swLeave').waitFor();assert.equal(await page.locator('#swSendMessage').count(),0);await page.click('#swOverview');assert.doesNotMatch(await page.locator('.sw-hours article').innerText(),/Bereitschaft/);
 await page.evaluate(()=>{window.KC_CLUB_DW_API=()=>{};KCDP.persistAll=async()=>{throw Error('offline');};});await page.click('#swLeave');await page.locator('#swSendError').waitFor();assert.equal(await page.locator('#swSendMessage').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(KCDP.wishes)),before);assert.equal(await page.locator('#swSendError').innerText(),'Deine Dienstzeiten konnten gerade nicht verschickt werden. Bitte prüfe die Internetverbindung und tippe noch einmal auf ‚Fertig‘.');
 await page.evaluate(()=>KCDP.persistAll=async()=>undefined);await page.click('#swLeave');await page.locator('#swSendError').waitFor();assert.equal(await page.locator('#swSendMessage').count(),0,'local saving is not an acknowledgement');
 await page.evaluate(()=>{KCDP.sendCalls=0;KCDP.persistAll=()=>{KCDP.sendCalls++;return new Promise(resolve=>KCDP.resolveSend=resolve);};});await page.click('#swLeave');assert(await page.locator('#swLeave').isDisabled());assert.equal(await page.locator('#swSendMessage').count(),0);await page.evaluate(()=>KCDP.resolveSend(true));await page.locator('#swSendOk').waitFor();assert.equal(await page.locator('#swSendMessage').innerText(),'Deine Dienstzeiten wurden erfolgreich verschickt.');await page.keyboard.press('Escape');assert(await page.locator('#swSendOk').isVisible());
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('#swSendOk').evaluate(e=>e.getBoundingClientRect().height>=44));}
 await page.click('#swSendOk');await page.locator('#uxOwnList').waitFor();assert.equal(await page.locator('#swLeave').count(),0,'OK leaves the assistant');assert.equal(await page.evaluate(()=>KCDP.sendCalls),1);
 // Standalone DP2 cannot report success while the sync queue has failures or unresolved entries.
 await page.evaluate(()=>{delete window.KC_CLUB_DW_API;KCDP.persistAll=async()=>{};KCDP.wishes.find(w=>w.status!=='deleted').comment='changed';KCDP.sync={healthCheck:async()=>({ok:true}),flush:async()=>({failed:1,pending:1}),snapshot:()=>({outbox:[{status:'pending'}],conflicts:[]})};KCDP.simpleWishAssistant.open('2026-12-10');});await page.click('#swNext');await page.click('#swNext');await page.click('#swFinish');await page.click('#swLeave');await page.locator('#swSendError').waitFor();assert.equal(await page.locator('#swSendMessage').count(),0);
 await page.evaluate(()=>{KCDP.sync.flush=async()=>({failed:0,pending:0,conflicts:0});KCDP.sync.snapshot=()=>({outbox:[],conflicts:[]});});await page.click('#swLeave');await page.locator('#swSendOk').waitFor();await page.click('#swSendOk');
 // Legacy contradictory day data are hidden on load, rejected by raw validation and repaired on save.
 await page.evaluate(()=>{const K=KCDP,me=K.currentUser.personId,w=K.mobileWishMatrix.rows(me)[0];w.assistantDay.standby={answer:'yes',slots:[{start:14,end:21}]};K.memberUxData.assistantStandby[me]['2026-12-10']={answer:'yes',slots:[{start:14,end:21}]};K.simpleWishAssistant.start();});
 assert.equal(await page.evaluate(()=>KCDP.simpleWishAssistant.standbyEnabled(KCDP.days[0])),false);
 assert.equal(await page.evaluate(()=>KCDP.assistantHours.calculate(KCDP.currentUser.personId).totals.standby),0);
 await page.click('[data-day="2026-12-10"]');await page.locator('#swDayTimeline summary').click();assert.equal(await page.locator('.sw-timeline-row').filter({hasText:/^Bereitschaft/}).count(),0);
 await page.click('#swEditDay');assert.match(await page.locator('.sw-root').innerText(),/Am Sperrtag ist keine Bereitschaft möglich/);
 assert(await page.evaluate(()=>KCDP.mobileWishMatrix.validate(KCDP.mobileWishMatrix.rows(KCDP.currentUser.personId)).some(x=>x.includes('keine Bereitschaft'))));
 await page.evaluate(async()=>{const K=KCDP,me=K.currentUser.personId,list=JSON.parse(JSON.stringify(K.mobileWishMatrix.rows(me)));await K.mobileWishMatrix.save(me,['2026-12-10'],list,JSON.stringify(K.mobileWishMatrix.rows(me)),{reviewedDemand:true});});
 assert.deepEqual(await page.evaluate(()=>KCDP.mobileWishMatrix.rows(KCDP.currentUser.personId)[0].assistantDay.standby),{answer:'no',slots:[]});
 assert.deepEqual(await page.evaluate(()=>KCDP.memberUxData.assistantStandby[KCDP.currentUser.personId]['2026-12-10']),{answer:'no',slots:[]});
 assert.deepEqual(errors,[]);
 console.log('Twinkey submission PASS: partial block/readiness retained, full block clears both stores with warning, day save silent, actual ACK only, failure/retry without loss, busy guard, persistent OK dialog, standalone pending queue, 320–1280px.');
}finally{await browser.close();}
