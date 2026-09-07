(function(){
'use strict';
const K=window.KCDP,active=w=>!['deleted','cancelled'].includes(w.status);
const rows=(personId,date)=>K.wishes.filter(w=>active(w)&&w.personId===personId&&(!date||w.date===date));
const overlap=(a,b)=>a.date===b.date&&Math.max(a.start,b.start)<Math.min(a.end,b.end);
const same=(a,b)=>a.date===b.date&&a.start===b.start&&a.end===b.end&&a.wishType===b.wishType&&(a.wishType==='unavailable'||(a.wishZone||'B')===(b.wishZone||'B'))&&(a.scope||'time')===(b.scope||'time');
function assertEditable(personId){
 if(!personId||personId!==K.currentUser?.personId)throw Error('Bitte mit Ihrem eigenen Zugang anmelden.');
 if(K.state.wishPhase!=='open'||K.workflow?.status==='published')throw Error('Die Wunschphase ist geschlossen.');
 if(!K.auth.canEditWish(personId))throw Error('Sie dürfen diese Wunschzeiten nicht ändern.');
}
function validate(list){
 list=list.map(w=>({...w,scope:K.wishContract?.normalize(w).scope||w.scope}));
 const errors=[];
 for(const w of list){
  errors.push(...(K.validateWish?.(w)||[]).filter(x=>x.level==='error').map(x=>x.text));
  if(!K.days.some(d=>d.date===w.date)||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end>24||w.start>=w.end)errors.push('Bitte vollständige, gültige Von-/Bis-Zeiten eingeben.');
  if(!['V','H','B'].includes(w.wishZone||'B'))errors.push('Bitte vorne, hinten oder beides wählen.');
  if(w.wishType==='preferred'){
   const covers=list.filter(x=>x.date===w.date&&x.wishType==='available').sort((a,b)=>a.start-b.start);
   let end=w.start;for(const c of covers)if(c.start<=end&&c.end>end)end=c.end;
   if(end<w.end)errors.push('Die Wunschzeit muss vollständig innerhalb Ihrer Kann-Zeit liegen.');
   if(list.some(x=>x.wishType==='if_needed'&&overlap(x,w)))errors.push('Wunschzeit und „Nur wenn notwendig“ dürfen sich nicht überschneiden.');
   if(list.some(x=>x.wishType==='unavailable'&&overlap(x,w)))errors.push('Die Wunschzeit überschneidet sich mit einer Sperre. Bitte die Zeiten anpassen.');
  }
  if(w.wishType!=='unavailable'&&list.some(x=>x.date===w.date&&x.wishType==='unavailable'&&x.scope==='day'))errors.push('Ein Sperrtag kann keine Kann- oder Wunschzeiten enthalten.');
 }
 return [...new Set(errors)];
}
function copyPreview(sourceId,ids){
 const own=rows(K.currentUser?.personId),source=rows(sourceId).filter(w=>ids.includes(w.id)),add=[];
 for(const w of source)if(!own.concat(add).some(x=>same(x,w)))add.push({date:w.date,start:w.start,end:w.end,wishType:w.wishType,scope:w.scope||K.wishContract?.inferScope(w)||'time',wishZone:w.wishZone||'B',personId:K.currentUser?.personId,source:'colleague_copy',sourcePersonId:sourceId,sourceWishId:w.id,comment:`Vorlage von ${K.person(sourceId)?.name||'Freund'}`,status:'confirmed',confidence:1});
 const dates=new Set(add.map(w=>w.date));
 return {add,skipped:source.length-add.length,errors:validate(own.filter(w=>dates.has(w.date)).concat(add))};
}
async function save(personId,dates,list,expected,{reviewedDemand=false}={}){
 assertEditable(personId);
 if(expected!==undefined&&JSON.stringify(rows(personId).filter(w=>dates.includes(w.date)))!==expected)throw Error('Ihre Angaben wurden inzwischen geändert. Bitte den Tag erneut öffnen.');
 if(list.some(w=>w.personId!==personId||!dates.includes(w.date)))throw Error('Die Angaben gehören nicht zur ausgewählten Person oder zum ausgewählten Tag.');
 if(list.some(w=>w.id&&!rows(personId).some(x=>x.id===w.id&&x.date===w.date)))throw Error('Eintrag gehört nicht zu Ihrer Tagesmatrix.');
 const errors=validate(list);if(errors.length)throw Error(errors.join(' '));
 if(!reviewedDemand&&K.wishDemandUi&&list.some(w=>w.wishType==='preferred')){
  const snapshot=JSON.stringify(rows(personId));
  if(!await K.wishDemandUi.confirm(list,dates,personId))throw Error('Nicht gespeichert. Du kannst deine Zeiten weiter bearbeiten.');
  assertEditable(personId);
  if(JSON.stringify(rows(personId))!==snapshot)throw Error('Deine Angaben wurden inzwischen geändert. Bitte neu öffnen.');
  const checked=validate(list);if(checked.length)throw Error(checked.join(' '));
 }
 const before=rows(personId).filter(w=>dates.includes(w.date)),kept=new Set();
 for(const w of list){
  const existing=before.find(x=>!kept.has(x.id)&&(w.id?x.id===w.id:same(x,w)));
  if(existing)kept.add(existing.id);
  const value={...existing,...w,status:'confirmed'};
  if(existing&&same(existing,value)&&existing.comment===value.comment&&JSON.stringify(existing.assistantDay)===JSON.stringify(value.assistantDay))continue;
  K.mutations.saveWish(value,{existingId:existing?.id||null,reason:'Persönliche Tagesmatrix gespeichert'});
 }
 for(const w of before)if(!kept.has(w.id))K.mutations.deleteWish(w.id,{reason:'Persönliche Tagesmatrix geändert'});
 await K.persistAll();
}
async function copy(sourceId,ids){
 assertEditable(K.currentUser?.personId);
 const preview=copyPreview(sourceId,ids);if(preview.errors.length)throw Error(preview.errors.join(' '));
 const personId=K.currentUser.personId,dates=[...new Set(preview.add.map(w=>w.date))],own=rows(personId).filter(w=>dates.includes(w.date));
 if(preview.add.length)await save(personId,dates,own.concat(preview.add),JSON.stringify(own));return preview;
}
K.mobileWishMatrix={rows,validate,save,copy,copyPreview,same,assertEditable};
})();
