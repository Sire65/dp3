import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const K={people:[],person:id=>({personId:id}),shifts:[],personRules:{},validateShift:()=>[],validateWish:()=>[],validateStandby:()=>[],auth:{require:()=>{}},currentUser:{displayName:'Test'},sync:{enqueue:()=>{}}};
const context=vm.createContext({window:{KCDP:K}});
vm.runInContext(fs.readFileSync('src/core/staffing.js','utf8'),context);
K.staffing.setRules('leon',{forbiddenWeekdays:[1,3],forbiddenDates:['2026-12-08'],maxDailyHours:8});
for(const date of ['2026-12-02','2026-12-07','2026-12-09','2026-12-14','2027-01-04','2027-01-06','2026-12-08']){
 assert.equal(K.staffing.isBlockedDate('leon',date),true,date);
 for(const type of ['validateWish','validateStandby','validateShift'])assert(K[type]({personId:'leon',date,start:11,end:12,wishType:'available',zone:'neutral'}).some(x=>x.code==='forbidden_date'),type+' '+date);
}
assert.equal(K.staffing.isBlockedDate('leon','2026-12-05'),false);
assert.equal(K.staffing.isBlockedDate('other','2026-12-07'),false);
assert.equal(K.validateWish({personId:'leon',date:'2026-12-07',wishType:'unavailable'}).length,0);
assert.throws(()=>K.staffing.setRules('leon',{forbiddenWeekdays:[7]}));
assert.equal(K.staffing.rulesFor('leon').forbiddenWeekdays.join(','),'1,3');
assert(K.staffing.ruleSummary('leon').includes('Montag, Mittwoch'));
console.log('Wiederkehrende Sperren: Eingabe, Bereitschaft, Planung und Folgejahr geprüft.');
