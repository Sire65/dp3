// Build 307 · Ist-Rückmeldung nach dem Dienst: Club App fragt, DP2 bucht genau eine Ist-Zeit (oder keine) und zeigt alles
// richtig im Kontoauszug. Offline: Supabase wird nachgebildet, es gibt keinen Netzaufruf.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const document={readyState:'complete',write:()=>{},addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,body:{}};
class MutationObserver{observe(){}}
const noNet=()=>{throw new Error('Kein Netzaufruf im Test erlaubt');};
const context=vm.createContext({window:{},document,MutationObserver,console,setTimeout,clearTimeout,structuredClone,fetch:noNet,CSS:{escape:x=>x},queueMicrotask,CustomEvent:class{},prompt:()=>null});
context.window.addEventListener=()=>{};context.window.dispatchEvent=()=>{};
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/planning.js','src/core/actual.js','src/core/hour-reports.js','src/core/ist-rueckmeldung.js','src/ui/person-account-print.js','src/ui/actual-reconciliation.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,IR=K.istRueckmeldung,P=K.personAccountPrint;
const audit=[];K.recordAudit=(a,m)=>audit.push({action:a,...m});K.sync={enqueue:()=>{}};let persisted=0;K.persistAll=async()=>{persisted++;return true;};
assert.equal(K.currentUser.role,'planner');
const [anna,bernd,carla,dora,emil]=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);
const day='2026-12-05',day2='2026-12-06';
// Solldienste (wie in kc_dp_plan_published veröffentlicht: source_shift_id = DP2-Dienst-ID).
K.shifts=[
  {id:'IR-S1',personId:anna,date:day,start:11,end:15,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'published'},
  {id:'IR-S2',personId:bernd,date:day,start:11,end:15,zone:'back',area:'Küche',layer:'planned',breakMinutes:0,status:'published'},
  {id:'IR-S3',personId:carla,date:day,start:11,end:15,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'published'},
  {id:'IR-S4',personId:dora,date:day,start:11,end:15,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'published'},
  {id:'IR-S5',personId:emil,date:day,start:11,end:15,zone:'back',area:'Küche',layer:'planned',breakMinutes:0,status:'published'},
  {id:'IR-S6',personId:anna,date:day2,start:19,end:25.5,zone:'back',area:'Abbau',layer:'planned',breakMinutes:0,status:'published'},
  {id:'IR-S7',personId:bernd,date:day2,start:12,end:16,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'published'},
  {id:'IR-S8',personId:carla,date:day2,start:12,end:16,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'published'}
];
// Kasse für Emil an Tag 1 (höherer Vorrang).
K.actualShifts=[{id:'TC-E',personId:emil,date:day,start:10.75,end:15.25,breakMinutes:0,source:'timeclock',status:'recorded'}];
K.actualWorkflow={...K.actualWorkflow,status:'open'};

