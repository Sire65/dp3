// Build 321 · KC-DP-SOLL-UEBERGABE: Sollplan aus der Club-App übernehmen – offline, Supabase wird nachgebildet (kein Netzaufruf).
// Prüft: Validierung (Person, Sperrliste, Veranstaltungstag, Überschneidung mit DP2-Dienst), neu/geändert/entfällt/unverändert,
// Schutz in DP2 geänderter Dienste (Standard: behalten), Ist-Zeiten, Wiederholung ohne Dubletten, Rücknahme bei Fehlern, Rechte, Bestätigung
// (uebernommen/verworfen) und dass die Sollplan-Brücke daraus Veröffentlichungszeilen macht (entfallene nicht mehr).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const noNet=()=>{throw new Error('Kein Netzaufruf im Test erlaubt');};
const files=['src/core/model.js','src/core/auth.js','src/core/planning.js','src/core/breaks.js','src/core/actual.js','src/core/wish-zone.js','src/core/club-soll-inbox.js'];
const sources=await Promise.all(files.map(f=>readFile(path.join(root,f),'utf8')));
const bridgeSource=await readFile(path.join(root,'src/core/plan-manager-bridge.js'),'utf8');

export async function fixture(){
  const document={readyState:'complete',addEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],body:null};
  const context=vm.createContext({window:{addEventListener(){},dispatchEvent(){}},document,console,setTimeout,clearTimeout,structuredClone,fetch:noNet,Intl,CustomEvent:class{},MutationObserver:class{observe(){}}});
  sources.forEach((s,i)=>vm.runInContext(s,context,{filename:files[i]}));
  const K=context.window.KCDP;
  K.currentUser={role:'planner',personId:'KC-P-002',displayName:'Planer'};
  K.shifts=[];K.wishes=[];K.actualShifts=[];K.swapRequests=[];K.memberUxData={};K.auditLog=[];
  const net={pending:null,acks:[],ackFails:false,pendingCalls:0};
  let persisted=0;K.persistAll=async()=>{persisted++;return {confirmed:true};};
  K.supabaseConnection={hasAccessToken:()=>true,
    sollInboxPending:async()=>{net.pendingCalls++;return net.pending?JSON.parse(JSON.stringify(net.pending)):{};},
    sollInboxAck:async(a)=>{if(net.ackFails)throw new Error('offline');net.acks.push(a);const ok=net.pending?.id===a.id;if(ok)net.pending=null;return {ok,stale:!ok};}};
  K.daysPublishBridge={planningMembership:async()=>['planner','admin'].includes(K.currentUser.role)?{role:K.currentUser.role,active:true}:null};
  const staged=[];K.sync={stageLocalBatch:(tag,fn)=>{staged.push(['stage',tag]);return fn();},settleLocalBatch:(tag,ok)=>staged.push(['settle',tag,ok]),enqueue(){}};
  return {K,net,staged,get persisted(){return persisted}};
}
const P=['KC-P-M0003','KC-P-M0008','KC-P-M0009','KC-P-M0005','KC-P-M0001'];
const row=(pid,date,start,end,zone='front',area='Vorne',breakMinutes=end-start>6?30:0)=>({importKey:`CLUB-${date}-${pid}`,personId:pid,name:'',date,start,end,zone,area,breakMinutes});
const stand=(id,rows)=>({id,eventId:'KC-WM-2026',stand:'2026-11-23T10:00:00Z',anzahl:rows.length,pruefsumme:'sum-'+id,rows,createdAt:'2026-11-23T10:00:00Z'});
const active=K=>K.shifts.filter(s=>!['deleted','cancelled'].includes(s.status));

