// DP2-F-SE-03 Planer-Eingang: bestätigen → Ist (self_report) → Kontoauszug; ablehnen nur mit Grund; Sammelmeldung;
// abgeschlossener Istplan; Supabase zuerst (stale-Schutz); Doppelzeit-Warnung.
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
assert.equal(H.VERSION,'0.2.0');
assert.equal(K.currentUser.role,'planner','Der Planer entscheidet');
const [me,anna,bernd]=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);
const kochen=S.create({titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen',terminStatus:'FEST',datumVon:'2027-01-12'});
K.actualShifts=[{id:'TC-1',personId:bernd,date:'2027-01-12',start:14,end:18,breakMinutes:0,source:'timeclock',status:'recorded'}];

// Eingang aus der Club App (Supabase-IDs), Sammelmeldung mit drei Personen.
const uuid=n=>`00000000-0000-4000-8000-00000000000${n}`;
const remote=[me,anna,bernd].map((pid,i)=>({id:uuid(i+1),sammel_id:'11111111-1111-4111-8111-111111111111',event_id:'KC-WM-2026',special_event_id:kochen.id,special_event_title:'Grünkohl kochen',person_id:pid,gemeldet_von:me,work_date:'2027-01-12',start_h:[7,7,12][i],end_h:[15.5,13,25.5][i],break_minutes:[30,0,0][i],taetigkeit:'kochen',status:'gemeldet',verspaetet:i===2,version:1,source:'club_app'}));
const decided=[];let staleNext=false;
K.supabaseConnection={hourReportsPending:async()=>remote,hourReportDecide:async x=>{decided.push(x);if(staleNext){staleNext=false;return {ok:false,stale:true};}return {ok:true,version:2};}};
assert.equal((await H.pull()).received,3);
assert.equal(H.pending().length,3);
const g=H.groups();assert.equal(g.length,1,'Eine Sammelmeldung');assert.equal(g[0].rows.length,3);

// Warnungen: Bernd überschneidet sich mit der Stempeluhr, ist verspätet.
const wb=H.warnings(uuid(3));
assert.ok(wb.some(w=>w.code==='overlap'&&/Stempeluhr/.test(w.text)));assert.ok(wb.some(w=>w.code==='late'));
assert.equal(H.warnings(uuid(1)).length,0);

// Kontoauszug vor der Entscheidung: alles offen, nichts in der Summe.
let rows=P.buildRows(me,'2026-12-01','2027-01-31');
assert.equal(rows.find(r=>r.date==='2027-01-12').p,8.5-0,'Offen: 7–15:30 = 8,5 h (brutto)');assert.equal(rows.find(r=>r.date==='2027-01-12').i,0);

// Bestätigen: Supabase zuerst, dann Ist über den Ist-Kern.
const conf=await H.decide(uuid(1),{status:'bestaetigt'});
assert.equal(conf.status,'bestaetigt');assert.equal(decided[0].status,'bestaetigt');assert.equal(decided[0].actualId,conf.actualId);
const act=K.actualShifts.find(a=>a.id===conf.actualId);
assert.ok(act,'Ist-Zeit angelegt');assert.equal(act.source,'self_report');assert.equal(act.specialEventId,kochen.id);assert.equal(act.zone,'special');assert.match(act.area,/Z · Grünkohl kochen/);assert.equal(act.hourReportId,uuid(1));
rows=P.buildRows(me,'2026-12-01','2027-01-31');const day=rows.find(r=>r.date==='2027-01-12');
assert.equal(day.i,8.5);assert.equal(day.sp,8.5,'Zählt als Sondereinsatz');assert.equal(day.p,0,'Nicht mehr offen');
const html=P.buildHtml({personIds:[me],start:'2026-12-01',end:'2027-01-31',nameMode:'clear',onlyActivity:true,detail:'standard',header:'minimal',documentMode:'single'});
assert.match(html,/★ Grünkohl kochen/);assert.match(html,/Meldung/);
await assert.rejects(()=>H.decide(uuid(1),{status:'abgelehnt',reason:'x'}),/bereits entschieden/);

// Ablehnen nur mit Grund; Grund wird an Supabase gegeben.
await assert.rejects(()=>H.decide(uuid(2),{status:'abgelehnt'}),/Grund/);
const rej=await H.decide(uuid(2),{status:'abgelehnt',reason:'War an dem Tag nicht dabei'});
assert.equal(rej.status,'abgelehnt');assert.equal(decided.at(-1).reason,'War an dem Tag nicht dabei');
assert.ok(!K.actualShifts.some(a=>a.hourReportId===uuid(2)),'Abgelehnt → keine Ist-Zeit');
assert.equal(P.buildRows(anna,'2026-12-01','2027-01-31').find(r=>r.date==='2027-01-12'),undefined,'Abgelehnt erscheint nicht im Kontoauszug');

// Stale: anderswo schon entschieden → keine lokale Buchung.
staleNext=true;const before=K.actualShifts.length;
await assert.rejects(()=>H.decide(uuid(3),{status:'bestaetigt'}),/inzwischen anders bearbeitet/);
assert.equal(K.actualShifts.length,before,'Kein Mischstand bei stale');assert.equal(H.pending().length,1);

// Abgeschlossener Istplan sperrt; nach Wiederöffnen (vorhandener Ablauf) wird nachgebucht.
K.actualWorkflow={...K.actualWorkflow,status:'closed'};
assert.ok(H.warnings(uuid(3)).some(w=>w.code==='closed'));
await assert.rejects(()=>H.decide(uuid(3),{status:'bestaetigt'}),/abgeschlossen/);
K.currentUser={...K.currentUser,role:'admin'};K.actual.reopenPlan({reason:'Nachtrag Sonderstunden'});K.currentUser={...K.currentUser,role:'planner'};
const grp=await H.decideGroup('11111111-1111-4111-8111-111111111111',{status:'bestaetigt'});
assert.equal(grp.done.length,1);assert.equal(grp.failed.length,0);
assert.equal(P.buildRows(bernd,'2026-12-01','2027-01-31').find(r=>r.date==='2027-01-12').sp,13.5,'Nachtrag inkl. Ende nach Mitternacht');

// Lokale Meldung (ohne Supabase) wird ohne Fernaufruf entschieden.
const n=decided.length;K.currentUser={personId:anna,displayName:'Anna',role:'employee'};
const loc=await H.submit({specialEventId:kochen.id,date:'2027-01-12',taetigkeit:'aufraeumen',eintraege:[{personId:anna,start:16,end:18}]},{today:'2027-01-13'});
K.currentUser={personId:'planer',displayName:'Planer',role:'planner'};
await H.decide(loc.created[0].id,{status:'bestaetigt'});assert.equal(decided.length,n,'Kein Supabase-Aufruf für lokale Meldung');

// Rechte: Mitglieder dürfen nicht entscheiden.
K.currentUser={personId:anna,displayName:'Anna',role:'employee'};
await assert.rejects(()=>H.decide(uuid(3),{status:'bestaetigt'}),/nicht entscheiden|bereits entschieden/);
assert.ok(audit.some(a=>a.action==='hour_report.confirm')&&audit.some(a=>a.action==='hour_report.reject'));
// Phase 4: Getränke-Kollegin – geplanter Z-Dienst ohne Stempel = „Meldung ausstehend“, nach Bestätigung verknüpft.
K.currentUser={personId:'planer',displayName:'Planer',role:'planner'};
const geschenk=S.create({titel:'Getränke mischen zuhause + Anlieferung',art:'vorbereitung_zuhause',wiederkehrend:'markttage'});
const zDay=K.days.filter(d=>d.type==='market').map(d=>d.date).find(d=>!K.shifts.some(x=>x.personId===anna&&x.date===d&&x.layer==='planned'&&x.status!=='deleted'));assert.ok(zDay);
K.shifts.push({id:'Z-G1',personId:anna,date:zDay,start:9,end:12,zone:'special',area:'Z · Getränke zuhause',layer:'planned',status:'published',breakMinutes:0});
assert.ok(K.actual.reportPending(zDay).some(s=>s.id==='Z-G1'),'Z-Dienst ohne Ist → Meldung ausstehend');
let zr=P.buildRows(anna,zDay,zDay).find(r=>r.date===zDay);assert.equal(zr.missingBooking,false);assert.equal(zr.reportPending,true);
assert.match(P.buildHtml({personIds:[anna],start:zDay,end:zDay,nameMode:'clear',onlyActivity:true,detail:'standard',header:'minimal',documentMode:'single'}),/Meldung ausstehend/);
assert.ok(K.actual.dayStats(zDay).reportPending>=1);
K.hourReports.push({id:'HR-G1',sammelId:'SM-G',specialEventId:geschenk.id,specialEventTitle:geschenk.titel,personId:anna,gemeldetVon:anna,date:zDay,start:9,end:12.5,breakMinutes:0,taetigkeit:'getraenke',status:'gemeldet',source:'dp2',version:1});
const gz=await H.decide('HR-G1',{status:'bestaetigt'});const ga=K.actualShifts.find(a=>a.id===gz.actualId);
assert.equal(ga.linkedShiftId,'Z-G1','Meldung wird mit dem geplanten Z-Dienst verknüpft (Soll/Ist-Abgleich)');
assert.equal(K.actual.reportPending(zDay).some(s=>s.id==='Z-G1'),false);
zr=P.buildRows(anna,zDay,zDay).find(r=>r.date===zDay);assert.equal(zr.i,3.5);assert.equal(zr.sp,3.5);assert.equal(zr.reportPending,false);
console.log('✓ Sonderstunden-Eingang: bestätigen → Ist → Kontoauszug, ablehnen mit Grund, Sammelmeldung, stale, Nachtrag nach Wiederöffnen, Rechte');