// Zeiten als timestamptz (Winterzeit +01:00). 11:00 Berlin = 10:00Z.
const u=n=>`00000000-0000-4000-9000-${String(n).padStart(12,'0')}`;
const ts=(date,hhmm)=>{const [h,m]=hhmm.split(':').map(Number);const d=new Date(`${date}T00:00:00Z`);d.setUTCMinutes(h*60+m-60);return d.toISOString().replace('.000Z','+00:00');};
const base=(n,personId,dienstRef,date,s,e)=>({id:u(n),event_id:'KC-WM-2026',dienst_ref:dienstRef,person_id:personId,work_date:date,bereich:'Verkauf',soll_start:ts(date,s),soll_ende:ts(date,e),soll_pause:0,ergebnis:null,ist_start:null,ist_ende:null,pause_min:null,grund:null,bemerkung:null,planer_status:'offen',planer_grund:null,entschieden_am:null,gefragt_am:`${date}T15:00:00Z`,beantwortet_am:null,version:1,geaendert_am:null});
let remote=[
  {...base(1,anna,'IR-S1',day,'11:00','15:00'),ergebnis:'passt',ist_start:ts(day,'11:00'),ist_ende:ts(day,'15:00'),planer_status:'automatisch',version:2},
  {...base(2,bernd,'IR-S2',day,'11:00','15:00'),ergebnis:'geaendert',ist_start:ts(day,'11:00'),ist_ende:ts(day,'16:00'),grund:'Kasse länger offen',planer_status:'zu_bestaetigen',version:2},
  {...base(3,carla,'IR-S3',day,'11:00','15:00'),ergebnis:'nicht_da',grund:'krank',planer_status:'zu_bestaetigen',version:2},
  {...base(4,dora,'IR-S4',day,'11:00','15:00')},
  {...base(5,emil,'IR-S5',day,'11:00','15:00'),ergebnis:'passt',planer_status:'automatisch',version:2},
  {...base(6,anna,'IR-S6',day2,'19:00','01:30'),soll_ende:new Date(Date.parse(day2+'T00:30:00Z')+86400000).toISOString(),ergebnis:'geaendert',ist_start:ts(day2,'19:00'),ist_ende:new Date(Date.parse(day2+'T00:40:00Z')+86400000).toISOString(),planer_status:'automatisch',version:2},
  {...base(7,bernd,'IR-S7',day2,'12:00','16:00'),ergebnis:'geaendert',ist_start:ts(day2,'12:00'),ist_ende:ts(day2,'17:00'),grund:'Abbau',planer_status:'zu_bestaetigen',version:2},
  {...base(8,carla,'IR-S8',day2,'12:00','16:00'),ergebnis:'geaendert',ist_start:ts(day2,'12:00'),ist_ende:ts(day2,'18:00'),grund:'zu spät abgelöst',planer_status:'zu_bestaetigen',version:2}
];
const calls=[];let staleNext=false;
K.supabaseConnection={
  istRueckmeldungen:async args=>{calls.push({fn:'liste',args});return JSON.parse(JSON.stringify(remote));},
  istRueckmeldungEntscheiden:async(id,status,grund)=>{calls.push({fn:'entscheiden',id,status,grund});if(staleNext){staleNext=false;return {ok:false,stale:true,id};}const r=remote.find(x=>x.id===id);r.planer_status=status;r.planer_grund=grund||null;r.version+=1;return {ok:true,stale:false,id,status,version:r.version};}
};

// Zeitumrechnung: timestamptz → Dezimalstunden am Diensttag (Europe/Berlin), auch nach Mitternacht.
assert.equal(IR.hoursOn(ts(day,'11:00'),day),11);
assert.equal(IR.hoursOn('2026-12-07T00:30:00Z',day2),25.5,'01:30 am Folgetag = 25,5');
assert.equal(IR.hoursOn('2026-07-01T09:15:00Z','2026-07-01'),11.25,'Sommerzeit +02:00');

// Abholen (Planer) wendet automatische Rückmeldungen sofort an.
const pulled=await IR.pull();
assert.equal(pulled.received,8);assert.equal(calls[0].fn,'liste');assert.ok(calls[0].args.von&&calls[0].args.bis,'Zeitraum wird mitgegeben');
const own=id=>K.actualShifts.filter(a=>a.istRueckmeldungId===u(id)&&a.status!=='deleted');

// 1) passt → genau eine Ist-Zeit self_confirm = Soll.
assert.equal(own(1).length,1);const a1=own(1)[0];
assert.equal(a1.source,'self_confirm');assert.equal(a1.start,11);assert.equal(a1.end,15);assert.equal(a1.linkedShiftId,'IR-S1');
assert.deepEqual({...a1.original},{start:11,end:15,breakMinutes:0,source:'plan'});
assert.equal(a1.comparison.status,'match');

