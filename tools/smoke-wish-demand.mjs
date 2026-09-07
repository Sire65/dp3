import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile(new URL('../src/core/wish-demand.js',import.meta.url),'utf8');
function setup(){const K={state:{step:30},currentUser:{personId:'me'},days:[{date:'2026-12-04',start:11,end:23},{date:'2026-12-05',start:11,end:23}],wishes:[],shifts:[],demandMatrix:{},baseRequirementFor:(d,t)=>({front:2,back:2,total:4})};vm.runInNewContext(source,{window:{KCDP:K}});const w=(id,zone='V',start=14,end=18,date='2026-12-04',type='preferred',personId=id)=>({id,personId,date,start,end,wishType:type,wishZone:zone,status:'confirmed'});return{K,w,c:w('candidate','V',14,18,'2026-12-04','preferred','me')}}
{
 const {K,w,c}=setup();assert.equal(K.wishDemand.evaluate(c).rating,'Sehr passend');K.wishes=[w('a'),w('b')];assert.equal(K.wishDemand.evaluate(c).parts[0].status,'full');K.wishes.push(w('c'));let r=K.wishDemand.evaluate(c);assert.equal(r.parts[0].status,'over');assert.equal(r.parts[0].after.front,4);assert.equal(K.wishDemand.evaluate({...c,wishZone:'H'}).parts[0].status,'gap');
 K.wishes=[w('a','V',14,16),w('b','V',14,16)];r=K.wishDemand.evaluate({...c,end:19});assert.equal(r.gapHours,3);assert.equal(r.rating,'Teilweise passend');assert(r.parts.some(x=>x.start===16&&x.status==='gap'));
 K.wishes=[w('z','Z'),w('flex','B')];r=K.wishDemand.evaluate(c);assert.equal(r.parts[0].counts.front,0);assert.equal(r.parts[0].counts.special,1);assert.equal(r.parts[0].counts.flex,1);
 K.wishes=[w('a'),w('a2','V',14,18,c.date,'preferred','a')];assert.equal(K.wishDemand.evaluate(c).parts[0].counts.front,1,'One person counted once');
 K.wishes=[w('a'),w('b')];r=K.wishDemand.evaluate(c);assert.equal(r.parts[0].people[0].start,14);assert.equal(r.parts[0].people[0].end,18);
}
{
 const {K,w,c}=setup();K.wishes=[w('a','V',11,18),w('b','V',11,18),w('can','V',11,23,c.date,'available','me')];let a=K.wishDemand.alternatives(c);assert.equal(a[0].date,c.date);assert.equal(a[0].start,18,'Gap immediately after the desired time');assert.equal(a[0].end,22);
 K.shifts=[{...w('shift','V',18,23,c.date,'preferred','me'),layer:'planned'}];assert.equal(K.wishDemand.alternatives(c).length,0);
 K.shifts=[];K.wishes.push(w('block','V',18,23,c.date,'unavailable','me'));assert.equal(K.wishDemand.alternatives(c).length,0);
 K.wishes.push(w('can2','V',11,23,'2026-12-05','available','me'));a=K.wishDemand.alternatives(c);assert.equal(a[0].date,'2026-12-05');assert.equal(a[0].end-a[0].start,4);
 assert.deepEqual(JSON.stringify(a),JSON.stringify(K.wishDemand.alternatives(c)),'Stable ranking');
}
{
 const {K,w,c}=setup();K.demandMatrix[c.date]=[{start:11,end:15.25},{start:15.25,end:23}];K.baseRequirementFor=(d,t)=>({front:t<15.25?0:2,back:2,total:t<15.25?2:4});const r=K.wishDemand.evaluate(c);assert(r.parts.some(p=>p.end===15.25));assert.equal(r.gapHours,2.75);
 K.wishes=[w('old','V',14,18,c.date,'preferred','me')];assert.equal(K.wishDemand.evaluate(c,{draft:[c],replaceDates:[c.date]}).parts[0].counts.front,0,'Editing does not count the replaced wish');
}
console.log('Wish demand OK: shortages/full/over, V/H/Z/flexible, partial ranges, exact boundaries, alternatives, availability, own shifts, deduplication and edit exclusion');
