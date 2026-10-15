// DP2-F-SE-02: Twinkey „Sonderstunden melden“ im Browser – Einsatz, Tag/Zeit, Kollegen mit eigenen Zeiten, Prüfen, Melden.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'tmp/twinkey-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('http://matrix.test/**',async route=>{try{await route.fulfill({body:await readFile(path.join(root,new URL(route.request().url()).pathname.slice(1))),contentType:route.request().url().endsWith('.svg')?'image/svg+xml':'image/webp'})}catch{await route.abort()}});
 await page.setContent('<html><head><base href="http://matrix.test/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="kcdpUxRoot"></div></body></html>');
 const html=await readFile(path.join(root,'index.html'),'utf8');for(const file of [...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g)].map(x=>x[1]).filter(x=>!x.startsWith('http')))await page.addStyleTag({content:await readFile(path.join(root,file),'utf8')});
 await page.evaluate(()=>{window.KCDP={twinkeyUseDeviceVoice:true,days:[{date:'2026-12-04',start:11,end:23,type:'market'},{date:'2026-12-05',start:11,end:23,type:'market'}],people:[{personId:'me',name:'Hans Beispiel',active:true,personType:'member'},{personId:'anna',name:'Anna Beispiel',active:true,personType:'member'},{personId:'bernd',name:'Bernd Beispiel',active:true,personType:'member'},{personId:'KC-P-LOCAL-01',name:'Aushilfe 1',active:true,personType:'helper'},{personId:'gast',name:'Gast Extern',active:true,personType:'external'}],currentUser:{personId:'me',displayName:'Hans Beispiel',role:'employee'},state:{wishPhase:'open'},workflow:{status:'draft'},wishes:[],shifts:[],actualShifts:[],eventConfig:{eventId:'KC-WM-2026',name:'Weihnachtsmarkt 2026'},memberUxData:{},persistAll:async()=>{window.persisted=(window.persisted||0)+1},requirementFor:()=>({total:2}),person(id){return this.people.find(p=>p.personId===id)}};Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},getVoices(){return[]},speak(){}}});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};});
 for(const file of ['src/core/wish-contract.js','src/core/auth.js','src/core/workflow.js','src/core/actual.js','src/core/special-events.js','src/core/hour-reports.js','src/core/special-event-signups.js','src/core/mobile-wish-matrix.js','src/ui/member-button-logic.js','src/ui/role-ux.js','src/ui/mobile-wish-matrix.js','src/ui/wish-assistant.js','src/ui/chef-companion.js','src/ui/twinkey.js'])await page.addScriptTag({content:await readFile(path.join(root,file),'utf8')});
 // Sondereinsätze wie vom Planer veröffentlicht: Kochen (fest, vergangen), Abholung (+2 Tage), Termin offen.
 await page.evaluate(()=>{const K=KCDP,d=n=>{const x=new Date();x.setDate(x.getDate()+n);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};K.testCook=d(-4);
  K.specialEvents=[{id:'SE-K',eventId:'KC-WM-2026',titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen',terminStatus:'FEST',datumVon:d(-4),datumBis:null,folgtAuf:null,abstandTage:null,wiederkehrend:null,aktiv:true,version:1},{id:'SE-A',eventId:'KC-WM-2026',titel:'Grünkohl abholen Dortmund → Tiefkühler Hamm',art:'transport',terminStatus:'OFFEN',folgtAuf:'SE-K',abstandTage:2,aktiv:true,version:1},{id:'SE-O',eventId:'KC-WM-2026',titel:'Grünkohl verteilen',art:'transport',terminStatus:'OFFEN',aktiv:true,version:1}];
  K.roleUx.showRoleHome()});
 await page.locator('[data-tw-mode=guided]').click();
 assert.equal(await page.locator('[data-tw-task=hours]').count(),1,'Neue Aufgabe sichtbar');
 await page.locator('[data-tw-task=hours]').click();
 // Schritt 1: Einsatz – offener Termin ist nicht wählbar.
 assert(await page.locator('[data-hr-event=SE-O]').isDisabled(),'Termin offen → nicht meldbar');
 assert.match(await page.locator('[data-hr-event=SE-O]').innerText(),/Termin noch offen/);
 assert(!(await page.locator('[data-hr-event=SE-K]').isDisabled()));
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Einsatz overflow '+width)}await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'Sonderstunden-1-Einsatz.png'),fullPage:true});
 await page.locator('[data-hr-event=SE-K]').click();
 // Schritt 2: Tag (fest vorgegeben), Zeit zuhause→zuhause, Tätigkeit Pflicht.
 assert.equal(await page.locator('#hrDate').inputValue(),await page.evaluate(()=>KCDP.testCook));
 assert.match(await page.locator('.chef-helper').innerText(),/zuhause losgefahren/);
 await page.selectOption('#hrStart','6.5');await page.selectOption('#hrEnd','16');await page.selectOption('#hrBreak','30');
 await page.locator('#hrNext').click();assert.match(await page.locator('#hrTimeStatus').innerText(),/was du gemacht hast/);
 await page.locator('[data-hr-act=kochen]').click();assert.equal(await page.locator('#hrRole').inputValue(),'keine');await page.selectOption('#hrRole','fahrer');
 await page.screenshot({path:path.join(out,'Sonderstunden-2-Zeit.png'),fullPage:true});
 await page.locator('#hrNext').click();
 // Schritt 3: Kollegen – Zeiten vorgeschlagen, einzeln änderbar.
 assert.match(await page.locator('#hrNext').innerText(),/Nur ich/);
 assert.equal(await page.locator('[data-hr-person]').count(),2,'Nur Mitglieder, keine Aushilfen/Externen');
 await page.locator('[data-hr-person=anna]').check();await page.locator('[data-hr-person=bernd]').check();
 assert.equal(await page.locator('[data-hr-row=anna] [data-hr-f=start]').inputValue(),'6.5','Eigene Zeit wird vorgeschlagen');
 await page.locator('[data-hr-row=bernd] [data-hr-f=start]').selectOption('12');await page.locator('[data-hr-row=bernd] [data-hr-f=end]').selectOption('25.5');
 assert.match(await page.locator('[data-hr-row=bernd]').innerText(),/01:30 \(\+1 Tag\)/);
 await page.locator('#hrSearch').fill('ann');assert(await page.locator('[data-hr-row=anna]').isVisible());
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Kollegen overflow '+width)}await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'Sonderstunden-3-Kollegen.png'),fullPage:true});
 await page.locator('#hrNext').click();
 // Schritt 4: Prüfen – alle Personen, Summe, Frist, Hinweis Erstattung.
 const review=await page.locator('.tw-root').innerText();
 assert.match(review,/Hans Beispiel[\s\S]*06:30–16:00 · Pause 30 Min\./);assert.match(review,/Anna Beispiel/);assert.match(review,/Bernd Beispiel[\s\S]*12:00–01:30 \(\+1 Tag\) · Pause 30 Min\. · 13,5 Stunden/);
 assert.match(review,/Meldefrist|verspätet|abgelaufen/);assert.match(review,/Erstattung/);assert.match(review,/Stundenkonto „Weihnachtsmarkt 2026“ gutgeschrieben/);assert.equal(await page.locator("#hrSend").innerText(),"✓ Gutschreiben lassen");
 assert.match(review,/Hans Beispiel[\s\S]*· Fahrer/);await page.locator('#hrNote').fill('Großer Topf');
 await page.screenshot({path:path.join(out,'Sonderstunden-4-Pruefen.png'),fullPage:true});
 await page.locator('#hrSend').click();
 // Schritt 5: gemeldet – drei Zeilen, gemeinsame Sammel-ID, Status gemeldet.
 await page.locator('#hrMine').waitFor();
 const rows=await page.evaluate(()=>KCDP.hourReports);
 assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.sammelId)).size,1);assert(rows.every(r=>r.status==='gemeldet'&&r.gemeldetVon==='me'&&r.bemerkung==='Großer Topf'));
 assert.equal(rows.find(r=>r.personId==='bernd').end,25.5);assert.equal(rows.find(r=>r.personId==='me').fahrtRolle,'fahrer');assert.equal(rows.find(r=>r.personId==='anna').fahrtRolle,'keine');assert(await page.evaluate(()=>window.persisted>=1));
 // Meine erfassten Zeiten zeigt die offene Meldung.
 await page.locator('#hrMine').click();assert.match(await page.locator('#twActualRows').innerText(),/Gemeldet, noch nicht bestätigt · Grünkohl kochen/);
 // Doppelte Meldung wird erkannt.
 await page.locator('#twTasks').click();await page.locator('[data-tw-task=hours]').click();await page.locator('[data-hr-event=SE-K]').click();await page.locator('[data-hr-act=kochen]').click();await page.locator('#hrNext').click();await page.locator('#hrNext').click();await page.locator('#hrSend').click();
 await page.locator('#hrMine').waitFor();assert.match(await page.locator('.tw-root').innerText(),/Schon vorher gemeldet[\s\S]*Hans Beispiel/);
 assert.equal(await page.evaluate(()=>KCDP.hourReports.length),3);
 // Zusage mit Anreise; Fahrgemeinschaft wird angezeigt; Fahrtrolle wird in der Meldung vorbelegt; Erstattungsknopf (Club App)
 await page.evaluate(()=>{KCDP.carpools=[{specialEventId:'SE-O',sourceId:'CP-bernd',fahrerId:'bernd',mitfahrer:['me'],startort:'Hamm',status:'published'}];});
 await page.locator('#twTasks').click();await page.locator('[data-tw-task=signup]').click();
 assert.equal(await page.locator('[data-su-event=SE-K]').count(),0,'Vergangene Einsätze nicht zur Zusage');
 await page.locator('[data-su-event=SE-O]').click();assert.match(await page.locator('.tw-root').innerText(),/Du fährst mit Bernd Beispiel ab Hamm/);
 await page.locator('[data-su-a=ja]').click();await page.locator('[data-su-t=mitfahrer]').click();await page.locator('#suSave').click();
 assert.match(await page.locator('#suStatus').innerText(),/Startort/);
 await page.selectOption('#suPlace','Hamm');await page.locator('#suSave').click();await page.locator('#suMore').waitFor();
 assert.deepEqual(await page.evaluate(()=>{const s=KCDP.specialEventSignupsCore.mine('SE-O');return [s.antwort,s.anreise,s.startort]}),['ja','mitfahrer','Hamm']);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Zusage overflow '+width)}await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'Sonderstunden-5-Zusage.png'),fullPage:true});
 await page.evaluate(()=>{window.erst=[];KCDP.hourReportsTransport={submit:async m=>({sammelId:'S',rows:m.eintraege.map((e,i)=>({id:'C'+i,personId:e.personId,date:m.date,start:e.start,end:e.end,specialEventId:m.specialEventId,status:'gemeldet',fahrtRolle:e.fahrtRolle,version:1})),skipped:[]}),openErstattung:x=>window.erst.push(x)};KCDP.specialEvents.find(e=>e.id==='SE-A').terminStatus='FEST';KCDP.specialEvents.find(e=>e.id==='SE-A').vorgesehen=['anna','me'];KCDP.specialEvents.find(e=>e.id==='SE-O').vorgesehen=['me'];});
 await page.locator('#twTasks').click();await page.locator('[data-tw-task=hours]').click();await page.locator('[data-hr-event=SE-A]').click();await page.locator('[data-hr-act=transport]').click();await page.locator('#hrNext').click();
 // Build 290: vom Planer vorgesehene Kollegen sind vorausgewählt und abwählbar
 assert(await page.locator('[data-hr-person=anna]').isChecked(),'Vorgesehene Kollegin vorausgewählt');assert(!(await page.locator('[data-hr-person=bernd]').isChecked()));assert.match(await page.locator('[data-hr-row=anna]').innerText(),/vorgesehen/);assert.match(await page.locator('.chef-helper').innerText(),/vorgesehenen Kollegen/);
 await page.locator('#hrNext').click();assert.match(await page.locator('.tw-root').innerText(),/Anna Beispiel/);await page.locator('#hrSend').click();
 await page.locator('#hrErst').click();const er=await page.evaluate(()=>window.erst[0]);assert.equal(er.specialEventId,'SE-A');assert.equal(er.titel,'Grünkohl abholen Dortmund → Tiefkühler Hamm');assert.equal(er.fahrer,false);
  await page.locator('#twTasks').click();await page.locator('[data-tw-task=signup]').click();assert.match(await page.locator('[data-su-event=SE-O]').innerText(),/Du bist vorgesehen/);
 assert.deepEqual(errors,[]);console.log('Twinkey Sonderstunden PASS: offener Termin gesperrt, Tag vorgegeben, Zeit zuhause→zuhause inkl. +1 Tag, Kollegen mit eigenen Zeiten, Prüfen, Melden, Status in Meine Zeiten, Doppelschutz, Fahrtrolle, Zusage mit Anreise/Startort, Fahrgemeinschaft, Erstattungsknopf, vorgesehene Kollegen vorausgewählt, 320–1280px.');
}finally{await browser.close()}
