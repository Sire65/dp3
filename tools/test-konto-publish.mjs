// Build 326 · DP2-F-KONTO-01 / KICC-F-113 Phase 2: Kontoauszug-Zeilen je Person für „Mein Stundenkonto“ der Club App.
// Gleiche Zählung wie der Kontoauszug (K.personAccountPrint.counted), Art (Stand/Sonder/Erstattung), gelöschte Ist-Zeiten fehlen,
// nur bei Änderung veröffentlichen, nur Planungsrollen, Abschluss je Tag, Prüfsumme stabil.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const document={readyState:'complete',write:()=>{},addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,body:{}};
class MutationObserver{observe(){}}
const context=vm.createContext({window:{},document,MutationObserver,console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/planning.js','src/core/actual.js','src/core/special-events.js','src/core/hour-reports.js','src/ui/person-account-print.js','src/core/konto-publish.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,KP=K.kontoPublish,P=K.personAccountPrint;
K.recordAudit=()=>{};K.sync={enqueue:()=>{}};K.persistAll=async()=>true;
assert.equal(KP.VERSION,'0.1.0');assert.equal(typeof P.counted,'function');assert.equal(typeof P.active,'function');
const [anna,bernd]=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);
K.hourReports=[{id:'HR-E1',source:'erstattung',status:'bestaetigt'},{id:'HR-S1',source:'club_app',status:'bestaetigt'}];
K.actualShifts=[
  {id:'A-1',personId:anna,date:'2026-12-04',start:11,end:17.5,breakMinutes:30,source:'timeclock',area:'Stand vorne',status:'recorded'},
  {id:'A-SE-1',personId:anna,date:'2026-11-20',start:14,end:15.5,source:'self_report',zone:'special',area:'Z · Besorgungen & Fahrten',specialEventId:'SE-BF',specialEventTitle:'Besorgungen & Fahrten',hourReportId:'HR-E1',taetigkeit:'transport',status:'recorded'},
  {id:'A-SE-2',personId:bernd,date:'2026-11-10',start:7,end:15.5,source:'self_report',zone:'special',specialEventId:'SE-GK',specialEventTitle:'Grünkohl kochen',hourReportId:'HR-S1',taetigkeit:'kochen',status:'recorded'},
  {id:'A-2',personId:bernd,date:'2026-12-05',start:15,end:23,source:'manual_correction',correctedAt:'2026-12-06T08:00:00Z',status:'recorded'},
  {id:'A-3',personId:bernd,date:'2026-12-06',start:15,end:23,source:'timeclock',status:'deleted'}];
let r=KP.rows();
assert.equal(JSON.stringify(r.map(x=>x.entry_key).sort()),JSON.stringify(['A-1','A-2','A-SE-1','A-SE-2']),'gelöschte Ist-Zeit fehlt');
const z=k=>r.find(x=>x.entry_key===k);
assert.equal(z('A-1').art,'stand');assert.equal(z('A-1').anlass,'Dienst am Stand');assert.equal(z('A-1').taetigkeit,'Stand vorne');
assert.equal(z('A-1').minutes,Math.round(P.counted(K.actualShifts[0])*60),'gleiche Zählung wie der Kontoauszug');
assert.equal(z('A-SE-1').art,'erstattung');assert.equal(z('A-SE-1').anlass,'Besorgungen & Fahrten');assert.equal(z('A-SE-1').hour_report_id,'HR-E1');assert.equal(z('A-SE-1').minutes,90);
assert.equal(z('A-SE-2').art,'sonder');assert.equal(z('A-SE-2').anlass,'Grünkohl kochen');assert.equal(z('A-SE-2').taetigkeit,'Kochen');
assert.equal(z('A-2').korrigiert,true);assert.equal(z('A-1').korrigiert,false);
assert.ok(r.every(x=>/^[0-9a-f]{8}$/.test(x.checksum)));
assert.equal(JSON.stringify(KP.rows()),JSON.stringify(r),'stabil: gleiche Daten → gleiche Zeilen und Prüfsummen');
// Summe je Person = Kontoauszug „Ist geprüft“
const sumKonto=pid=>P.buildRows(pid,'2026-11-01','2026-12-31').reduce((n,x)=>n+x.i,0);
for(const pid of [anna,bernd])assert.equal(r.filter(x=>x.person_id===pid).reduce((n,x)=>n+x.minutes,0),Math.round(sumKonto(pid)*60),'Summe wie im Kontoauszug');
// Abschluss je Tag
K.daysPublishBridge={istStatusFor:d=>({istStatus:d<='2026-12-04'?'closed':'open'}),planningMembership:async()=>({role:'planner'})};
r=KP.rows();assert.equal(z('A-1').abgeschlossen,true);assert.equal(z('A-2').abgeschlossen,false);

// Veröffentlichen: nur Planer, nur bei Änderung, Fehler sichtbar
const gesendet=[];K.supabaseConnection={publishKonto:async x=>{gesendet.push(x);return {ok:true,geschrieben:x.rows.length,entfernt:0};}};
K.currentUser={personId:anna,role:'employee'};
assert.equal((await KP.publishNow()).reason,'role');assert.equal(gesendet.length,0);
K.currentUser={personId:'planer',role:'planner'};
let res=await KP.publishNow();assert.equal(res.ok,true);assert.equal(gesendet.length,1);assert.equal(gesendet[0].eventId,K.eventConfig?.eventId||'KC-WM-2026');assert.equal(gesendet[0].rows.length,4);
assert.equal((await KP.publishNow()).reason,'unchanged','unverändert → keine Server-Anfrage');assert.equal(gesendet.length,1);
assert.equal((await KP.poll()).reason,'interval');
K.actualShifts[0].end=18;res=await KP.publishNow();assert.equal(res.ok,true);assert.equal(gesendet.length,2,'Änderung → neu veröffentlicht');
K.daysPublishBridge.planningMembership=async()=>null;K.actualShifts[0].end=18.5;
assert.equal((await KP.publishNow()).reason,'role','ohne aktive Planungsrolle in Supabase nichts senden');
K.daysPublishBridge.planningMembership=async()=>({role:'planner'});
K.supabaseConnection.publishKonto=async()=>({ok:false});
await assert.rejects(()=>KP.publishNow(),/nicht bestätigt/);assert.match(KP.state.lastError,/nicht bestätigt/);
console.log('✓ Kontoauszug veröffentlichen: gleiche Zählung wie der Kontoauszug, Art Stand/Sonder/Erstattung, gelöschte fehlen, Abschluss je Tag, nur Planer, nur bei Änderung');
