// DP2-F-SE-02 Stundenmeldungen: Sammelmeldung mit Stunden je Kollege, Regeln, Doppelschutz, Frist, Transport, Abholen.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const context=vm.createContext({window:{},document:{readyState:'complete',write:()=>{}},console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/special-events.js','src/core/hour-reports.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,S=K.specialEventsCore,H=K.hourReportsCore;
const audit=[];K.recordAudit=(action,meta)=>audit.push({action,...meta});K.sync={enqueue:()=>{}};
let persisted=0;K.persistAll=async()=>{persisted++;return true;};
const members=K.people.filter(p=>p.active&&p.personType==='member');
const [me,anna,bernd]=members.map(p=>p.personId);
assert.equal(H.VERSION,'0.3.0');
const today='2027-01-20';

// Einsätze: Kochen fest am 12.01., Abholung +2 Tage, ein offener Einsatz.
const kochen=S.create({titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen',terminStatus:'FEST',datumVon:'2027-01-12'});
const abholung=S.create({titel:'Grünkohl abholen Dortmund → Tiefkühler Hamm',art:'transport',folgtAuf:kochen.id,abstandTage:2});
const offen=S.create({titel:'Grünkohl verteilen',art:'transport'});
// Ab hier meldet ein Mitglied (Rolle employee).
K.currentUser={personId:me,displayName:'Ich',role:'employee'};
const list=H.reportableEvents(today);
assert.equal(list.find(e=>e.id===kochen.id).reportable,true);
assert.equal(list.find(e=>e.id===offen.id).reportable,false,'Termin offen → noch nicht meldbar');
assert.deepEqual([...H.allowedDates(S.get(abholung.id),today)],['2027-01-14']);

// Sammelmeldung: ich + zwei Kollegen mit eigenem Stundenumfang (Fahrt zuhause→zuhause, Ende nach Mitternacht erlaubt).
const sub={specialEventId:kochen.id,date:'2027-01-12',taetigkeit:'kochen',bemerkung:'Großer Topf',eintraege:[
  {personId:me,start:6.5,end:16,breakMinutes:30},
  {personId:anna,start:7,end:15.5,breakMinutes:0},
  {personId:bernd,start:18,end:25.5,breakMinutes:0}
]};
assert.deepEqual([...H.validate(sub,{today})],[]);
const res=await H.submit(sub,{today});
assert.equal(res.created.length,3,'Eine Zeile je Person');
assert.equal(new Set(res.created.map(r=>r.sammelId)).size,1,'Gemeinsame Sammel-ID');
assert.ok(res.created.every(r=>r.status==='gemeldet'&&r.gemeldetVon===me&&r.specialEventTitle==='Grünkohl kochen'));
assert.equal(res.created.find(r=>r.personId===anna).end,15.5,'Eigener Stundenumfang je Kollege');
assert.equal(res.created.find(r=>r.personId===bernd).end,25.5,'Ende nach Mitternacht (Fahrt nach Hause)');
assert.equal(res.created[0].verspaetet,true,'20.01. ist mehr als 3 Tage nach dem 12.01.');
assert.ok(persisted>=1);assert.ok(audit.some(a=>a.action==='hour_report.submit'));

// Doppelschutz: dieselbe Person, gleicher Tag/Einsatz, überlappend → übersprungen, nicht doppelt.
const again=await H.submit({...sub,eintraege:[{personId:anna,start:8,end:12,breakMinutes:0}]},{today});
assert.equal(again.created.length,0);assert.equal(again.skipped[0].personId,anna);
assert.equal(K.hourReports.filter(r=>r.personId===anna).length,1);

// Frist: am 14.01. gemeldet (Abholung) → nicht verspätet, Restzeit 3 Tage.
const ok=await H.submit({specialEventId:abholung.id,date:'2027-01-14',taetigkeit:'transport',eintraege:[{personId:me,start:9,end:13}]},{today:'2027-01-14'});
assert.equal(ok.created[0].verspaetet,false);
assert.equal(H.deadline('2027-01-14','2027-01-14').left,3);
assert.equal(H.deadline('2027-01-12','2027-01-16').late,true);

// Prüfregeln.
const bad=s=>H.validate({...sub,...s},{today}).join(' ');
assert.match(bad({specialEventId:offen.id}),/Termin noch nicht fest/);
assert.match(bad({date:'2027-01-25'}),/erst nach dem Einsatz/);
assert.match(bad({date:'2027-01-13'}),/gehört nicht zu diesem Einsatz/);
assert.match(bad({taetigkeit:'erfunden'}),/Tätigkeit/);
assert.match(bad({eintraege:[]}),/mindestens eine Person/);
assert.match(bad({eintraege:[{personId:'gibt-es-nicht',start:8,end:9}]}),/Unbekannte Person/);
assert.match(bad({eintraege:[{personId:me,start:8,end:9},{personId:me,start:10,end:11}]}),/doppelt/);
assert.match(bad({eintraege:[{personId:me,start:9,end:8}]}),/Von-\/Bis/);
assert.match(bad({eintraege:[{personId:me,start:8.1,end:9}]}),/Von-\/Bis/,'Nur Viertelstunden');
assert.match(bad({eintraege:[{personId:me,start:2,end:20}]}),/16 Stunden/);
assert.match(bad({eintraege:[{personId:me,start:8,end:9,breakMinutes:60}]}),/Pause/);
await assert.rejects(()=>H.submit({...sub,specialEventId:offen.id},{today}),/Termin/);

// Club-App-Weg: Transport übernimmt das Speichern, Antwort wird übernommen.
const sent=[];K.hourReportsTransport={submit:async payload=>{sent.push(payload);return {sammelId:'SM-SERVER',rows:[{id:'srv-1',sammelId:'SM-SERVER',specialEventId:abholung.id,specialEventTitle:'Abholung',personId:bernd,gemeldetVon:me,date:'2027-01-14',start:9,end:13,breakMinutes:0,taetigkeit:'transport',status:'gemeldet',version:1}],skipped:[]};}};
const viaClub=await H.submit({specialEventId:abholung.id,date:'2027-01-14',taetigkeit:'transport',eintraege:[{personId:bernd,start:9,end:13}]},{today});
assert.equal(sent.length,1);assert.equal(sent[0].eintraege[0].personId,bernd);
assert.equal(viaClub.sammelId,'SM-SERVER');assert.ok(K.hourReports.some(r=>r.id==='srv-1'));
delete K.hourReportsTransport;

// Planer holt den Supabase-Eingang ab (snake_case → DP2), höhere Version gewinnt.
K.supabaseConnection={hourReportsPending:async()=>[{id:'srv-2',sammel_id:'SM-X',event_id:'KC-WM-2026',special_event_id:kochen.id,special_event_title:'Grünkohl kochen',person_id:anna,gemeldet_von:anna,work_date:'2027-01-12',start_h:'16.00',end_h:'18.00',break_minutes:0,taetigkeit:'aufraeumen',status:'gemeldet',verspaetet:true,version:1}]};
const pulled=await H.pull();
assert.equal(pulled.received,1);const r2=K.hourReports.find(r=>r.id==='srv-2');
assert.equal(r2.start,16);assert.equal(r2.personId,anna);assert.equal(r2.taetigkeit,'aufraeumen');
H.merge([{...r2,status:'bestaetigt',version:2}]);assert.equal(K.hourReports.find(r=>r.id==='srv-2').status,'bestaetigt');
H.merge([{...r2,status:'gemeldet',version:1}]);assert.equal(K.hourReports.find(r=>r.id==='srv-2').status,'bestaetigt','Ältere Version überschreibt nicht');

// Meine Meldungen: eigene und selbst gemeldete; Wiederherstellen.
assert.ok(H.mine(me).some(r=>r.personId===anna),'Vom Meldenden für Kollegen angelegte Zeilen sind sichtbar');
const snap=H.snapshot();H.restore([]);assert.equal(K.hourReports.length,0);H.restore(snap);assert.equal(K.hourReports.length,snap.length);
assert.equal(H.hoursOf({start:6.5,end:16,breakMinutes:30}),9.5);
console.log('✓ Stundenmeldungen: Sammelmeldung je Kollege, Regeln, Doppelschutz, Frist, Club-App-Transport, Abholen');
