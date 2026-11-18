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
 assert.equal(K.planTransfer.groups(K.planTransfer.wishCandidates()).existing.length,1);
 const outActual=await K.planTransfer.apply('actual',[]);
 assert.match(outActual.error,/kein Ist-Nachweis/);
 assert.equal(f.persisted,1);
 assert.equal(K.actualShifts.length,0);
}
for(const role of ['planner','admin']){
 const f=fixture(),{K,planned}=f;K.currentUser.role=role;K.shifts=[planned('S')];
 const row={linkedShiftId:'S',personId:K.shifts[0].personId,date:K.shifts[0].date,start:12,end:14,breakMinutes:0};
 assert.throws(()=>K.actual.saveActual({...row,source:'planned_transfer'}),/kein Ist-Nachweis/);
 assert.throws(()=>K.actual.saveActual({...row,source:'timeclock'},{source:'planned_transfer'}),/kein Ist-Nachweis/);
 assert.throws(()=>K.actual.saveActual({...row,source:'planned_transfer'},{source:'timeclock'}),/kein Ist-Nachweis/);
 assert.equal(K.actualShifts.length,0);
 const actual=K.actual.saveActual({...row,source:'timeclock'}).record;
 assert.equal(actual.linkedShiftId,'S');
 assert.equal(actual.source,'timeclock');
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
{
 const {K,wish,planned}=fixture();K.wishes=[wish('C','available',10,23),wish('W','preferred',10,19)];
 assert.equal(K.planTransfer.wishCandidates()[0].blocked,true);
 K.wishes[1].end=15;K.shifts=[{...planned('S'),start:15,end:18}];
 assert.equal(K.planTransfer.wishCandidates()[0].blocked,false);
 K.shifts[0].end=19;assert.equal(K.planTransfer.wishCandidates()[0].blocked,true);
 K.shifts=[];K.wishes.shift();
 assert.equal((await K.planTransfer.apply('wish',K.planTransfer.wishCandidates())).saved,0,'missing availability requires a planner decision');
}
for(const change of ['block','permission','time']){
 const f=fixture(),{K,wish}=f;K.wishes=[wish('C','available',11,17),wish('W')];
 const items=K.planTransfer.wishCandidates();
 if(change==='block')K.wishes.push(wish('B','unavailable'));
 if(change==='permission')K.currentUser.role='employee';
 if(change==='time')K.wishes[1].end=15;
 const out=await K.planTransfer.apply('wish',items);
 assert(out.error,change);assert.equal(out.saved,0);assert.equal(f.persisted,0);
}
console.log('Plantransfer OK: Wunsch → Soll, Sperren, Rechte, Duplikate und veraltete Vorschau; kein Soll → Ist, echte Kassenzeit weiterhin zulässig.');
