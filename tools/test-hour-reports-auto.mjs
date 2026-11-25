// Build 325 · DP2-F-SE-09 / KICC-F-112: Zeit aus der Erstattung (Club App) – ohne Freigabe automatisch als Ist buchen,
// bei abgelehntem Antrag automatisch ausbuchen, Planer-Rücknahme nur mit Grund (Supabase zuerst), idempotent, Ständiger Einsatz „laufend“.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const document={readyState:'complete',write:()=>{},addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,body:{}};
class MutationObserver{observe(){}}
const context=vm.createContext({window:{},document,MutationObserver,console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/planning.js','src/core/actual.js','src/core/special-events.js','src/core/hour-reports.js','src/ui/person-account-print.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,S=K.specialEventsCore,H=K.hourReportsCore,P=K.personAccountPrint;
const audit=[];K.recordAudit=(a,m)=>audit.push({action:a,...m});K.sync={enqueue:()=>{}};K.persistAll=async()=>true;
assert.equal(H.VERSION,'0.4.0');
assert.equal(K.currentUser.role,'planner');
const [me,anna]=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);

// Ständiger Einsatz: jeder vergangene Tag zählt, Termin gilt als fest.
const bf=S.create({titel:'Besorgungen & Fahrten',art:'transport',wiederkehrend:'laufend'});
assert.equal(bf.wiederkehrend,'laufend');assert.equal(bf.effective.terminStatus,'FEST');assert.equal(bf.effective.dates.length,0);
assert.ok(H.reportableEvents('2026-11-24').find(e=>e.id===bf.id).reportable,'laufend ist meldbar');
assert.equal(H.validate({specialEventId:bf.id,date:'2026-11-20',taetigkeit:'transport',eintraege:[{personId:me,start:14,end:15.5}]},{today:'2026-11-24'}).length,0);
assert.equal(S.publishRows().find(r=>r.sourceId===bf.id).wiederkehrend,'laufend');

// Supabase-Nachbildung: kc_dp_hour_reports_auto / _auto_ack / _storno
const uuid=n=>`00000000-0000-4000-8000-0000000000${String(n).padStart(2,'0')}`;
const db=[
  {id:uuid(1),sammel_id:uuid(91),event_id:'KC-WM-2026',special_event_id:bf.id,special_event_title:'Besorgungen & Fahrten',person_id:me,gemeldet_von:me,work_date:'2026-11-20',start_h:14,end_h:15.5,break_minutes:0,taetigkeit:'transport',status:'bestaetigt',source:'erstattung',erstattung_id:uuid(81),actual_id:null,version:1},
  {id:uuid(2),sammel_id:uuid(92),event_id:'KC-WM-2026',special_event_id:bf.id,special_event_title:'Besorgungen & Fahrten',person_id:anna,gemeldet_von:anna,work_date:'2026-11-21',start_h:9,end_h:11,break_minutes:0,taetigkeit:'einkauf',status:'bestaetigt',source:'erstattung',erstattung_id:uuid(82),actual_id:null,version:1},
  {id:uuid(3),sammel_id:uuid(93),event_id:'KC-WM-2026',special_event_id:bf.id,special_event_title:'Besorgungen & Fahrten',person_id:'UNBEKANNT',gemeldet_von:'UNBEKANNT',work_date:'2026-11-21',start_h:9,end_h:10,break_minutes:0,taetigkeit:'einkauf',status:'bestaetigt',source:'erstattung',erstattung_id:uuid(83),actual_id:null,version:1}];
const calls=[];let failAck=false;
const auto=()=>db.filter(r=>(r.status==='bestaetigt'&&!r.actual_id)||(['zurueckgezogen','abgelehnt'].includes(r.status)&&r.actual_id)).map(r=>({...r}));
K.supabaseConnection={
  hourReportsPending:async()=>[],
  hourReportsAuto:async()=>{calls.push('auto');return auto();},
  hourReportAutoAck:async({id,actualId})=>{calls.push(['ack',id,actualId]);if(failAck)throw new Error('offline');const r=db.find(x=>x.id===id);
    if(actualId&&r.status==='bestaetigt'&&!r.actual_id){r.actual_id=actualId;r.version++;return {ok:true};}
    if(!actualId&&['zurueckgezogen','abgelehnt'].includes(r.status)&&r.actual_id){r.actual_id=null;r.version++;return {ok:true};}return {ok:false,stale:true};},
  hourReportStorno:async({id,reason})=>{calls.push(['storno',id,reason]);const r=db.find(x=>x.id===id);if(r.status!=='bestaetigt')return {ok:false};Object.assign(r,{status:'abgelehnt',ablehngrund:reason,actual_id:null});r.version++;return {ok:true};}};

// 1. Automatisch buchen – ohne Klick, unbekannte Person wartet (kein Fehler für die anderen).
let res=await H.autoSync();
assert.equal(res.received,3);assert.equal(res.booked,2);assert.equal(res.waiting.length,1);assert.match(res.waiting[0].grund,/nicht als aktive Person/);
const a1=K.actualShifts.find(a=>a.hourReportId===uuid(1)&&a.status!=='deleted');
assert.ok(a1,'Ist angelegt');assert.equal(a1.source,'self_report');assert.equal(a1.erstattungId,uuid(81));assert.match(a1.area,/Besorgungen & Fahrten/);
assert.equal(db[0].actual_id,a1.id,'quittiert');
let day=P.buildRows(me,'2026-11-01','2026-11-30').find(r=>r.date==='2026-11-20');
assert.equal(day.i,1.5);assert.equal(day.sp,1.5,'zählt als Sondereinsatz im Kontoauszug');assert.equal(day.p,0,'nicht „offen“');
assert.equal(H.pending().length,0,'nichts zu bestätigen');
assert.equal(H.groups({status:'automatisch'}).length,3);
assert.ok(audit.some(a=>a.action==='hour_report.auto_sync'));

// 2. Idempotent: zweiter Lauf bucht nichts doppelt.
res=await H.autoSync();
assert.equal(res.booked,0);assert.equal(K.actualShifts.filter(a=>a.hourReportId===uuid(1)&&a.status!=='deleted').length,1);

// 3. Quittung fällt aus → nächster Lauf quittiert nur, keine zweite Ist-Zeit.
db.push({...db[0],id:uuid(4),person_id:me,work_date:'2026-11-22',erstattung_id:uuid(84),actual_id:null,version:1});
failAck=true;res=await H.autoSync();assert.equal(res.booked,0);assert.equal(res.waiting.length,2);
failAck=false;res=await H.autoSync();assert.equal(res.booked,1);
assert.equal(K.actualShifts.filter(a=>a.hourReportId===uuid(4)&&a.status!=='deleted').length,1);
assert.ok(db[3].actual_id);

// 4. Kassenwart lehnt den Antrag ab (Club-Server setzt 'zurueckgezogen') → automatisch ausgebucht.
db[1].status='zurueckgezogen';db[1].version++;
res=await H.autoSync();assert.equal(res.unbooked,1);
assert.ok(!K.actualShifts.some(a=>a.hourReportId===uuid(2)&&a.status!=='deleted'),'Ist zurückgenommen');
assert.equal(db[1].actual_id,null);
assert.equal(P.buildRows(anna,'2026-11-01','2026-11-30').find(r=>r.date==='2026-11-21')?.i||0,0,'nicht mehr im Konto');
assert.ok(audit.some(a=>a.action==='actual.self_report.retire'));

// 5. Planer nimmt zurück: Grund Pflicht, Supabase zuerst, dann lokal.
await assert.rejects(()=>H.storno(uuid(1),{reason:' '}),/Grund/);
await assert.rejects(()=>H.storno(uuid(2),{reason:'x'}),/nur bei automatisch gebuchter/);
const st=await H.storno(uuid(1),{reason:'Fahrt war privat'});
assert.equal(st.status,'abgelehnt');assert.equal(st.ablehngrund,'Fahrt war privat');assert.equal(JSON.stringify(calls.filter(c=>c[0]==='storno').at(-1)),JSON.stringify(['storno',uuid(1),'Fahrt war privat']));
assert.ok(!K.actualShifts.some(a=>a.hourReportId===uuid(1)&&a.status!=='deleted'));
assert.equal(db[0].status,'abgelehnt');
res=await H.autoSync();assert.equal(res.booked+res.unbooked,0,'nach Storno nichts mehr zu tun');

// 6. Abgeschlossener Istplan: Buchung wartet, nichts geht verloren.
db.push({...db[0],id:uuid(5),status:'bestaetigt',ablehngrund:null,work_date:'2026-11-23',erstattung_id:uuid(85),actual_id:null,version:1});
K.actualWorkflow={...K.actualWorkflow,status:'closed'};
res=await H.autoSync();assert.equal(res.booked,0);assert.ok(res.waiting.some(w=>w.id===uuid(5)&&/abgeschlossen/.test(w.grund)));
assert.equal(db[4].actual_id,null);

// 7. Rechte: Mitglieder buchen nichts automatisch und nehmen nichts zurück.
K.currentUser={personId:anna,displayName:'Anna',role:'employee'};
assert.equal((await H.autoSync()).skipped,true);
await assert.rejects(()=>H.storno(uuid(4),{reason:'x'}),/nicht zurücknehmen|dürfen/);

// 8. Bisheriger Weg unverändert: Club-App-Meldung bleibt offen und braucht Bestätigung.
K.currentUser={personId:'planer',displayName:'Planer',role:'planner'};
H.merge([H.fromRemote({id:uuid(6),sammel_id:uuid(96),event_id:'KC-WM-2026',special_event_id:bf.id,person_id:me,gemeldet_von:me,work_date:'2026-11-19',start_h:8,end_h:9,break_minutes:0,taetigkeit:'kochen',status:'gemeldet',source:'club_app',version:1})]);
assert.equal(H.pending().length,1);
console.log('✓ Zeit aus Erstattung: automatisch gebucht, idempotent, Ablehnung bucht aus, Planer-Rücknahme mit Grund, Istplan zu → wartet, Rechte, alter Weg unverändert, Einsatz „ständig“');
