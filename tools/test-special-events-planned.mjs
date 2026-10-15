// Build 290 DP2-F-SE-08: vorläufige Einteilung „vorgesehen“ und Abgleich mit dem veröffentlichten Stand (pull vor publish).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const context=vm.createContext({window:{},document:{readyState:'complete',write:()=>{}},console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/special-events.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,S=K.specialEventsCore;
const audit=[];K.recordAudit=(action,meta)=>audit.push({action,...meta});K.sync={enqueue:()=>{}};K.persistAll=async()=>true;
const m=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);
const helper=K.people.find(p=>p.personType&&p.personType!=='member');

// Vorgesehen: nur aktive Mitglieder, ohne Doppelte, wird veröffentlicht
const ev=S.create({titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen',terminStatus:'GEPLANT',datumVon:'2026-11-28',vorgesehen:[m[0],m[1],m[1],' ']});
assert.deepEqual([...ev.vorgesehen],[m[0],m[1]]);
assert.throws(()=>S.create({titel:'X',art:'kochen',vorgesehen:['KC-P-GIBTSNICHT']}),/Nur aktive Mitglieder/);
if(helper)assert.throws(()=>S.create({titel:'X',art:'kochen',vorgesehen:[helper.personId]}),/Nur aktive Mitglieder/);
assert.throws(()=>S.create({titel:'X',art:'kochen',vorgesehen:m.slice(0,31).concat(Array.from({length:31},(_,i)=>m[i%m.length]+'x'+i))}),/Höchstens 30|Nur aktive/);
const upd=S.update(ev.id,{vorgesehen:[m[2]]});assert.deepEqual([...upd.vorgesehen],[m[2]]);
assert.equal(S.update(ev.id,{bemerkung:'vorläufig'}).vorgesehen.length,1,'Andere Änderung behält die Einteilung');
assert.deepEqual([...S.publishRows().find(r=>r.sourceId===ev.id).vorgesehen],[m[2]]);
assert.deepEqual([...S.plannedFor(m[2]).map(e=>e.id)],[ev.id]);assert.equal(S.plannedFor(m[0]).length,0);

// Pull: nur in Supabase stehende Einsätze kommen dazu, neuere werden übernommen, lokal Neueres bleibt, nichts wird entfernt
const remote=[
  {source_id:'SE-GK-ABHOLUNG',event_id:'KC-WM-2026',termin_status:'GEPLANT',datum_von:'2026-12-29',datum_bis:'2026-12-29',payload:{sourceId:'SE-GK-ABHOLUNG',titel:'Grünkohl abholen',ort:'Dortmund → Hamm',art:'transport',terminStatus:'GEPLANT',datumVon:'2026-12-29',datumBis:'2026-12-29',vorgesehen:[m[3],m[0]],version:1}},
  {source_id:ev.id,event_id:'KC-WM-2026',termin_status:'OFFEN',payload:{sourceId:ev.id,titel:'Alt',art:'kochen',terminStatus:'OFFEN',version:1}}
];
const calls=[];K.supabaseConnection={specialEventsList:async x=>{calls.push('list');return remote;},publishSpecialEvents:async x=>{calls.push('publish');return {ok:true,upserted:x.rows.length,rows:x.rows};}};
const r=await S.pull();
assert.equal(r.added,1);assert.equal(r.updated,0,'Lokal neuere Version bleibt');
const ab=S.get('SE-GK-ABHOLUNG');assert.equal(ab.titel,'Grünkohl abholen');assert.equal(ab.effective.datumVon,'2026-12-29');assert.equal(ab.effective.terminStatus,'GEPLANT');assert.deepEqual([...ab.vorgesehen],[m[3],m[0]]);
assert.equal(S.get(ev.id).titel,'Grünkohl kochen');
remote[0].payload={...remote[0].payload,version:5,datumVon:'2026-12-30',datumBis:'2026-12-30'};
assert.equal((await S.pull()).updated,1);assert.equal(S.get('SE-GK-ABHOLUNG').effective.datumVon,'2026-12-30');
assert.equal((await S.pull()).updated,0,'Gleiche Version → keine Änderung');
assert.ok(audit.some(a=>a.action==='special_event.pull'));

// Veröffentlichen gleicht vorher ab – ein nur in Supabase stehender Einsatz geht nicht verloren
remote.push({source_id:'SE-NUR-REMOTE',event_id:'KC-WM-2026',termin_status:'OFFEN',payload:{sourceId:'SE-NUR-REMOTE',titel:'Getränke mischen',art:'vorbereitung_zuhause',terminStatus:'OFFEN',version:1}});
calls.length=0;const pub=await S.publish();
assert.deepEqual([...calls],['list','publish']);assert.ok(pub.rows.some(x=>x.sourceId==='SE-NUR-REMOTE'));
K.supabaseConnection.specialEventsList=async()=>{throw new Error('offline');};
await assert.rejects(()=>S.publish(),/nicht abgeglichen/,'Ohne Abgleich wird nicht veröffentlicht');
console.log('✓ Sondereinsätze vorgesehen: nur Mitglieder, veröffentlicht, Abgleich aus Supabase ohne Verlust, Veröffentlichen erst nach Abgleich');
