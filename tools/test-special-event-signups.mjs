// KICC-F-100 Phase 7: Zusagen (Anreise, Plätze, Startort) und Fahrgemeinschaften (Vorschlag, Planer, veröffentlichen, Fahrtrolle).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const context=vm.createContext({window:{},document:{readyState:'complete',write:()=>{}},console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/special-events.js','src/core/special-event-signups.js','src/core/hour-reports.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,S=K.specialEventsCore,U=K.specialEventSignupsCore,H=K.hourReportsCore;
K.recordAudit=()=>{};K.sync={enqueue:()=>{}};K.persistAll=async()=>true;
assert.equal(U.VERSION,'0.1.0');
const m=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);
const ev=S.create({titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen'});
const as=async(pid,input)=>{K.currentUser={personId:pid,displayName:pid,role:'employee'};return U.answer(ev.id,input);};

// Antworten und Regeln
await as(m[0],{antwort:'ja',anreise:'fahrer',plaetze:2,startort:'Werne'});
await as(m[1],{antwort:'ja',anreise:'fahrer',plaetze:3,startort:'Hamm'});
await as(m[2],{antwort:'ja',anreise:'mitfahrer',startort:'Hamm'});
await as(m[3],{antwort:'ja',anreise:'mitfahrer',startort:'Werne'});
await as(m[4],{antwort:'vielleicht',anreise:'mitfahrer',startort:'Werne'});
await as(m[5],{antwort:'ja',anreise:'mitfahrer',startort:'Lünen'});
await as(m[6],{antwort:'ja',anreise:'selbst',startort:'Werne'});
await as(m[7],{antwort:'nein',anreise:'fahrer',plaetze:4,startort:'Werne'});
assert.equal(U.mine(ev.id,m[6]).startort,null,'Wer selbst kommt, braucht keinen Startort');
assert.equal(U.mine(ev.id,m[7]).anreise,null,'Nein → keine Anreise');
await assert.rejects(()=>as(m[8],{antwort:'ja'}),/wie du hinkommst/);
await assert.rejects(()=>as(m[8],{antwort:'ja',anreise:'mitfahrer'}),/Startort/);
await assert.rejects(()=>as(m[8],{antwort:'ja',anreise:'mitfahrer',startort:'Musterstraße 5'}),/Startort/,'Nur Orte aus der Auswahl, keine Adressen');
await as(m[0],{antwort:'ja',anreise:'fahrer',plaetze:2,startort:'Werne',bemerkung:'Kombi'});
assert.equal(U.forEvent(ev.id).filter(s=>s.personId===m[0]).length,1,'Ändern statt doppelt');assert.equal(U.mine(ev.id,m[0]).version,2);
const c=U.counts(ev.id);assert.equal(c.ja,6);assert.equal(c.vielleicht,1);assert.equal(c.nein,1);assert.equal(c.fahrer,2);assert.equal(c.plaetze,5);assert.equal(c.mitfahrer,4);

// Vorschlag: gleicher Startort zuerst, dann auffüllen; „ja“ vor „vielleicht“
const p=U.suggest(ev.id);
const werne=p.groups.find(g=>g.fahrerId===m[0]),hamm=p.groups.find(g=>g.fahrerId===m[1]);
assert.ok(werne.mitfahrer.includes(m[3])&&hamm.mitfahrer.includes(m[2]),'Gleicher Startort zuerst');
assert.equal(werne.mitfahrer.length+hamm.mitfahrer.length,4,'Alle vier Mitfahrer untergebracht (5 Plätze)');
assert.deepEqual([...p.ohneFahrt],[]);
assert.ok(werne.mitfahrer.length<=2&&hamm.mitfahrer.length<=3,'Plätze nicht überbucht');

// Planer übernimmt und veröffentlicht; Doppelbelegung wird abgewiesen
K.currentUser={personId:'planer',displayName:'Planer',role:'planner'};
const published=[];K.supabaseConnection={publishCarpools:async x=>{published.push(x);return {ok:true}}};
await assert.rejects(()=>U.saveCarpools(ev.id,[{fahrerId:m[0],mitfahrer:[m[3]]},{fahrerId:m[1],mitfahrer:[m[3]]}]),/mehreren Fahrgemeinschaften/);
await U.saveCarpools(ev.id,p.groups);
assert.equal(published.length,1);assert.equal(published[0].rows.length,2);assert.equal(published[0].specialEventId,ev.id);
assert.equal(U.roleFor(ev.id,m[0]),'fahrer');assert.equal(U.roleFor(ev.id,m[3]),'mitfahrer');assert.equal(U.roleFor(ev.id,m[6]),null);
assert.equal(U.carpoolOf(ev.id,m[3]).fahrerId,m[0]);
K.currentUser={personId:m[3],displayName:'x',role:'employee'};
await assert.rejects(()=>U.saveCarpools(ev.id,[]),/nicht festlegen/,'Nur der Planer legt Fahrgemeinschaften fest');

// Fahrtrolle in der Stundenmeldung
K.currentUser={personId:'planer',displayName:'Planer',role:'planner'};
S.setTermin(ev.id,{terminStatus:'FEST',datumVon:'2027-01-12'});
K.currentUser={personId:m[0],displayName:'x',role:'employee'};
const r=await H.submit({specialEventId:ev.id,date:'2027-01-12',taetigkeit:'kochen',eintraege:[{personId:m[0],start:7,end:15,fahrtRolle:'fahrer'},{personId:m[3],start:7,end:15,fahrtRolle:'mitfahrer'}]},{today:'2027-01-13'});
assert.deepEqual([...r.created.map(x=>x.fahrtRolle)],['fahrer','mitfahrer']);
assert.match(H.validate({specialEventId:ev.id,date:'2027-01-12',taetigkeit:'kochen',eintraege:[{personId:m[1],start:7,end:15,fahrtRolle:'beifahrer'}]},{today:'2027-01-13'}).join(' '),/Fahrer, Mitfahrer/);
assert.equal(H.fromRemote({id:'x',person_id:m[1],work_date:'2027-01-12',start_h:1,end_h:2,fahrt_rolle:'fahrer'}).fahrtRolle,'fahrer');

// Planer liest Zusagen aus Supabase; Club-App-Transport
K.supabaseConnection.signupsList=async()=>[{id:'u1',special_event_id:ev.id,person_id:m[9],antwort:'ja',anreise:'mitfahrer',plaetze:0,startort:'Hamm',version:1}];
assert.equal((await U.pull()).received,1);assert.equal(U.mine(ev.id,m[9]).startort,'Hamm');
const sent=[];K.signupTransport={save:async x=>{sent.push(x);return {row:{id:'u2',special_event_id:x.specialEventId,person_id:m[10],antwort:x.antwort,anreise:x.anreise,plaetze:x.plaetze,startort:x.startort,version:1}}}};
K.currentUser={personId:m[10],displayName:'x',role:'employee'};
await U.answer(ev.id,{antwort:'ja',anreise:'fahrer',plaetze:4,startort:'Selm'});
assert.equal(sent[0].plaetze,4);assert.equal(U.mine(ev.id,m[10]).anreise,'fahrer');
const snap=U.snapshot();U.restore({signups:[],carpools:[]});assert.equal(U.forEvent(ev.id).length,0);U.restore(snap);assert.ok(U.forEvent(ev.id).length>=10);
console.log('✓ Zusagen & Fahrgemeinschaften: Antworten, Startort ohne Adresse, Vorschlag nach Ort, keine Überbuchung, Planer veröffentlicht, Fahrtrolle in der Meldung');
