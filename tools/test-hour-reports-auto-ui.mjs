// Build 325 · DP2-F-SE-09 / KICC-F-112 im Browser: „⇩ abholen“ bucht Zeit aus Erstattungen automatisch, Reiter „Automatisch (Erstattung)“,
// ↩ Zurücknehmen nur mit Grund, Sondereinsatz „Ständig (jeder Tag)“ im Dialog, 320–1280 px ohne Überlauf.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'tmp/twinkey-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith('data:')||r.request().url()==='about:blank'?r.continue():r.abort());
try{
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
 for(const css of ['src/ui/app.css','src/ui/special-events.css'])await page.addStyleTag({content:await readFile(path.join(root,css),'utf8')});
 for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/planning.js','src/core/actual.js','src/core/special-events.js','src/core/hour-reports.js','src/core/special-event-signups.js','src/ui/special-events-ui.js','src/ui/hour-reports-ui.js'])await page.addScriptTag({content:await readFile(path.join(root,file),'utf8')});
 await page.evaluate(()=>{const K=KCDP;K.recordAudit=()=>{};K.sync={enqueue(){}};K.persistAll=async()=>{};K.render=()=>{};
  const ids=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);window.ids=ids;
  const ev=K.specialEventsCore.create({titel:'Besorgungen & Fahrten',art:'transport',wiederkehrend:'laufend'});
  const u=n=>`00000000-0000-4000-8000-00000000000${n}`;window.db=[0,1].map(i=>({id:u(i+1),sammel_id:u(i+5),event_id:'KC-WM-2026',special_event_id:ev.id,special_event_title:ev.titel,person_id:ids[i],gemeldet_von:ids[i],work_date:'2026-11-2'+i,start_h:14,end_h:15.5,break_minutes:0,taetigkeit:'transport',status:'bestaetigt',source:'erstattung',erstattung_id:u(i+8),actual_id:null,version:1}));
  window.storniert=[];
  K.supabaseConnection={hourReportsPending:async()=>[],
   hourReportsAuto:async()=>db.filter(r=>r.status==='bestaetigt'&&!r.actual_id).map(r=>({...r})),
   hourReportAutoAck:async({id,actualId})=>{const r=db.find(x=>x.id===id);r.actual_id=actualId;return {ok:true};},
   hourReportStorno:async({id,reason})=>{storniert.push({id,reason});const r=db.find(x=>x.id===id);r.status='abgelehnt';r.actual_id=null;return {ok:true};}};
  K.hourReportsUi.open();});
 await page.waitForFunction(()=>/Aus Erstattungen: 2 gebucht/.test(document.getElementById('hrStatusLine')?.textContent||''));
 assert.ok(await page.evaluate(()=>KCDP.actualShifts.filter(a=>a.source==='self_report'&&a.status!=='deleted').length===2),'zwei Ist-Zeiten automatisch');
 assert.match(await page.locator('#hrBody').innerText(),/Offen \(0\)/);
 await page.locator('[data-hr-view="automatisch"]').click();
 let text=await page.locator('#hrBody').innerText();
 assert.match(text,/Freigabe ist nicht nötig/);assert.match(text,/Besorgungen & Fahrten/);assert.match(text,/automatisch gebucht/);assert.equal((text.match(/Zurücknehmen/g)||[]).length,2);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width)}await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'Sonderstunden-Automatisch.png'),fullPage:true});
 // Abbrechen im Grund-Dialog ändert nichts; mit Grund → zurückgenommen.
 page.once('dialog',d=>d.dismiss());await page.locator('[data-hr-storno="00000000-0000-4000-8000-000000000001"]').click();
 assert.equal(await page.evaluate(()=>storniert.length),0);
 page.once('dialog',d=>d.accept('Fahrt war privat'));await page.locator('[data-hr-storno="00000000-0000-4000-8000-000000000001"]').click();
 await page.waitForFunction(()=>/Zurückgenommen/.test(document.getElementById('hrStatusLine').textContent));
 assert.equal(await page.evaluate(()=>JSON.stringify(storniert)),JSON.stringify([{id:'00000000-0000-4000-8000-000000000001',reason:'Fahrt war privat'}]));
 assert.ok(await page.evaluate(()=>!KCDP.actualShifts.some(a=>a.hourReportId==='00000000-0000-4000-8000-000000000001'&&a.status!=='deleted')));
 text=await page.locator('#hrBody').innerText();assert.equal((text.match(/Zurücknehmen/g)||[]).length,1);assert.match(text,/zurückgenommen/);
 // Sondereinsatz-Dialog: Modus „Ständig (jeder Tag)“
 await page.evaluate(()=>{KCDP.hourReportsUi.close();KCDP.specialEventsUi.open();});
 const list=await page.locator('body').innerText();assert.match(list,/ständig \(jeder Tag/);
 assert.ok(await page.locator('input[name="seMode"][value="laufend"]').count()>=1,'Modus „Ständig“ angeboten');
 assert.deepEqual(errors,[]);console.log('Zeit aus Erstattung PASS: automatisch gebucht beim Abholen, Reiter „Automatisch (Erstattung)“, Zurücknehmen nur mit Grund, Einsatz „Ständig“, 320–1280px.');
}finally{await browser.close()}