// 1) Erstübernahme mit Prüfungen
{
  const f=await fixture(),{K,net}=f,CS=K.clubSollInbox;
  K.shifts=[{id:'S-HAND',personId:P[3],date:'2026-12-04',start:10,end:13,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'draft',planningSource:'manual'}];
  net.pending=stand('U1',[
    row(P[0],'2026-12-04',11,17.5),row(P[1],'2026-12-04',15,23,'back','Hinten',45),row(P[2],'2026-12-02',8,14,'neutral','Vorbereitung'),
    row('KC-P-M0099','2026-12-04',12,16),           // unbekannt
    row('KC-P-M0004','2026-12-04',12,16),           // Sperrliste (nicht planbar)
    row(P[4],'2026-12-24',12,16),                   // kein Veranstaltungstag
    row(P[3],'2026-12-04',12,16),                   // überschneidet einen von Hand angelegten DP2-Dienst
    {...row(P[4],'2026-12-05',12,16),importKey:'FALSCH'} ]);
  const r=await CS.check({force:true});
  assert.equal(r.ok,true);
  const a=CS.state.analysis;
  assert.deepEqual({...a.counts},{neu:3,geaendert:0,entfaellt:0,gleich:0,konflikt:0,fehler:5});
  const texts=a.items.filter(i=>i.kind==='fehler').map(i=>i.text).join(' | ');
  for(const t of ['unbekannt','nicht planbar','Kein Veranstaltungstag','Überschneidung mit vorhandenem DP2-Dienst','Übernahmeschlüssel'])assert.match(texts,new RegExp(t));
  const out=await CS.apply({});
  assert.deepEqual([out.added,out.updated,out.removed,out.skipped],[3,0,0,5]);
  const club=active(K).filter(s=>s.planningSource==='club_import');
  assert.equal(club.length,3);
  for(const s of club){assert.equal(s.layer,'planned');assert.equal(s.status,'draft');assert.match(s.sourceImportKey,/^CLUB-\d{4}-\d{2}-\d{2}-KC-P-/);assert.ok(s.clubShiftFp&&s.clubRowFp);assert.ok(/^S-/.test(s.id));}
  const long=club.find(s=>s.personId===P[0]);assert.equal(long.breakMinutes,30);assert.equal(long.breakSegments.length,1,'Pause nach DP2-Regel mit Zeitfenster');
  assert.equal(K.shifts.find(s=>s.id==='S-HAND').start,10,'Handdienst unverändert');
  assert.equal(net.acks.length,1);assert.equal(net.acks[0].status,'uebernommen');assert.equal(net.acks[0].result.added,3);
  assert.equal(f.persisted,1);assert.deepEqual(f.staged.map(x=>x[0]),['stage','settle']);assert.equal(f.staged[1][2],true);
  // 2) gleicher Stand noch einmal: nur „unverändert“, keine Dubletten, still bestätigt
  net.pending=stand('U1b',[row(P[0],'2026-12-04',11,17.5),row(P[1],'2026-12-04',15,23,'back','Hinten',45),row(P[2],'2026-12-02',8,14,'neutral','Vorbereitung')]);
  await CS.check({force:true});
  assert.equal(net.acks.at(-1).id,'U1b','unveränderter Stand wird still bestätigt');assert.equal(net.acks.at(-1).result.autoAck,true);
  assert.equal(active(K).filter(s=>s.planningSource==='club_import').length,3,'keine Dubletten');
  // 3) neuer Stand: geändert, entfällt, neu, unverändert + Schutz für in DP2 Geändertes und Ist-Zeiten
  const sA=club.find(s=>s.personId===P[0]),sB=club.find(s=>s.personId===P[1]),sC=club.find(s=>s.personId===P[2]);
  net.pending=stand('U2',[row(P[0],'2026-12-04',12,17.5),row(P[2],'2026-12-02',8,14,'neutral','Vorbereitung'),row(P[4],'2026-12-05',12,16)]);
  await CS.check({force:true});
  let c=CS.state.analysis.counts;
  assert.deepEqual([c.neu,c.geaendert,c.entfaellt,c.gleich,c.konflikt],[1,1,1,1,0]);
  // Planer ändert sA von Hand → Konflikt, Standard behalten
  sA.end=17;
  const a2=CS.analyze(net.pending);assert.equal(a2.counts.konflikt,1);assert.match(a2.items.find(i=>i.kind==='konflikt').reasons.join(),/in DP2 geändert/);
  // sB hat Ist-Zeiten → Entfallen nur mit Wahl
  K.actualShifts=[{id:'A-1',linkedShiftId:sB.id,personId:P[1],date:'2026-12-04',start:15,end:23,status:'recorded',source:'timeclock'}];
  const a3=CS.analyze(net.pending);assert.equal(a3.counts.konflikt,2);assert.equal(a3.counts.entfaellt,0);
  assert.equal(CS.plannedOps(a3,{}).length,1,'ohne Wahl nur das Neue');
  CS.state.analysis=a3; // wie das Öffnen der Vorschau
  const out2=await CS.apply({});
  assert.deepEqual([out2.added,out2.updated,out2.removed,out2.kept],[1,0,0,2]);
  assert.equal(sA.end,17,'Handänderung bleibt');assert.equal(K.shifts.find(s=>s.id===sB.id).status,'draft','Dienst mit Ist bleibt');
  // 4) Wahl „Club-Stand übernehmen“ und echtes Entfallen
  K.actualShifts=[];
  net.pending=stand('U3',[row(P[0],'2026-12-04',12,17.5),row(P[4],'2026-12-05',12,16)]);
  await CS.check({force:true});
  c=CS.state.analysis.counts;assert.deepEqual([c.neu,c.geaendert,c.entfaellt,c.gleich,c.konflikt],[0,0,2,1,1]);
  const out3=await CS.apply({[`CLUB-2026-12-04-${P[0]}`]:'club'});
  assert.deepEqual([out3.added,out3.updated,out3.removed],[0,1,2]);
  assert.equal(sA.start,12);assert.equal(sA.end,17.5);assert.equal(K.shifts.find(s=>s.id===sB.id).status,'deleted','entfällt = gelöscht auf dem DP2-Weg');
  assert.equal(K.shifts.find(s=>s.id===sC.id).status,'deleted');assert.equal(K.shifts.find(s=>s.id==='S-HAND').status,'draft','Handdienst nie angefasst');
  // 5) Wiederaufnahme: von dieser Übernahme entfernt → wieder „neu“; von Hand gelöscht → Konflikt
  K.mutations.deleteShift(K.shifts.find(s=>s.sourceImportKey===`CLUB-2026-12-05-${P[4]}`).id,{reason:'Hand'});
  const a4=CS.analyze(stand('U4',[row(P[1],'2026-12-04',15,23,'back','Hinten',45),row(P[4],'2026-12-05',12,16),row(P[0],'2026-12-04',12,17.5)]));
  assert.equal(a4.items.find(i=>i.row.personId===P[1]).kind,'neu');
  const hand=a4.items.find(i=>i.row.personId===P[4]);assert.equal(hand.kind,'konflikt');assert.match(hand.reasons[0],/gelöscht/);
  // 6) Veröffentlichungsweg: Sollplan-Brücke macht Zeilen daraus, entfallene/gelöschte nicht
  class FixedDate extends Date{constructor(...a){if(a.length)super(...a);else super('2026-12-01T10:00:00Z');}static now(){return Date.parse('2026-12-01T10:00:00Z');}}
  const bctx=vm.createContext({window:{KCDP:K},Intl,Date:FixedDate,console,setTimeout,clearTimeout});vm.runInContext(bridgeSource,bctx);
  const pub=K.planManagerBridge.buildRows();
  assert.deepEqual(pub.map(x=>[x.sourceShiftId===sA.id?'sA':x.sourceShiftId,x.personId,x.date,x.start,x.end,x.zone,x.breakMinutes]),[['S-HAND',P[3],'2026-12-04','10:00','13:00','front',0],['sA',P[0],'2026-12-04','12:00','17:30','front',0]],'nur aktive Dienste, entfallene/gelöschte nicht');
}
// 7) Vorschau veraltet / Rechte / Rücknahme / Bestätigung fehlt / Verwerfen
{
  const f=await fixture(),{K,net}=f,CS=K.clubSollInbox;
  net.pending=stand('V1',[row(P[0],'2026-12-04',11,15),row(P[1],'2026-12-05',12,16)]);
  await CS.check({force:true});
  K.shifts.push({id:'S-X',personId:P[0],date:'2026-12-04',start:14,end:16,zone:'front',area:'Verkauf',layer:'planned',breakMinutes:0,status:'draft'});
  await assert.rejects(CS.apply({}),/seit der Vorschau geändert/);assert.equal(K.shifts.length,1);
  K.shifts=[];await CS.check({force:true});
  K.currentUser.role='employee';await assert.rejects(CS.apply({}),/nicht bearbeiten/);K.currentUser.role='planner';
  assert.equal(K.shifts.length,0);
  // Rücknahme: zweites Anlegen scheitert → alles zurück, Warteschlange verworfen
  const orig=K.mutations.saveShift;let n=0;K.mutations.saveShift=function(...a){if(++n===2)throw new Error('Testfehler');return orig.apply(this,a);};
  await assert.rejects(CS.apply({}),/Testfehler/);K.mutations.saveShift=orig;
  assert.equal(K.shifts.length,0,'nichts halb übernommen');assert.deepEqual(f.staged.at(-1),['settle','clubsoll:V1',false]);assert.equal(net.acks.length,0);
  // Bestätigung geht verloren → übernommen, beim nächsten Abruf still bestätigt
  await CS.check({force:true});net.ackFails=true;
  const r=await CS.apply({});assert.equal(r.added,2);assert.match(CS.state.notice,/nachgeholt/);
  net.ackFails=false;await CS.check({force:true});assert.equal(net.acks.at(-1).status,'uebernommen');assert.equal(net.pending,null);
  assert.equal(K.shifts.filter(s=>s.planningSource==='club_import').length,2,'keine Doppelübernahme');
  // Verwerfen ändert nichts
  net.pending=stand('V2',[row(P[2],'2026-12-06',12,16)]);await CS.check({force:true});
  await CS.discard();assert.equal(net.acks.at(-1).status,'verworfen');assert.equal(K.shifts.length,2);
  // Drosselung: kein Abruf in Schleife
  const calls=net.pendingCalls;await CS.check();await CS.check();assert.equal(net.pendingCalls,calls);
  // ohne Planungsrolle kein Abruf-Ergebnis
  K.currentUser.role='employee';const s=await CS.check({force:true});assert.equal(s.reason,'role');
}
// 8) Übersprungene Zeilen (Person in der Club-App nicht eindeutig, Tag nicht veröffentlicht, ausgenommen) → nicht von selbst löschen
{
  const f=await fixture(),{K,net}=f,CS=K.clubSollInbox;
  net.pending=stand('W1',[row(P[0],'2026-12-04',11,15),row(P[1],'2026-12-05',12,16),row(P[2],'2026-12-06',12,16),row(P[3],'2026-12-07',14,18)]);
  await CS.check({force:true});await CS.apply({});assert.equal(K.shifts.length,4);
  const w2=stand('W2',[]);w2.uebersprungen=[{name:'Frank B',date:'2026-12-04',personIds:[P[0],'KC-P-M0099'],grund:'Person in der Club-App nicht eindeutig'},{name:'Dieter Z',date:'2026-12-05',personId:P[1],grund:'Tag nicht veröffentlicht'},{name:'',date:null,personId:P[2],grund:'In der Club-App ausgenommen'}];
  const a=CS.analyze(w2);
  assert.deepEqual({...a.counts},{neu:0,geaendert:0,entfaellt:1,gleich:0,konflikt:3,fehler:0},'nur die vierte Schicht entfällt wirklich');
  assert.deepEqual([...a.items.filter(i=>i.skip).map(i=>i.skip)].sort(),['In der Club-App ausgenommen','Person in der Club-App nicht eindeutig','Tag nicht veröffentlicht']);
  assert.equal(CS.plannedOps(a,{}).length,1,'Standard: behalten');
  // 9) Speichern scheitert → Schichten UND Merkliste (removed/lastApplied) zurück
  net.pending=w2;await CS.check({force:true});
  const before=JSON.stringify(CS.store());K.cloudPrimary={active:()=>true};K.persistAll=async()=>({confirmed:false});
  await assert.rejects(CS.apply({}),/nicht von Supabase bestätigt/);
  assert.equal(JSON.stringify(CS.store()),before,'Merkliste unverändert');assert.equal(K.shifts.filter(s=>s.status==='deleted').length,0,'nichts gelöscht');
  assert.equal(net.acks.filter(x=>x.id==='W2').length,0,'nicht bestätigt');
  // 10) Hinweis/Abruf nur im Register „Sollplan“, nicht im Dashboard oder der Stundenmatrix (beide layer 'planned')
  K.state.layer='planned';K.v020ShellState={active:'matrix'};assert.equal(CS.plannedRegister(),false);
  K.v020ShellState.active='dashboard';assert.equal(CS.plannedRegister(),false);
  K.v020ShellState.active='planned';assert.equal(CS.plannedRegister(),true);
}
console.log('✓ Club-App-Sollplan: Prüfungen, neu/geändert/entfällt/unverändert, Schutz in DP2 geänderter Dienste und Ist-Zeiten, keine Dubletten, Rücknahme, Rechte, Bestätigung/Verwerfen, Veröffentlichungszeilen');
