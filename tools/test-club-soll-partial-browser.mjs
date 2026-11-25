import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setContent('<main id="mainView"></main><div id="modalBackdrop" class="hidden"><div id="modal"></div></div>');
 await page.addStyleTag({content:'.hidden{display:none}#modalBackdrop{background:white;padding:12px}.transfer-list div{padding:8px}button{padding:12px}'});
 await page.evaluate(()=>{
  const ids=['KC-P-TESTA','KC-P-TESTB','KC-P-TESTC'];window.testIds=ids;window.limit=6;window.acks=[];
  const K=window.KCDP={VERSION:'test',state:{layer:'planned'},v020ShellState:{active:'planned'},eventConfig:{eventId:'TEST'},days:[{date:'2026-12-04'},{date:'2026-12-05'}],people:ids.map((personId,i)=>({personId,name:'Testperson '+(i+1),active:true})),shifts:[],standby:[],actualShifts:[],swapRequests:[],auditLog:[],memberUxData:{},auth:{has:()=>true,require(){}},daysPublishBridge:{planningMembership:async()=>true},persistAll:async()=>({confirmed:true})};
  K.person=id=>K.people.find(p=>p.personId===id);K.validateShift=c=>c.personId===ids[0]&&c.end-c.start>window.limit?[{level:'error',text:'Persönliche Höchstzeit: maximal 6 Std.'}]:[];
  K.mutations={saveShift(c,{existingId}={}){const old=K.shifts.find(s=>s.id===existingId);if(old)Object.assign(old,c);else K.shifts.push({...c,id:'TEST-'+(K.shifts.length+1)});},deleteShift(id){K.shifts.find(s=>s.id===id).status='deleted';}};
  K.supabaseConnection={hasAccessToken:()=>true,sollInboxPending:async()=>structuredClone(window.pending||{}),sollInboxAck:async r=>{window.acks.push(r);window.pending=null;return {ok:true};}};
  window.row=(personId,date,start,end)=>({personId,date,start,end,zone:'neutral',area:'Test',breakMinutes:0,importKey:`CLUB-${date}-${personId}`});
  window.stand=(id,rows)=>({id,eventId:'TEST',pruefsumme:id,rows});
 });
 await page.addScriptTag({content:await readFile('src/core/club-soll-inbox.js','utf8')});
 await page.evaluate(async()=>{pending=stand('FIRST',[row(testIds[0],'2026-12-04',18,23),row(testIds[1],'2026-12-05',12,16)]);await KCDP.clubSollInbox.check({force:true});await KCDP.clubSollInbox.apply({});acks=[];pending=stand('PARTIAL',[row(testIds[0],'2026-12-04',16,23),row(testIds[2],'2026-12-05',16,20)]);await KCDP.clubSollInbox.check({force:true});KCDP.clubSollInbox.preview();});
 await page.locator('#csApply').click();await page.waitForFunction(()=>KCDP.clubSollInbox.state.lastResult?.complete===false);
 assert.match(await page.locator('#clubSollResult').innerText(),/Nur teilweise/);assert.match(await page.locator('#clubSollHint').innerText(),/2 noch nicht übernommen/);
 assert.equal(await page.locator('#csApply').innerText(),'Offene Einträge neu prüfen');assert(await page.locator('#csApply').isVisible());
 assert.deepEqual(await page.evaluate(()=>({acks:acks.length,pending:pending.id,active:KCDP.shifts.filter(s=>s.status!=='deleted').length})),{acks:0,pending:'PARTIAL',active:3});
 await page.evaluate(async()=>{KCDP.clubSollInbox.store().lastApplied={id:'PARTIAL'};await KCDP.clubSollInbox.check({force:true});});assert.equal(await page.evaluate(()=>acks.length),0,'kein Auto-Ack bei offenen Fehlern');
 await page.locator('#csApply').click();assert.match(await page.locator('#modal').innerText(),/maximal 6 Std/);
 await page.evaluate(async()=>{limit=8;await KCDP.clubSollInbox.check({force:true});KCDP.clubSollInbox.preview();});await page.locator('#csApply').click();await page.waitForFunction(()=>KCDP.clubSollInbox.state.lastResult?.complete===true);
 assert.equal(await page.evaluate(()=>acks.length),1);assert.equal(await page.evaluate(()=>pending),null);assert(await page.locator('#csApply').isHidden());assert.deepEqual(errors,[]);
 console.log('PASS partial import browser: warning/remaining counter, visible retry, protected deletion, no partial or legacy auto-ack, complete retry without duplicates.');
}finally{await browser.close();}
