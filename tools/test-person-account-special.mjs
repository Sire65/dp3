// KICC-F-100: Sonderstunden erscheinen im persönlichen Kontoauszug – bestätigt in der Summe, gemeldet getrennt.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const document={readyState:'complete',write:()=>{},addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,body:{}};
class MutationObserver{observe(){}}
const context=vm.createContext({window:{},document,MutationObserver,console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/special-events.js','src/ui/person-account-print.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,P=K.personAccountPrint,S=K.specialEventsCore;
K.recordAudit=()=>{};K.sync={enqueue:()=>{}};K.auth.has=()=>true;
const person=K.people.find(p=>p.active&&p.personType==='member').personId;
const kochen=S.create({titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen',terminStatus:'FEST',datumVon:'2027-01-12'});
const abholung=S.create({titel:'Grünkohl abholen Dortmund → Tiefkühler Hamm',art:'transport',folgtAuf:kochen.id,abstandTage:2});

// Bestätigte Meldung = Ist-Zeit mit Quelle self_report (Kochtag im Januar, außerhalb der Markttage).
K.actualShifts=[{id:'A-SE-1',personId:person,date:'2027-01-12',start:7.5,end:15.5,breakMinutes:0,zone:'special',area:'Z · Grünkohl kochen',source:'self_report',specialEventId:kochen.id,status:'confirmed'}];
// Noch offene Meldung (Abholung) – darf nicht zur Summe zählen.
K.hourReports=[{id:'HR-1',personId:person,date:'2027-01-14',start:9,end:13,breakMinutes:0,status:'gemeldet',specialEventId:abholung.id},{id:'HR-2',personId:person,date:'2027-01-14',start:14,end:15,status:'bestaetigt'}];

// Standardzeitraum umfasst auch die Sondereinsätze im Januar.
const span=P._test.accountSpan();
assert.equal(span.start,K.days[0].date);
assert.equal(span.end,'2027-01-14','Zeitraum reicht bis zum letzten Sondereinsatz/zur letzten Meldung');

const rows=P.buildRows(person,span.start,span.end,{onlyActivity:true});
const cook=rows.find(r=>r.date==='2027-01-12'),pick=rows.find(r=>r.date==='2027-01-14');
assert.ok(cook,'Bestätigter Kochtag erscheint als Zeile');
assert.equal(cook.i,8,'Bestätigte Stunden zählen als Ist');
assert.equal(cook.sp,8,'… und als Sondereinsatz');
assert.ok(pick,'Offene Meldung erscheint als Zeile');
assert.equal(pick.i,0,'Offene Meldung zählt nicht als Ist');
assert.equal(pick.p,4,'Offene Meldung wird getrennt geführt');
assert.equal(pick.pending.length,1,'Nur Status „gemeldet“ gilt als offen');
assert.equal(pick.missingBooking,false);

const sum=P.summary(rows);
assert.equal(sum.special,8);assert.equal(sum.pending,4);
assert.equal(sum.actual,rows.reduce((n,r)=>n+r.i,0),'Gesamtstunden enthalten nur Bestätigtes');

const html=P.buildHtml({personIds:[person],start:span.start,end:span.end,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'});
assert.match(html,/★ Grünkohl kochen/,'Bestätigte Zeile trägt den Einsatznamen');
assert.match(html,/gemeldet, noch nicht bestätigt · Grünkohl abholen/,'Offene Meldung ist sichtbar markiert');
assert.match(html,/davon Sondereinsätze/);
assert.match(html,/Gemeldet, noch nicht bestätigt \(nicht in der Summe\)/);
assert.match(html,/Meldung offen/);
console.log('✓ Personenkonto: Sonderstunden bestätigt in der Summe, gemeldet getrennt, Zeitraum bis Januar');