// 2) zu_bestaetigen → keine Ist-Zeit; Kontoauszug zeigt „wartet“, zählt nicht, keine „Buchung fehlt“.
assert.equal(own(2).length,0);
let rb=P.buildRows(bernd,day,day)[0];
assert.equal(rb.i,0);assert.equal(rb.missingBooking,false,'Keine falsche „Buchung fehlt“');assert.equal(rb.rp,5,'Gemeldet 11–16 = 5 h wartet');
assert.match(P.buildHtml({personIds:[bernd],start:day,end:day,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'}),/⏳ wartet auf Bestätigung · Soll 11:00–15:00 → Ist 11:00–16:00 · Grund: Kasse länger offen/);

// 3) nicht_da (wartet) → keine Ist-Zeit.
assert.equal(own(3).length,0);
// 4) keine Antwort → „⏳ keine Antwort“, aber keine falsche fehlende Buchung.
const rd=P.buildRows(dora,day,day)[0];assert.equal(rd.missingBooking,false);assert.equal(rd.irNoAnswer,true);
assert.match(P.buildHtml({personIds:[dora],start:day,end:day,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'}),/⏳ keine Antwort/);

// 5) Kasse vorhanden → keine Selbst-Ist-Zeit (Vorrang), Rückmeldung nur als Hinweis.
assert.equal(own(5).length,0,'Selbstauskunft überschreibt keine Buchung');
const re=P.buildRows(emil,day,day)[0];assert.equal(re.i,4.5,'Es zählt die Kasse');assert.ok(re.notes.some(n=>n.code==='ueberlagert'));
assert.equal(IR.stateOf(K.istRueckmeldungen.find(r=>r.id===u(5))).code,'ueberlagert');

// 6) Nach Mitternacht, kleine Abweichung (10 Min.) → automatisch → self_change mit original = Soll.
const a6=own(6);assert.equal(a6.length,1);assert.equal(a6[0].source,'self_change');assert.equal(a6[0].start,19);
assert.ok(Math.abs(a6[0].end-(25+40/60))<1e-9,'Ende 01:40 (+1)');assert.equal(a6[0].original.end,25.5);assert.equal(a6[0].linkedShiftId,'IR-S6');
const ra6=P.buildRows(anna,day2,day2)[0];assert.ok(Math.abs(ra6.i-(6+40/60))<1e-9);

// Planer bestätigt „geändert 11–16“ → self_change mit original.
await assert.rejects(()=>IR.decide(u(2),{status:'abgelehnt'}),/Grund/);
const d2=await IR.decide(u(2),{status:'bestaetigt'});
assert.equal(d2.planerStatus,'bestaetigt');assert.equal(calls.at(-1).fn,'entscheiden');assert.equal(calls.at(-1).status,'bestaetigt');
assert.equal(own(2).length,1);const a2=own(2)[0];assert.equal(a2.source,'self_change');assert.equal(a2.start,11);assert.equal(a2.end,16);assert.equal(a2.original.start,11);assert.equal(a2.original.end,15);
rb=P.buildRows(bernd,day,day)[0];assert.equal(rb.i,5);assert.equal(rb.rp,0);
const hb=P.buildHtml({personIds:[bernd],start:day,end:day,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'});
assert.match(hb,/✏️ geändert \(Soll 11:00–15:00 → Ist 11:00–16:00\) · Grund: Kasse länger offen · vom Planer bestätigt/);
assert.match(hb,/✏️ selbst geändert/,'Quelle in „Ist aus Buchungen“');
await assert.rejects(()=>IR.decide(u(2),{status:'abgelehnt',reason:'x'}),/bereits entschieden/);

// Planer bestätigt „nicht da“ → keine Ist-Zeit, Solldienst gilt als abwesend (keine fehlende Buchung, sichtbar im Kontoauszug).
await IR.decide(u(3),{status:'bestaetigt'});
assert.equal(own(3).length,0);assert.equal(IR.absentShift(K.shifts.find(s=>s.id==='IR-S3')),true);
assert.ok(!K.actual.missingPlanned(day).some(s=>s.id==='IR-S3'),'„nicht da“ ist keine fehlende Buchung');
const rc=P.buildRows(carla,day,day)[0];assert.ok(rc,'Zeile bleibt sichtbar');assert.equal(rc.i,0);assert.equal(rc.absent,true);assert.equal(rc.missingBooking,false);assert.equal(rc.planned.length,1,'Soll bleibt sichtbar');
assert.match(P.buildHtml({personIds:[carla],start:day,end:day,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'}),/🚫 nicht da · Grund: krank/);

// Ablehnen nur mit Grund → keine Ist-Zeit, Kontoauszug „❌ abgelehnt“.
await IR.decide(u(8),{status:'abgelehnt',reason:'Ablösung war pünktlich'});
assert.equal(calls.at(-1).grund,'Ablösung war pünktlich');assert.equal(own(8).length,0);
assert.match(P.buildHtml({personIds:[carla],start:day2,end:day2,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'}),/❌ abgelehnt · Grund: Ablösung war pünktlich/);

// Stale: anderswo geändert → keine lokale Buchung.
staleNext=true;await assert.rejects(()=>IR.decide(u(7),{status:'bestaetigt'}),/inzwischen geändert/);assert.equal(own(7).length,0);

// Versionswechsel: Mitglied ändert „passt“ auf 11–15:10 (automatisch) → dieselbe Ist-Zeit wird aktualisiert, keine zweite.
const r1=remote.find(r=>r.id===u(1));Object.assign(r1,{ergebnis:'geaendert',ist_start:ts(day,'11:00'),ist_ende:ts(day,'15:10'),planer_status:'automatisch',version:r1.version+1});
await IR.pull();
assert.equal(own(1).length,1,'Kein Duplikat');assert.equal(own(1)[0].id,a1.id);assert.equal(own(1)[0].source,'self_change');assert.ok(Math.abs(own(1)[0].end-(15+10/60))<1e-9);
assert.equal(K.actualShifts.filter(a=>a.istRueckmeldungId===u(1)).length,1,'Genau ein Datensatz je Rückmeldung');
// Erneutes Abholen ohne Änderung ändert nichts.
const before=JSON.stringify(K.actualShifts);await IR.pull();assert.equal(JSON.stringify(K.actualShifts),before);
// Version wird „zu_bestaetigen“ (große Abweichung) → Ist-Zeit wird stillgelegt (zählt nicht mehr), nicht gelöscht.
Object.assign(r1,{ist_ende:ts(day,'17:00'),planer_status:'zu_bestaetigen',version:r1.version+1});await IR.pull();
assert.equal(own(1).length,0);assert.equal(K.actualShifts.find(a=>a.id===a1.id).status,'deleted');assert.equal(P.buildRows(anna,day,day)[0].missingBooking,false);
await IR.decide(u(1),{status:'bestaetigt'});assert.equal(own(1).length,1);assert.equal(own(1)[0].id,a1.id,'Gleiche Ist-Zeit wiederbelebt');assert.equal(own(1)[0].end,17);

// Kasse kommt später: Import hat Vorrang und legt die Selbstauskunft still.
const imp=K.actual.importRows([{personId:bernd,date:day,start:11,end:15.75,breakMinutes:0}],{batchName:'Kasse 05.12.',source:'timeclock'});
assert.equal(imp.batch.accepted,1,'Import nicht durch Selbstauskunft blockiert');assert.equal(own(2).length,0);
assert.equal(IR.stateOf(K.istRueckmeldungen.find(r=>r.id===u(2))).code,'ueberlagert');await IR.pull();assert.equal(own(2).length,0,'Kein Wiederanlegen neben der Buchung');
rb=P.buildRows(bernd,day,day)[0];assert.equal(rb.i,4.75,'Nur die Kasse zählt');

// Planer-Korrektur einer Selbst-Ist-Zeit hat Vorrang vor späteren Abholungen.
K.currentUser={...K.currentUser,role:'admin'};
K.actual.correctActual(own(6)[0].id,{end:25.5},{reason:'Abbau laut Schichtleiter bis 01:30'});
K.currentUser={...K.currentUser,role:'planner'};
const r6=remote.find(r=>r.id===u(6));r6.version+=1;await IR.pull();
assert.equal(own(6)[0].end,25.5,'Planer-Korrektur bleibt');assert.equal(IR.stateOf(K.istRueckmeldungen.find(r=>r.id===u(6))).code,'planer_korrektur');

// Korrektur einer Kassenbuchung: Mitglied sagt „Buchung falsch“ → Planer bestätigt → Buchung korrigiert (Rohbuchung bleibt).
K.actualShifts.push({id:'TC-D2',personId:dora,date:day2,start:12,end:13,breakMinutes:0,source:'cash_register',status:'recorded'});
K.shifts.push({id:'IR-S9',personId:dora,date:day2,start:12,end:16,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'published'});
remote.push({...base(9,dora,'IR-S9',day2,'12:00','16:00'),ergebnis:'korrektur',ist_start:ts(day2,'12:00'),ist_ende:ts(day2,'16:00'),grund:'Ausstempeln vergessen',planer_status:'zu_bestaetigen',version:2});
await IR.pull();
assert.ok(IR.warnings(u(9)).some(w=>w.code==='booking_correct'&&w.level==='error'),'Planer ohne Korrekturrecht wird gewarnt');
await assert.rejects(()=>IR.decide(u(9),{status:'bestaetigt'}),/Istzeiten korrigieren/);
K.currentUser={...K.currentUser,role:'time_auditor'};
await IR.decide(u(9),{status:'bestaetigt'});
const tc=K.actualShifts.find(a=>a.id==='TC-D2');assert.equal(tc.end,16);assert.equal(tc.source,'manual_correction');assert.equal(tc.original.end,13,'Rohbuchung bleibt sichtbar');
assert.equal(K.actualShifts.filter(a=>a.personId===dora&&a.date===day2&&a.status!=='deleted').length,1,'Keine zusätzliche Ist-Zeit');
const rd2=P.buildRows(dora,day2,day2)[0];assert.equal(rd2.i,4);assert.equal(rd2.b,1);
K.currentUser={...K.currentUser,role:'planner'};

// Abgeschlossener Istplan sperrt Bestätigen und Anwenden.
K.actualWorkflow={...K.actualWorkflow,status:'closed'};
assert.ok(IR.warnings(u(7)).some(w=>w.code==='closed'));await assert.rejects(()=>IR.decide(u(7),{status:'bestaetigt'}),/abgeschlossen/);
assert.equal(IR.apply().blocked,true);
K.actualWorkflow={...K.actualWorkflow,status:'open'};

// Mitglieder dürfen nicht entscheiden.
K.currentUser={personId:bernd,displayName:'Bernd',role:'employee'};
await assert.rejects(()=>IR.decide(u(7),{status:'bestaetigt'}),/nicht entscheiden/);
K.currentUser={personId:'planer',displayName:'Planer',role:'planner'};

// Kontoauszug-Summen: nur gezählte Ist-Zeiten, wartend/nicht da/keine Antwort getrennt.
const rowsAnna=P.buildRows(anna,day,day2),sAnna=P.summary(rowsAnna);
assert.equal(sAnna.actual,rowsAnna.reduce((n,r)=>n+r.i,0));
assert.ok(Math.abs(sAnna.actual-(6+6.5))<1e-9,'Anna: 11–17 (bestätigt) + 19–01:30 (Planer-Korrektur)');
const all=[bernd,carla,dora].flatMap(p=>P.buildRows(p,day,day2)),sAll=P.summary(all);
assert.equal(sAll.absent,1);assert.equal(sAll.noAnswer,1,'Dora Tag 1 ohne Antwort');
assert.ok(Math.abs(sAll.irWaiting-5)<1e-9,'Bernd Tag 2 wartet (12–17), nicht in der Summe');
assert.equal(sAll.actual,all.reduce((n,r)=>n+r.i,0));
assert.equal(sAll.missing,0,'Keine falsche „Buchung fehlt“');
const sumHtml=P.buildHtml({personIds:[bernd,carla],start:day,end:day2,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'combined',graphPage:false});
assert.match(sumHtml,/Rückmeldung wartet auf Bestätigung \(nicht in der Summe\)/);assert.match(sumHtml,/🚫 nicht da/);

// Ist-Abgleich zeigt die neuen Quellen und Zustände.
const batches=K.actualImportBatches;K.actualImportBatches=[];const items=K.actualReconciliation.buildItems().items;K.actualImportBatches=batches;
assert.ok(items.some(i=>i.kind==='absent'&&i.planned.id==='IR-S3'&&i.severity==='ok'&&/nicht da/.test(i.label)));
assert.ok(items.some(i=>i.kind==='missing'&&i.planned.id==='IR-S7'&&i.severity==='warn'&&/wartet auf Bestätigung/.test(i.label)));
assert.ok(items.some(i=>i.kind==='missing'&&i.planned.id==='IR-S4'&&/keine Antwort/.test(i.label)));
assert.ok(items.some(i=>i.actual?.source==='self_change'&&/Selbst geändert/.test(i.label)));

// Zusatz Hansi: Stimmung & Besetzung. Nur-Feedback-Zeile (ergebnis null) mit vorhandener Kasse zählt nicht als „keine Antwort“.
K.actualShifts.push({id:'TC-E2',personId:emil,date:day2,start:12,end:16,breakMinutes:0,source:'timeclock',status:'recorded'});
K.shifts.push({id:'IR-S10',personId:emil,date:day2,start:12,end:16,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'published'});
const noAnswerBefore=IR.counts().keine_antwort;
remote.push({...base(10,emil,'IR-S10',day2,'12:00','16:00'),zufrieden:1,besetzung:'zu_wenig',feedback_am:`${day2}T16:30:00Z`});
Object.assign(remote.find(r=>r.id===u(7)),{zufrieden:3,besetzung:'zu_wenig',feedback_am:`${day2}T16:10:00Z`});
Object.assign(remote.find(r=>r.id===u(8)),{zufrieden:2,besetzung:'passt',feedback_am:`${day2}T16:20:00Z`,version:remote.find(r=>r.id===u(8)).version});
Object.assign(remote.find(r=>r.id===u(5)),{zufrieden:7,besetzung:'quatsch'});
await IR.pull();
const fb=K.istRueckmeldungen.find(r=>r.id===u(10));assert.equal(fb.zufrieden,1);assert.equal(fb.besetzung,'zu_wenig');assert.equal(fb.feedbackAm,`${day2}T16:30:00Z`);
assert.equal(K.istRueckmeldungen.find(r=>r.id===u(5)).zufrieden,null,'Ungültige Werte werden verworfen');
assert.equal(IR.stateOf(fb).code,'gebucht');assert.equal(IR.counts().keine_antwort,noAnswerBefore,'Nur-Feedback mit Kasse ist keine fehlende Antwort');
assert.ok(!IR.list({filter:'keine_antwort'}).some(r=>r.id===u(10)));assert.equal(own(10).length,0,'Feedback bucht nichts');
const ee=P.buildRows(emil,day2,day2)[0];assert.equal(ee.i,4);assert.equal(ee.irNoAnswer,false);
const mood=IR.stimmung({von:day2,bis:day2}),verkauf=mood.find(g=>g.date===day2&&g.bereich==='Verkauf');
assert.ok(verkauf,'Auswertung je Tag und Bereich');assert.deepEqual({gut:verkauf.gut,geht:verkauf.geht,schlecht:verkauf.schlecht,zuWenig:verkauf.zuWenig,passt:verkauf.passt,zuViel:verkauf.zuViel},{gut:1,geht:1,schlecht:1,zuWenig:2,passt:1,zuViel:0});
// Eigenes Gesicht nur im eigenen Kontoauszug.
K.currentUser={personId:emil,displayName:'Emil',role:'employee'};
assert.match(P.buildHtml({personIds:[emil],start:day2,end:day2,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'}),/Meine Stimmung: 😀 gut/);
K.currentUser={personId:'planer',displayName:'Planer',role:'planner'};
assert.doesNotMatch(P.buildHtml({personIds:[emil],start:day2,end:day2,nameMode:'clear',onlyActivity:true,detail:'full',header:'minimal',documentMode:'single'}),/Meine Stimmung/,'Planer sieht kein fremdes Gesicht im Kontoauszug');

// Persistenz: Schnappschuss/Wiederherstellen.
const snap=IR.snapshot();IR.restore([]);assert.equal(K.istRueckmeldungen.length,0);IR.restore(snap);assert.equal(K.istRueckmeldungen.length,10);
assert.ok(persisted>0);assert.ok(audit.some(a=>a.action==='ist_rueckmeldung.confirm')&&audit.some(a=>a.action==='ist_rueckmeldung.reject')&&audit.some(a=>a.action==='actual.self_report.retire'));

// Transport: nur die beiden RPCs, nie die Tabelle direkt.
const provider=await readFile(path.join(root,'src/adapters/supabase-provider.js'),'utf8');
assert.match(provider,/rpc\/kc_dp_rueckmeldungen_liste/);assert.match(provider,/rpc\/kc_dp_rueckmeldung_entscheiden/);assert.doesNotMatch(provider,/rest\/v1\/kc_dp_dienst_rueckmeldung/);
console.log('✓ Ist-Rückmeldung: passt/geändert/automatisch/bestätigt, wartet, nicht da, keine Antwort, Vorrang Kasse, Version ohne Duplikat, nach Mitternacht, Korrektur, Kontoauszug-Summen, Stimmung & Besetzung');
