(function(){
'use strict';const K=window.KCDP;
const valid=w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start;
const active=w=>!['deleted','cancelled','failed','absent'].includes(w.status);
function calculate(personId,previewDate=null,previewRows=null){
 const dates=new Set(K.days.map(d=>d.date));
 const all=(K.wishes||[]).filter(w=>active(w)&&dates.has(w.date)&&!(previewRows&&w.personId===personId&&w.date===previewDate)).concat(previewRows||[]).filter(valid);
 const forPerson=id=>all.filter(w=>w.personId===id);
 const hours=(rows,type)=>K.chefCompanion.hours(rows.filter(w=>w.wishType===type),rows.filter(w=>w.wishType==='unavailable'));
 const mine=forPerson(personId);
 const daily=K.days.map(d=>{const rows=mine.filter(w=>w.date===d.date);const standby=rows.find(w=>w.assistantDay?.standby)?.assistantDay.standby;return {date:d.date,standby:standby?.answer==='yes'?K.chefCompanion.hours(standby.slots.map(r=>({...r,date:d.date}))):0,can:hours(rows,'available'),wish:hours(rows,'preferred'),reserve:hours(rows,'if_needed'),planned:K.chefCompanion.hours((K.shifts||[]).filter(w=>active(w)&&valid(w)&&w.personId===personId&&w.date===d.date&&w.layer==='planned'))};});
 const totals=daily.reduce((a,d)=>({standby:a.standby+d.standby,can:a.can+d.can,wish:a.wish+d.wish,reserve:a.reserve+d.reserve,planned:a.planned+d.planned}),{standby:0,can:0,wish:0,reserve:0,planned:0});
 const members=(K.people||[]).filter(p=>p.active!==false&&p.personType==='member'&&forPerson(p.personId).some(w=>['available','preferred','if_needed'].includes(w.wishType)));
 const teamWish=members.reduce((sum,p)=>sum+hours(forPerson(p.personId),'preferred'),0);
 return {daily,totals,memberCount:members.length,teamWish,average:members.length?teamWish/members.length:null};
}
K.assistantHours={calculate};
})();

