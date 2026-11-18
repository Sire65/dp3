import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const K={wishes:[],people:Array.from({length:8},(_,i)=>({personId:String(i),name:'Person '+i,active:true})),memberUxData:{assistantStandby:{}},days:[],demandMatrix:{},shifts:[{id:'keep-planned'}],actualShifts:[{id:'keep-actual'}],requirementFor:()=>({total:3,front:2,back:1}),personPlanningAllowed:()=>true,staffing:{isBlockedDate:()=>false}};K.person=id=>K.people.find(p=>p.personId===id);K.wishesFor=date=>K.wishes.filter(w=>w.date===date);
vm.runInNewContext(await fs.readFile(new URL('../src/core/wish-staffing.js',import.meta.url),'utf8'),{window:{KCDP:K},Set,Map,Number,Math,Object});const day={date:'2026-12-04',type:'market',start:10,end:23},core=K.wishStaffing;
function wish(id,zone='B',type='available',start=10,end=11,extra={}){return{personId:String(id),date:day.date,wishZone:zone,wishType:type,start,end,status:'confirmed',...extra};}function slot(rows){K.wishes=rows;return core.slot(day,10,11);}
let r=slot([wish(0),wish(1),wish(2)]);assert.equal(r.status,'exact');assert.equal(r.parts.length,1,'unchanged quarters merge into one readable interval');assert.equal(r.missing,0);assert.equal(r.counts.front.max,0);assert.equal(r.counts.flex.min,3);
r=slot([wish(0),wish(1)]);assert.equal(r.status,'under');assert.equal(r.missing,1,'two flex people cannot fill three area gaps');
r=slot([wish(0,'V'),wish(1,'V'),wish(2,'H')]);assert.equal(r.status,'exact');
r=slot([wish(0,'V'),wish(1,'V'),wish(2,'V')]);assert.equal(r.status,'exact');assert.equal(r.missing,0);assert.equal(r.areaMissing,1,'area shortage remains informational and cannot turn exact headcount red');
r=slot([wish(0),wish(0,'V'),wish(0,'H'),wish(0,'B','preferred'),wish(1),wish(2)]);assert.equal(r.counts.total.max,3);assert.equal(r.counts.flex.max,3);assert.equal(r.counts.preferred.max,1);assert.equal(r.parts[0].normal.front+r.parts[0].normal.back+r.parts[0].normal.flex,3,'each person belongs to one pool');
r=slot([wish(0),wish(1),wish(2,'B','if_needed'),wish(2,'B','preferred')]);assert.equal(r.status,'under');assert.equal(r.counts.total.max,2);assert.equal(r.counts.reserve.min,1);assert.equal(r.counts.preferred.max,0,'conditional preferred time is not unconditional availability');
r=slot([wish(0,'B','available',10,10.5),wish(1,'B','available',10.5,11)]);assert.equal(r.counts.total.min,1);assert.equal(r.counts.total.max,1);assert.equal(r.missing,2,'different half-hour workers must not count as two together');
r=slot([wish(0,'B','available',10,10.5),wish(1),wish(2)]);assert.equal(r.counts.total.min,2);assert.equal(r.counts.total.max,3);assert.equal(r.status,'under');
r=slot([wish(0),wish(1),wish(2),wish(2,'B','unavailable',10.25,10.75)]);assert.equal(r.counts.total.min,2);assert.equal(r.status,'under','time block wins over can');
r=slot([wish(0),wish(1),wish(2),wish(2,'B','unavailable',0,24,{scope:'day'})]);assert.equal(r.counts.total.max,2,'whole day block always wins');
r=slot([wish(0,'B','preferred'),wish(1,'B','preferred'),wish(2,'B','preferred')]);assert.equal(r.status,'exact','legacy wish without separate can remains countable');
r=slot([wish(0,'B','available',12,14),wish(0,'B','preferred',10,11)]);assert.equal(r.counts.total.max,0,'wish outside explicit can is not new availability');assert.equal(r.conflicts,1);
K.people[2].active=false;r=slot([wish(0),wish(1),wish(2)]);assert.equal(r.counts.total.max,2);K.people[2].active=true;
K.staffing.isBlockedDate=id=>id==='2';r=slot([wish(0),wish(1),wish(2)]);assert.equal(r.counts.total.max,2);K.staffing.isBlockedDate=()=>false;
r=slot([wish(0,'Z'),wish(1,'B','available',10,11,{status:'deleted'}),wish(2,'B','preferred',10,11,{status:'rejected'})]);assert.equal(r.counts.total.max,0);
K.memberUxData.assistantStandby={'0':{[day.date]:{answer:'yes',slots:[{start:10,end:10.5}]}},'1':{[day.date]:{answer:'no',slots:[{start:10,end:11}]}}};r=slot([wish(0),wish(1),wish(2)]);assert.equal(r.counts.standby.min,0);assert.equal(r.counts.standby.max,1);assert.equal(r.counts.total.min,3,'standby is separate and may overlap own availability');
K.requirementFor=()=>({total:2,front:1,back:1});r=slot([wish(0,'V'),wish(0,'H','if_needed'),wish(1,'V')]);assert.equal(r.status,'exact','conditional area does not change total headcount color');assert.equal(r.counts.flex.max,0);
K.requirementFor=()=>({total:3,front:null,back:null});r=slot([wish(0),wish(1),wish(2)]);assert.equal(r.status,'exact');assert(r.simple);
assert.equal(K.shifts[0].id,'keep-planned');assert.equal(K.actualShifts[0].id,'keep-actual');const before=JSON.stringify(K.wishes);core.slot(day,10,11);assert.equal(JSON.stringify(K.wishes),before);
// Independent exhaustive allocation: try every split of the shared flex pool.
K.people=Array.from({length:40},(_,i)=>({personId:String(i),name:'P'+i,active:true}));K.memberUxData={assistantStandby:{}};
for(let f=0;f<4;f++)for(let h=0;h<4;h++)for(let b=0;b<4;b++)for(let vf=0;vf<4;vf++)for(let hb=0;hb<4;hb++){
 K.requirementFor=()=>({total:vf+hb,front:vf,back:hb});const rows=[];let id=0;for(let n=0;n<f;n++)rows.push(wish(id++,'V'));for(let n=0;n<h;n++)rows.push(wish(id++,'H'));for(let n=0;n<b;n++)rows.push(wish(id++,'B'));
 let best=0;for(let useFront=0;useFront<=b;useFront++)best=Math.max(best,Math.min(vf,f+useFront)+Math.min(hb,h+b-useFront));
 const result=slot(rows);assert.equal(result.areaMissing,vf+hb-best,'shared pool remains valid information');assert.equal(result.missing,Math.max(0,vf+hb-f-h-b));assert.equal(result.status,f+h+b<vf+hb?'under':f+h+b>vf+hb?'over':'exact','only headcount controls the color');assert.equal(result.counts.total.max,f+h+b);
}
console.log('PASS wish staffing: shared flex pool, disjoint people, reserve, half-hours, blocks, legacy wishes, invalid wish/can, inactive/blocked persons, separate explicit standby and no plan mutation.');
