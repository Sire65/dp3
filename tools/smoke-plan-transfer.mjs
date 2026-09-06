import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const files=['src/core/model.js','src/core/auth.js','src/core/planning.js','src/core/actual.js','src/ui/plan-transfer.js'];
const sources=await Promise.all(files.map(f=>readFile(new URL('../'+f,import.meta.url),'utf8')));
function fixture(){
  const elements=new Map();
  function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',classList:{values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)},contains(v){return this.values.has(v)}},querySelector(sel){return element(id+sel)},style:{}});return elements.get(id);}
  const document={readyState:'loading',addEventListener(){},getElementById(id){return id==='planTransferProgress'&&!elements.has(id)?null:element(id)},createElement(){return element('planTransferProgress')},body:{classList:element('body').classList,appendChild(){}}};
  const context=vm.createContext({window:{},document,console,setTimeout,clearTimeout,confirm:()=>true});
  sources.forEach((s,i)=>vm.runInContext(s,context,{filename:files[i]}));
  const K=context.window.KCDP,p=K.people.find(p=>p.active),date='2026-12-04';
  K.currentUser={role:'planner',personId:p.personId};K.shifts=[];K.wishes=[];K.actualShifts=[];K.state.view='day';K.day=()=>K.days.find(d=>d.date===date);
  let persisted=0;K.persistAll=async()=>{persisted++};K.v020Shell={select(){}};
  const wish=(id,type='preferred',start=12,end=14)=>({id,personId:p.personId,date,start,end,wishType:type,wishZone:'V',status:'confirmed'});
  const planned=(id,status='draft')=>({id,personId:p.personId,date,start:12,end:14,layer:'planned',zone:'front',area:'Test',status,breakMinutes:0});
  return{K,wish,planned,element,get persisted(){return persisted}};
}
{
 const f=fixture(),{K,wish}=f;K.wishes=[wish('C','available',11,17),wish('W')];
 let out=await K.planTransfer.apply('wish',K.planTransfer.wishCandidates());assert.equal(out.saved,1);assert.equal(out.error,null);
 assert.equal(K.shifts[0].sourceWishId,'W');
 out=await K.planTransfer.apply('actual',K.planTransfer.actualCandidates());assert.equal(out.saved,1);assert.equal(out.error,null);
 assert.equal(K.actualShifts[0].linkedShiftId,K.shifts[0].id);assert.equal(K.actualShifts[0].comparison.status,'match');assert.equal(f.persisted,2);
 assert.equal(K.auth.has('roster.actual.correct'),false);
 assert.throws(()=>K.actual.correctActual(K.actualShifts[0].id,{end:15},{reason:'Test'}),/korrigieren/);
 out=await K.planTransfer.apply('actual',K.planTransfer.actualCandidates());assert.equal(out.saved,0);assert.equal(K.actualShifts.length,1);
 assert.equal(K.planTransfer.groups(K.planTransfer.wishCandidates()).existing.length,1);
}
for(const status of ['cancelled','absent','failed','deleted']){
 const {K,planned}=fixture();K.shifts=[planned('S',status)];assert.equal(K.planTransfer.actualCandidates().length,0,status);
}
{
 const {K,planned}=fixture();K.shifts=[planned('S1'),planned('S2')];
 const x=K.planTransfer.actualCandidates()[1];assert.equal(K.actual.matchCandidate(x.candidate).ambiguous,true);
 K.actual.saveActual(x.candidate);assert.equal(K.actualShifts[0].linkedShiftId,'S2','Explicit source must survive an ambiguous match');
 assert.equal(K.planTransfer.groups(K.planTransfer.actualCandidates()).existing.length,2,'Equivalent times must not be booked twice');
}
for(const [start,end,scope] of [[12,14,'time'],[10,13,'time'],[13,18,'time'],[0,1,'day']]){
 const {K,wish}=fixture();K.wishes=[wish('W','preferred',11,17),{...wish('B','unavailable',start,end),scope}];
 assert.equal(K.planTransfer.wishCandidates()[0].blocked,true,'Every partial overlap and whole-day block must stop transfer');
}
{
 const {K,wish}=fixture();K.wishes=[wish('W'),wish('B','unavailable',14,16)];assert.equal(K.planTransfer.wishCandidates()[0].blocked,false,'Touching intervals do not overlap');
 const rows=[{blocked:false,existing:null,issues:[]},{blocked:false,existing:null,issues:[{level:'warn'}]},{blocked:true,issues:[{level:'error'}]},{existing:{id:'S'},issues:[{level:'info'}]}];
 const g=K.planTransfer.groups(rows);assert.deepEqual(Object.values(g).map(x=>x.length),[1,1,1,1]);
}
for(const role of ['employee','read_only','duty_manager']){
 const f=fixture(),{K,planned}=f;K.shifts=[planned('S')];K.currentUser.role=role;
 assert.equal(K.planTransfer.actualCandidates()[0].blocked,true);
 const out=await K.planTransfer.apply('actual',K.planTransfer.actualCandidates());assert.equal(out.saved,0);assert(out.error);assert.equal(f.element('planTransferProgress').classList.contains('open'),false);
}
{
 const {K,planned}=fixture();K.shifts=[planned('S')];const row=K.planTransfer.actualCandidates()[0].candidate;
 for(const patch of [{id:'A-existing'},{end:15},{linkedShiftId:'missing'},{personId:'other'}])assert.throws(()=>K.actual.saveActual({...row,...patch}),/Solldienst/);
 K.actualWorkflow.status='closed';assert(K.planTransfer.actualCandidates()[0].blocked);assert.throws(()=>K.actual.saveActual(row),/abgeschlossen/);
}
for(const change of ['status','times','block','permission']){
 const f=fixture(),{K,planned,wish}=f;K.shifts=[planned('S')];K.wishes=[wish('W')];
 if(change==='block')K.shifts=[];
 const kind=change==='block'?'wish':'actual',items=kind==='wish'?K.planTransfer.wishCandidates():K.planTransfer.actualCandidates();
 if(change==='status')K.shifts[0].status='absent';if(change==='times')K.shifts[0].end=15;if(change==='block')K.wishes.push(wish('B','unavailable'));if(change==='permission')K.currentUser.role='employee';
 const out=await K.planTransfer.apply(kind,items);assert(out.error,change);assert.equal(out.saved,0);assert.equal(f.element('planTransferProgress').classList.contains('open'),false);
}
{
 const f=fixture(),{K,planned}=f;K.shifts=[planned('S1'),{...planned('S2'),start:15,end:17}];
 const save=K.actual.saveActual;let calls=0;K.actual.saveActual=(...args)=>{if(++calls===2)throw Error('Testfehler');return save(...args)};
 const out=await K.planTransfer.apply('actual',K.planTransfer.actualCandidates());assert.equal(out.saved,1);assert.equal(out.error,'Testfehler');assert.equal(f.persisted,1);assert.equal(out.persisted,true);
 assert.match(f.element('modal').innerHTML,/1 Einträge übernommen und gespeichert/);assert.equal(f.element('planTransferProgress').classList.contains('open'),false);
}
{
 const f=fixture(),{K,planned}=f;K.shifts=[planned('S')];K.persistAll=async()=>{throw Error('Speicher voll')};
 const items=K.planTransfer.actualCandidates();const first=K.planTransfer.apply('actual',items);const second=await K.planTransfer.apply('actual',items);assert.equal(second,undefined);
 const out=await first;assert.equal(out.saved,1);assert.equal(out.persisted,false);assert.match(out.error,/Speichern fehlgeschlagen/);assert.equal(f.element('planTransferProgress').classList.contains('open'),false);
}
console.log('Plantransfer-Smoke-Test OK: Wunsch → Soll → Ist, Rollen, Sperren, Status, Herkunft, Duplikate, Vorschau, veraltete Daten und Fehlerbehandlung');
