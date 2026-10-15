// DP2-F-SE-03: Sonderstunden-Eingang im Browser – abholen, Sammelmeldung, Warnungen, bestätigen, ablehnen mit Grund, alle bestätigen.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'tmp/twinkey-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
 for(const css of ['src/ui/app.css','src/ui/special-events.css'])await page.addStyleTag({content:await readFile(path.join(root,css),'utf8')});
 for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/planning.js','src/core/actual.js','src/core/special-events.js','src/core/hour-reports.js','src/core/special-event-signups.js','src/ui/special-events-ui.js','src/ui/hour-reports-ui.js'])await page.addScriptTag({content:await readFile(path.join(root,file),'utf8')});
 await page.evaluate(()=>{const K=KCDP;K.recordAudit=()=>{};K.sync={enqueue(){}};K.persistAll=async()=>{window.persisted=(window.persisted||0)+1};K.render=()=>{};
  const ids=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);window.ids=ids;
  const ev=K.specialEventsCore.create({titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen',terminStatus:'FEST',datumVon:'2027-01-12'});
  K.actualShifts=[{id:'TC-1',personId:ids[2],date:'2027-01-12',start:14,end:18,breakMinutes:0,source:'timeclock',status:'recorded'}];
  const u=n=>`00000000-0000-4000-8000-00000000000${n}`;window.decided=[];
  const rows=[0,1,2].map(i=>({id:u(i+1),sammel_id:'11111111-1111-4111-8111-111111111111',event_id:'KC-WM-2026',special_event_id:ev.id,special_event_title:'Grünkohl kochen',person_id:ids[i],gemeldet_von:ids[0],work_date:'2027-01-12',start_h:[7,7,12][i],end_h:[15.5,13,25.5][i],break_minutes:0,taetigkeit:'kochen',bemerkung:i?null:'Großer Topf',status:'gemeldet',verspaetet:i===2,version:1,source:'club_app'}));
  K.supabaseConnection={hourReportsPending:async()=>rows.filter(r=>!window.decided.some(d=>d.id===r.id)),hourReportDecide:async x=>{window.decided.push(x);return {ok:true,version:2}}};
  K.hourReportsUi.open();});
 await page.waitForFunction(()=>/3 offene Meldungen abgeholt/.test(document.getElementById('hrStatusLine')?.textContent||''));
 const text=await page.locator('#hrBody').innerText();
 assert.match(text,/Offen \(3\)/);assert.match(text,/Grünkohl kochen/);assert.match(text,/3 Personen · zusammen 28 h/);assert.match(text,/„Großer Topf“/);assert.match(text,/verspätet/);
 assert.match(text,/Überschneidet sich mit einer Istzeit 14:00–18:00 \(Stempeluhr\)/);assert.match(text,/01:30 \(\+1 Tag\)/);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width)}await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'Sonderstunden-Eingang-Planer.png'),fullPage:true});
 // Einzeln bestätigen
 await page.locator('[data-hr-ok="00000000-0000-4000-8000-000000000001"]').click();
 await page.waitForFunction(()=>/Bestätigt/.test(document.getElementById('hrStatusLine').textContent));
 assert.ok(await page.evaluate(()=>KCDP.actualShifts.some(a=>a.hourReportId==='00000000-0000-4000-8000-000000000001'&&a.source==='self_report')));
 // Ablehnen ohne Grund (Abbrechen) → nichts passiert; mit Grund → abgelehnt
 page.once('dialog',d=>d.dismiss());await page.locator('[data-hr-no="00000000-0000-4000-8000-000000000002"]').click();
 assert.equal(await page.evaluate(()=>KCDP.hourReports.find(r=>r.id==='00000000-0000-4000-8000-000000000002').status),'gemeldet');
 page.once('dialog',d=>d.accept('War nicht dabei'));await page.locator('[data-hr-no="00000000-0000-4000-8000-000000000002"]').click();
 await page.waitForFunction(()=>/Abgelehnt/.test(document.getElementById('hrStatusLine').textContent));
 // Rest der Sammelmeldung: Knopf „Alle bestätigen“ erscheint nur bei mehreren offenen – hier einzeln
 assert.equal(await page.locator('[data-hr-all]').count(),0);
 await page.locator('[data-hr-ok="00000000-0000-4000-8000-000000000003"]').click();
 await page.waitForFunction(()=>KCDP.hourReports.every(r=>r.status!=='gemeldet'));
 assert.match(await page.locator('#hrBody').innerText(),/Keine offenen Meldungen/);
 await page.locator('[data-hr-view=erledigt]').click();const done=await page.locator('#hrBody').innerText();
 assert.match(done,/bestätigt/);assert.match(done,/abgelehnt/);assert.match(done,/Grund: War nicht dabei/);
 const d=await page.evaluate(()=>window.decided.map(x=>x.status+':'+(x.reason||'')));assert.deepEqual(d,['bestaetigt:','abgelehnt:War nicht dabei','bestaetigt:']);
 // Sondereinsätze-Dialog führt zum Eingang
 await page.evaluate(()=>{KCDP.hourReportsUi.close();KCDP.specialEventsUi.open();});await page.locator('#seReports').click();await page.locator('#hrTitle').waitFor();
 // Zusagen & Fahrgemeinschaften im Planer-Dialog
 await page.evaluate(()=>{const K=KCDP,ev=K.specialEventsCore.list()[0];window.evId=ev.id;const ids=window.ids;
  K.specialEventSignups=[{specialEventId:ev.id,personId:ids[0],antwort:'ja',anreise:'fahrer',plaetze:1,startort:'Werne',version:1},{specialEventId:ev.id,personId:ids[1],antwort:'ja',anreise:'fahrer',plaetze:2,startort:'Hamm',version:1},{specialEventId:ev.id,personId:ids[2],antwort:'ja',anreise:'mitfahrer',startort:'Werne',version:1},{specialEventId:ev.id,personId:ids[3],antwort:'ja',anreise:'mitfahrer',startort:'Werne',version:1},{specialEventId:ev.id,personId:ids[4],antwort:'nein',version:1}];
  window.cp=[];K.supabaseConnection.publishCarpools=async x=>{window.cp.push(x);return {ok:true}};K.hourReportsUi.close();K.specialEventsUi.open();});
 assert.match(await page.locator('[data-se-signups]').first().innerText(),/Zusagen 4/);
 await page.locator('[data-se-signups]').first().click();
 assert.match(await page.locator('#seBody').innerText(),/4 ja · 0 vielleicht · 1 nein · 2 Fahrer mit 3 freien Plätzen · 2 brauchen eine Mitfahrt/);
 await page.locator('#seCpSuggest').click();
 const groups=await page.locator('#seBody').innerText();assert.match(groups,/1\/1 Plätze belegt/);assert.match(groups,/1\/2 Plätze belegt/);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fahrgemeinschaft overflow '+width)}await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'Fahrgemeinschaften-Planer.png'),fullPage:true});
 await page.locator('[data-cp-move]').first().selectOption('-1');assert.match(await page.locator('#seBody').innerText(),/Noch ohne Mitfahrgelegenheit/);
 await page.locator('#seCpSave').click();await page.waitForFunction(()=>window.cp.length===1);
 assert.equal(await page.evaluate(()=>window.cp[0].rows.length),2);assert.equal(await page.evaluate(()=>window.cp[0].rows.reduce((n,r)=>n+r.mitfahrer.length,0)),1);
 await page.locator('#seSuBack').click();assert.match(await page.locator('[data-se-signups]').first().innerText(),/🚗 2/);
 // Build 290: vorläufige Einteilung im Planer-Dialog – Auswahl aus Mitgliedern, Anzeige in der Liste
 await page.locator(`[data-se-edit="${await page.evaluate(()=>window.evId)}"]`).click();
 const pick=await page.evaluate(()=>window.ids.slice(0,2));for(const id of pick)await page.locator(`[data-se-person="${id}"]`).check();
 await page.locator('#seForm button[type=submit]').click();await page.waitForFunction(id=>(KCDP.specialEventsCore.get(id)?.vorgesehen||[]).length===2,await page.evaluate(()=>window.evId));
 assert.match(await page.locator('.se-planned').first().innerText(),/vorgesehen:/);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Einteilung overflow '+width)}await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'Sondereinsatz-vorgesehen.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Sonderstunden-Eingang PASS: abholen, Sammelmeldung mit Summe/Bemerkung/verspätet, Stempeluhr-Überschneidung, bestätigen → Ist, ablehnen nur mit Grund, Erledigt-Ansicht, Weg aus Sondereinsätzen, Zusagen-Übersicht, Fahrgemeinschafts-Vorschlag, Umsetzen, Veröffentlichen, vorläufige Einteilung, 320–1280px.');
}finally{await browser.close()}
