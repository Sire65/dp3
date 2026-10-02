import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'tmp/button-logic-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/*',r=>r.abort());await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="kcdpUxRoot"></div></body></html>');
 const html=await readFile(path.join(root,'index.html'),'utf8');for(const file of [...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g)].map(x=>x[1]).filter(x=>!x.startsWith('http')))await page.addStyleTag({content:await readFile(path.join(root,file),'utf8')});
 for(const file of ['core/model','core/wish-contract','core/planning','core/auth','core/workflow','core/actual','core/configuration','core/mobile-wish-matrix','ui/member-button-logic','ui/role-ux','ui/mobile-wish-matrix','ui/wish-assistant','ui/chef-companion','ui/twinkey','ui/assistant-staffing','ui/assistant-hours','ui/simple-wish-assistant'])await page.addScriptTag({content:await readFile(path.join(root,'src/'+file+'.js'),'utf8')});
 await page.evaluate(()=>{const K=KCDP;K.days=K.days.filter(d=>['2026-12-04','2026-12-05'].includes(d.date));K.wishes=[];K.shifts=[];K.actualShifts=[];K.planSharing=[];K.memberUxData={};K.currentUser={personId:K.people[0].personId,displayName:K.people[0].name,role:'employee'};K.persistAll=async()=>{};K.latestPublishedVersion=()=>K.testPublished||null;K.requirementFor=()=>({total:20,front:10,back:10});K.personalizedForms={downloadPdf:async()=>{},downloadExcel:async()=>{}};K.personAccountPrint={open(){}};K.twinkey.start();});
 const disabled=async(selector)=>assert(await page.locator(selector).isDisabled(),selector+' must be disabled');
 const enabled=async(selector)=>assert(await page.locator(selector).isEnabled(),selector+' must be enabled');
 await disabled('#twNext');assert.match(await page.locator('#twNext').innerText(),/Bitte zuerst eine Aufgabe wählen/);
 for(const key of ['plan','change','actual'])await disabled('[data-tw-task='+key+']');await enabled('[data-tw-task=wish]');
 await page.locator('[data-tw-task=documents]').click();await disabled('#twDocAccount');for(const id of ['twDocMatrix','twDocExcel','twDocWriting'])await enabled('#'+id);await page.locator('#twTasks').click();
 await page.locator('[data-tw-task=wish]').click();await page.locator('#twShareContinue').click();await disabled('[data-tw-entry=overview]');await disabled('[data-tw-entry=colleague]');await enabled('[data-tw-entry=manual]');
 await page.locator('[data-tw-entry=manual]').click();assert.match(await page.locator('#swProgress').innerText(),/0 von \d+ Tagen fertig/);await enabled('#swNextOpen');await page.locator('[data-day="2026-12-04"]').click();assert.equal((await page.locator('#swEditDay').innerText()).trim(),'Diesen Tag eintragen');await page.locator('#swEditDay').click();
 // A started but incomplete block cannot advance or spawn another empty block.
 await page.locator('#swTimeBlock').check();await disabled('#swNext');await disabled('#swAddBlock');await page.locator('#swTimeBlock').uncheck();await enabled('#swNext');await page.locator('#swNext').click();
 // Build 256: no prefilled availability – a bare „Weiter“ never reports a whole day.
 await disabled('#swNext');await disabled('#swAddTime');assert.equal(await page.locator('[data-list=can][data-field=start]').inputValue(),'');await enabled('#swWholeDay');
 // Full-day availability leaves no second availability or standby window.
 await page.locator('[data-list=can][data-field=start]').selectOption('11');await disabled('#swNext');await page.locator('[data-list=can][data-field=end]').selectOption('23');await enabled('#swNext');await page.locator('#swNext').click();
 // Build 256: the wish step needs an explicit choice before „Weiter“.
 await disabled('#swNext');await page.locator('#swNone').click();await disabled('#swYesStandby');await disabled('#swNext');await page.locator('#swNoStandby').click();await page.locator('#swNext').click();await page.locator('#swNext').click();await page.waitForSelector('#swFinish');
 assert.ok(await page.locator('#swNextDay').isVisible(),'next open day offered');assert.match(await page.locator('#swProgress').innerText(),/1 von \d+ Tagen fertig/);
 let asked='';page.once('dialog',d=>{asked=d.message();d.accept();});await page.locator('#swFinish').click();await page.locator('#swOverview').click();assert.match(asked,/ohne fertige Angabe/);assert.match(await page.locator('.sw-hours').innerText(),/Kann-Zeit/);await page.locator('#swLeave').click();await enabled('#uxOwnList');
 // Read-only pages retain viewing for saved data, but never enable empty days.
 await page.evaluate(()=>{KCDP.state.wishPhase='closed';KCDP.roleUx.openTimes();});await enabled('#uxOwnList');await page.locator('#uxOwnList').click();await enabled('[data-mm-day="2026-12-04"]');await disabled('[data-mm-day="2026-12-05"]');
 await page.evaluate(()=>{const K=KCDP;K.state.wishPhase='open';K.workflow.status='published';K.twinkey.tasks();});await disabled('[data-tw-task=wish]');
 // Deleted or other people's records do not enable personal views. Only published own services do.
 await page.evaluate(()=>{const K=KCDP;K.workflow.status='draft';K.actualShifts=[{personId:K.people[1].personId,date:'2026-12-04',status:'recorded'}];K.testPublished={shifts:[{id:'deleted',personId:K.currentUser.personId,date:'2026-12-04',status:'deleted'}]};K.twinkey.tasks();});await disabled('[data-tw-task=plan]');await disabled('[data-tw-task=actual]');
 await page.evaluate(()=>{const K=KCDP,s={id:'S1',personId:K.currentUser.personId,date:'2026-12-04',start:11,end:17,status:'published'};K.shifts=[s];K.testPublished={shifts:[s]};K.actualShifts=[{...s,id:'A1',status:'recorded'}];K.twinkey.tasks();});for(const key of ['plan','change','actual'])await enabled('[data-tw-task='+key+']');
 await page.evaluate(()=>{KCDP.swapRequests=[{shiftId:'S1',status:'open'}];KCDP.twinkey.tasks();});await disabled('[data-tw-task=change]');await enabled('[data-tw-task=plan]');
 // Direct matrix: empty save, invalid intervals, final day, copy without data/consent.
 await page.evaluate(()=>KCDP.mobileMatrixUi.entry('2026-12-05'));await disabled('#mmSave');await disabled('#mmSaveNext');await page.locator('[data-add=available]').click();await disabled('#mmSave');await page.locator('[data-field=start]').selectOption('12');await page.locator('[data-field=end]').selectOption('11');await disabled('#mmSave');await page.locator('[data-field=end]').selectOption('17');await enabled('#mmSave');await disabled('#mmSaveNext');await page.locator('#mmSave').click();
 await page.evaluate(()=>{const K=KCDP;K.wishes=[];K.actualShifts=[];K.testPublished=null;K.shifts=[];K.memberUxData={};K.roleUx.employeeHome();});await disabled('#uxMyPlan');await enabled('#uxStartTimes');await page.locator('#uxStartTimes').click();await page.locator('#twShareContinue').click();await disabled('#uxOwnList');
 await page.evaluate(()=>KCDP.mobileMatrixUi.search());await page.locator('#mmSearchResults [data-friend]').first().waitFor();assert(await page.locator('#mmSearchResults [data-friend]').first().isDisabled());
 await page.evaluate(()=>{const K=KCDP,p=K.people[1];K.wishes=[{id:'friend',personId:p.personId,date:'2026-12-04',start:12,end:16,wishType:'available',scope:'time',status:'confirmed'}];K.planSharing=['can','wish'].map(plan_kind=>({person_id:p.personId,plan_kind,allow_view:true,allow_copy:true}));K.mobileMatrixUi.search();});await page.locator('#mmSearchDay').selectOption('2026-12-04');await page.waitForFunction(()=>document.querySelector('#mmSearchResults [data-friend]:not(:disabled)'));await page.locator('#mmSearchResults [data-friend]:not(:disabled)').click();await enabled('#mmCopyApply');await page.locator('[data-copy-id]').uncheck();await disabled('#mmCopyApply');
 await page.evaluate(()=>KCDP.twinkey.tasks());for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);assert(await page.locator('[data-tw-task=wish]').evaluate(e=>e.getBoundingClientRect().height>=44));await page.screenshot({path:path.join(out,'start-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);console.log('Member button logic PASS: empty/populated/closed/published/deleted/other-person data, complete guided save and overview, blocked intervals/standby, direct matrix, final day, copy permissions/selection, 320–1280px.');
}finally{await browser.close();}
