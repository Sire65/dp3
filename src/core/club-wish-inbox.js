(function(){
'use strict';
const K=window.KCDP=window.KCDP||{},clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const state={inFlight:false,lastRunAt:null,lastError:null,lastResult:null,reviews:[],notices:[]};
let capability=null;
const active=w=>!['deleted','cancelled'].includes(w.status);
const eventId=()=>K.eventConfig?.eventId||'KC-WM-2026';
const orgId=()=>K.integrationConfig?.supabase?.orgId||'';
const scopeKey=()=>JSON.stringify([orgId(),eventId()]);
function store(){K.memberUxData=K.memberUxData||{};const all=K.memberUxData.clubWishInbox=K.memberUxData.clubWishInbox||{};return all[scopeKey()]||(all[scopeKey()]={receipts:{},metadata:{},lastResult:null,lastRunAt:null});}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function ordered(value,template){
 if(Array.isArray(value))return value.map((v,i)=>ordered(v,template?.[i]));
 if(value&&typeof value==='object')return Object.fromEntries([...new Set([...Object.keys(template||{}),...Object.keys(value)])].filter(k=>Object.hasOwn(value,k)).map(k=>[k,ordered(value[k],template?.[k])]));
 return value;
}
function signatureStandby(entry){
 try{const rows=JSON.parse(entry.assistantDay?.completedSignature);if(!Array.isArray(rows))return null;return rows.find(r=>Array.isArray(r)&&r[0]===entry.wishType&&r[1]===!!entry.onlyIfNeeded&&r[2]===(entry.scope||'time')&&r[3]===entry.start&&r[4]===entry.end&&r[5]===(entry.wishZone||'B'))?.[6]||null;}catch(_){return null;}
}
function restoreOrder(entry){
 const value=clone(entry),template=signatureStandby(value);
 if(template&&equal(template,value.assistantDay?.standby))value.assistantDay.standby=ordered(value.assistantDay.standby,template);
 return value;
}
function assertWritable(personId,token){
 if(token&&token===capability)return;
 if(Object.values(store().receipts).some(r=>r.personId===personId&&r.phase==='awaiting_ack'))throw Error('Club-App-Angaben werden gerade gesichert. Bitte nach dem nächsten Abgleich erneut versuchen.');
}
function authorizes(token,row){return !!token&&token===capability&&(row.source==='club_app'||token.replaceIds?.includes(row.id))&&row.personId===token.personId&&['admin','planner','duty_manager'].includes(K.currentUser?.role);}
function phaseOpen(){return K.state?.wishPhase==='open'&&K.workflow?.status!=='published';}
function validateEntry(e,personId){
 if(!e||!['available','preferred','if_needed','unavailable'].includes(e.wishType))return ['Unbekannte Zeitart.'];
 if(!['time','day'].includes(e.scope||'time'))return ['Ungültiger Sperrbereich.'];
 if(!['V','H','B','Z'].includes(e.wishZone||'B'))return ['Ungültiger Einsatzbereich.'];
 if(typeof e.start!=='number'||typeof e.end!=='number'||!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end>24||e.end<=e.start)return ['Ungültige Von-/Bis-Zeit.'];
 if(!K.days.some(d=>d.date===e.date))return ['Datum liegt außerhalb der Veranstaltung.'];
 return (K.wishContract.validate({...e,personId})||[]).filter(x=>x.level==='error').map(x=>x.text);
}
function prepare(input,replaceDates=[]){
 const problems=[],accepted=[],direct=K.wishes.filter(w=>active(w)&&w.personId===input.personId&&w.source!=='club_app'&&!replaceDates.includes(w.date));let skipped=0;
 const indexed=input.entries.map((value,index)=>({value,index}));
 // Validate covering Kann windows before Wunsch windows, regardless of JSON array order.
 indexed.sort((a,b)=>({available:0,if_needed:0,unavailable:1,preferred:2}[a.value?.wishType]??3)-({available:0,if_needed:0,unavailable:1,preferred:2}[b.value?.wishType]??3));
 for(const {value,index} of indexed){
  let errors=validateEntry(value,input.personId),row;
  if(!errors.length){
   row=K.wishContract.normalize({...restoreOrder(value),id:`W-CLUB-${input.id}-${input.revision}-${index}`,personId:input.personId,source:'club_app',sourceInboxId:input.id,sourceInboxRevision:input.revision,sourceEventId:input.eventId,status:'confirmed',confidence:1});
   const peers=direct.concat(accepted).filter(w=>w.date===row.date);
   if(peers.some(w=>K.mobileWishMatrix.same(w,row))){skipped++;continue;}
   if(peers.length&&(row.scope==='day'||peers.some(w=>w.scope==='day'&&w.wishType==='unavailable')))errors.push('Ein Sperrtag kann keine weiteren Zeiten enthalten.');
   errors.push(...K.mobileWishMatrix.validate(peers.concat(row)));
  }
  if(errors.length){skipped++;problems.push({index,date:value?.date||null,text:[...new Set(errors)].join(' ')});}else accepted.push(row);
 }
 const standby={};
 for(const [date,value] of Object.entries(input.standby||{})){
  const validTime=s=>s&&typeof s.start==='number'&&typeof s.end==='number'&&Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.start>=0&&s.end<=24&&s.end>s.start&&['V','H','B','Z'].includes(s.wishZone||'B');
  if(!K.days.some(d=>d.date===date)||!value||!['yes','no'].includes(value.answer)||!Array.isArray(value.slots)||value.slots.some(s=>!validTime(s))||(value.answer==='no'&&value.slots.length)||value.slots.some((s,i)=>value.slots.some((t,j)=>j>i&&Math.max(s.start,t.start)<Math.min(s.end,t.end)))){problems.push({date,text:'Ungültige Bereitschaft übersprungen.'});continue;}
  const template=input.entries.filter(e=>e.date===date).map(signatureStandby).find(t=>t&&equal(t,value));
  standby[date]=template?ordered(value,template):clone(value);
 }
 return {accepted,standby,skipped,problems};
}
// Permissions are authoritative server data. Never overlay inbox consent locally.
function mergeSharing(rows=[]){return clone(rows);}
function sharingSavedByMember(personId){
 for(const meta of Object.values(store().metadata))if(meta.personId===personId)meta.shareWithColleagues=null;
}
function applyMetadata(meta){
 if(!meta||meta.orgId!==orgId()||meta.eventId!==eventId())return;
 const s=store(),previous=s.metadata[meta.id];if(previous&&Number(previous.revision)>Number(meta.revision))return;
 s.metadata[meta.id]=clone(meta);
 K.memberUxData.assistantStandby=K.memberUxData.assistantStandby||{};
 const target=K.memberUxData.assistantStandby[meta.personId]=K.memberUxData.assistantStandby[meta.personId]||{};
 for(const date of Object.keys(previous?.standby||{}))if(!Object.hasOwn(meta.standby||{},date)&&equal(target[date],previous.standby[date]))delete target[date];
 Object.assign(target,clone(meta.standby||{}));
}
function snapshot(input){return {wishes:clone(K.wishes.filter(w=>w.personId===input.personId&&K.days.some(d=>d.date===w.date))),standby:clone(K.memberUxData?.assistantStandby?.[input.personId]),sharing:clone((K.planSharing||[]).filter(r=>r.person_id===input.personId)),consent:clone(K.memberUxData?.colleagueSharing?.[input.personId]),metadata:clone(store().metadata[input.id])};}
function comparisonRows(rows){return rows.map(w=>canonical({date:w.date,start:w.start,end:w.end,wishType:w.wishType,wishZone:w.wishZone||'B',scope:w.scope||'time',onlyIfNeeded:!!w.onlyIfNeeded,comment:w.comment||'',assistantDay:w.assistantDay||null})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
function reviewFor(input){
 const before=snapshot(input),current=before.wishes.filter(active),dates=[...new Set([...input.entries.map(w=>w.date),...current.filter(w=>w.source==='club_app').map(w=>w.date),...Object.keys(input.standby||{}),...Object.keys(before.metadata?.standby||{})])].sort();
 const days=dates.map(date=>{const existing=current.filter(w=>w.date===date),incoming=input.entries.filter(w=>w.date===date),standby=before.standby?.[date],nextStandby=input.standby?.[date];return {date,existing,incoming,standby,nextStandby,conflict:!!(existing.length||standby)&&(!equal(comparisonRows(existing),comparisonRows(incoming))||!equal(standby||null,nextStandby||null))};}).filter(d=>d.conflict);
 return {id:input.id,personId:input.personId,revision:input.revision,submittedAt:input.submittedAt,days,fingerprint:JSON.stringify(canonical({input,before})),context:scopeKey(),user:K.supabaseConnection.state?.userId};
}
function holdReview(review,problems=[]){state.reviews=state.reviews.filter(r=>r.id!==review.id);state.reviews.push({...review,problems});return {needsReview:true,id:review.id,revision:review.revision,problems};}
async function rollback(receipt){
 const s=store(),before=receipt.before;
 if(Array.isArray(receipt.affectedIds)){
  const ids=new Set(receipt.affectedIds);
  K.wishes=K.wishes.filter(w=>!ids.has(w.id)).concat(clone(before.wishes.filter(w=>ids.has(w.id))));
 }else K.wishes=K.wishes.filter(w=>!(w.personId===receipt.personId&&receipt.dates.includes(w.date)&&(receipt.allSources||w.source==='club_app'))).concat(clone(before.wishes));
 K.sync.settleLocalBatch(receipt.tag,false);
 K.auditLog=(K.auditLog||[]).filter(r=>!receipt.auditIds.includes(r.id));
 K.memberUxData.assistantStandby=K.memberUxData.assistantStandby||{};
 if(Array.isArray(receipt.affectedStandbyDates)){
  const target=K.memberUxData.assistantStandby[receipt.personId]||{};
  for(const date of receipt.affectedStandbyDates){if(Object.hasOwn(before.standby||{},date))target[date]=clone(before.standby[date]);else delete target[date];}
  if(before.standby!==undefined||Object.keys(target).length)K.memberUxData.assistantStandby[receipt.personId]=target;else delete K.memberUxData.assistantStandby[receipt.personId];
 }else if(before.standby===undefined)delete K.memberUxData.assistantStandby[receipt.personId];else K.memberUxData.assistantStandby[receipt.personId]=clone(before.standby);
 // Build 255 does not write permissions locally; rollback must retain fresh server reads.
 if(!receipt.claimToken){
  K.memberUxData.colleagueSharing=K.memberUxData.colleagueSharing||{};
  if(before.consent===undefined)delete K.memberUxData.colleagueSharing[receipt.personId];else K.memberUxData.colleagueSharing[receipt.personId]=clone(before.consent);
  K.planSharing=(K.planSharing||[]).filter(r=>r.person_id!==receipt.personId).concat(clone(before.sharing));
 }
 if(before.metadata===undefined)delete s.metadata[receipt.id];else s.metadata[receipt.id]=clone(before.metadata);
 delete s.receipts[receipt.id];
 await K.persistAll();
}
async function complete(receipt){
 K.sync.settleLocalBatch(receipt.tag,true);
 // Keep a compact durable receipt across restarts; an ACK timeout never imports twice.
 store().receipts[receipt.id]={id:receipt.id,personId:receipt.personId,revision:receipt.revision,claimToken:receipt.claimToken,phase:'done',result:receipt.result};
 store().lastRunAt=state.lastRunAt=new Date().toISOString();store().lastResult=state.lastResult=receipt.result;
 await K.persistAll();return receipt.result;
}
async function acknowledge(receipt){
 if(receipt.context!==scopeKey())throw Error('Die Veranstaltung wurde während der Übernahme geändert.');
 const userId=K.supabaseConnection.state?.userId;
 if(receipt.userId&&receipt.userId!==userId)throw Error('Bitte mit dem Konto anmelden, das die Übernahme begonnen hat.');
 const args={id:receipt.id,revision:receipt.revision,status:'uebernommen',result:receipt.result,claimToken:receipt.claimToken};
 // Only durable pre-255 receipts may use the legacy acknowledgement once.
 const reply=await (receipt.claimToken?K.supabaseConnection.wishInboxAckClaimed(args):K.supabaseConnection.wishInboxAck(args));
 if(receipt.context!==scopeKey()||userId!==K.supabaseConnection.state?.userId)throw Error('Die Anmeldung oder Veranstaltung wurde während der Bestätigung geändert.');
 if(reply?.stale===true||reply?.reason==='claim_lost'){await rollbackAndRelease(receipt);return notice({id:receipt.id,stale:!!reply.stale,reason:reply.reason||'stale'});}
 if(reply?.ok!==true)throw Error('Club-App-Bestätigung fehlt. Der gesicherte Eingang wird erneut geprüft.');
 receipt.result.sharingApplied=reply.sharingApplied===true;receipt.result.shareWithColleagues=reply.shareWithColleagues??null;
 return complete(receipt);
}
function notice(value){state.notices=state.notices.filter(n=>n.id!==value.id);state.notices.push(value);return value;}
async function release(receipt){if(receipt.claimToken)try{await K.supabaseConnection.wishInboxRelease({id:receipt.id,claimToken:receipt.claimToken});}catch(_){} }
async function rollbackAndRelease(receipt){try{await rollback(receipt);}finally{await release(receipt);}}
async function claim(input){
 const context=scopeKey(),user=K.supabaseConnection.state?.userId;
 const identity=await K.multiDeviceTest?.identity?.();
 if(!identity?.deviceId)throw Error('Gerätekennung fehlt. Der Club-App-Eingang wird nicht übernommen.');
 if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId)throw Error('Anmeldung oder Veranstaltung während der Geräteprüfung geändert.');
 const reply=await K.supabaseConnection.wishInboxClaim({id:input.id,revision:input.revision,deviceId:identity.deviceId});
 if(reply?.reason==='claimed'||reply?.stale)return notice({...reply,id:input.id,ok:false});
 if(reply?.ok!==true||!reply.claimToken)throw Error('Reservierung wurde nicht bestätigt. Es werden keine Angaben eingetragen.');
 return reply;
}
async function importOne(input,context,decision=null){
 if(context!==scopeKey())throw Error('Die Veranstaltung wurde während der Übernahme geändert.');
 if(!phaseOpen())return reject(input,'wunschphase_geschlossen');
 const person=K.people.find(p=>p.personId===input.personId);
 if(!person?.active||(K.personPlanningAllowed&&!K.personPlanningAllowed(input.personId)))return reject(input,'person_unbekannt');
 if(input.eventId!==eventId()||input.source!=='club_app'||!input.id||!Number.isInteger(input.revision)||input.revision<1||!Array.isArray(input.entries)||!input.standby||typeof input.standby!=='object'||Array.isArray(input.standby))throw Error('Ungültiger Club-App-Eingang.');
 const prior=store().receipts[input.id];
 if(prior?.revision===input.revision&&prior.phase==='awaiting_ack')return acknowledge(prior);
 if(prior?.revision>=input.revision&&prior.phase==='done')return {skipped:true,reason:'already_processed'};
 const review=reviewFor(input);
 if(decision&&(decision.fingerprint!==review.fingerprint||decision.context!==context||decision.user!==K.supabaseConnection.state?.userId))return holdReview(review,[{text:'Die Daten wurden inzwischen geändert. Bitte erneut vergleichen und auswählen.'}]);
 if(review.days.length&&(!decision||review.days.some(d=>!['keep','replace'].includes(decision.choices?.[d.date]))))return holdReview(review);
 const keepDates=review.days.filter(d=>decision?.choices[d.date]==='keep').map(d=>d.date),replaceDates=review.days.filter(d=>decision?.choices[d.date]==='replace').map(d=>d.date);
 const selected={...input,entries:input.entries.filter(w=>!keepDates.includes(w.date)),standby:Object.fromEntries(Object.entries(input.standby).filter(([date])=>!keepDates.includes(date)))};
 const prepared=prepare(selected,replaceDates),before=snapshot(input),tag=`club:${input.id}:${input.revision}`,auditStart=K.auditLog.length;
 if(prepared.problems.length)return holdReview(review,prepared.problems);
 // Keep the complete existing day, including direct Twinkey readiness, when selected.
 for(const date of keepDates)if(before.standby?.[date])prepared.standby[date]=clone(before.standby[date]);
 const reservation=await claim(input);if(reservation.ok!==true)return reservation;
 if(context!==scopeKey()||review.user!==K.supabaseConnection.state?.userId){await release({id:input.id,claimToken:reservation.claimToken});throw Error('Anmeldung oder Veranstaltung während der Reservierung geändert.');}
 if(!phaseOpen()||review.fingerprint!==reviewFor(input).fingerprint){await release({id:input.id,claimToken:reservation.claimToken});return holdReview(reviewFor(input),[{text:'Die Daten wurden während der Reservierung geändert. Bitte erneut prüfen.'}]);}
 const receipt={id:input.id,personId:input.personId,revision:input.revision,phase:'awaiting_ack',context,tag,before,allSources:true,dates:K.days.map(d=>d.date),auditIds:[],result:{added:0,replaced:0,skipped:prepared.skipped,keptDays:keepDates,replacedDays:replaceDates,standbyDays:Object.keys(prepared.standby).length,problems:prepared.problems,dp2Version:K.VERSION}};
 receipt.claimToken=reservation.claimToken;receipt.claimedUntil=reservation.claimedUntil;receipt.userId=review.user;
 receipt.affectedIds=[...new Set(before.wishes.filter(w=>active(w)&&!keepDates.includes(w.date)&&(w.source==='club_app'||replaceDates.includes(w.date))).map(w=>w.id).concat(prepared.accepted.map(w=>w.id)))];
 receipt.affectedStandbyDates=[...new Set(Object.keys(before.metadata?.standby||{}).concat(Object.keys(prepared.standby),replaceDates))];
 store().receipts[input.id]=receipt;
 try{
  capability={personId:input.personId,replaceIds:before.wishes.filter(w=>replaceDates.includes(w.date)).map(w=>w.id)};
  K.sync.stageLocalBatch(tag,()=>{
   for(const row of before.wishes.filter(w=>active(w)&&!keepDates.includes(w.date)&&(w.source==='club_app'||replaceDates.includes(w.date)))){K.mutations.deleteWish(row.id,{reason:'Club-App-Wunscheingang: geprüfte Tagesentscheidung',clubImport:capability});receipt.result.replaced++;}
   const readiness=K.memberUxData?.assistantStandby?.[input.personId];
   if(readiness)for(const date of replaceDates)delete readiness[date];
   for(const row of prepared.accepted){const saved=K.mutations.saveWish(row,{reason:'Club-App-Wunscheingang',clubImport:capability});if(saved.duplicate)receipt.result.skipped++;else receipt.result.added++;}
   const meta={id:input.id,personId:input.personId,orgId:orgId(),eventId:input.eventId,revision:input.revision,standby:prepared.standby,shareWithColleagues:input.shareWithColleagues??before.metadata?.shareWithColleagues??null,submittedAt:input.submittedAt||new Date().toISOString()};
   applyMetadata(meta);K.sync.enqueue({entity:'club_wish_meta',operation:'update',payload:meta,baseVersion:null});
   K.recordAudit('Club-App-Wunscheingang',{entity:'wish_inbox',entityId:input.id,reason:`Club-App-Wunscheingang ${input.personId} rev ${input.revision}`,after:receipt.result});
  });
  receipt.auditIds=K.auditLog.slice(auditStart).map(r=>r.id);
  await K.persistAll();
 }catch(e){receipt.auditIds=K.auditLog.slice(auditStart).map(r=>r.id);try{await rollback(receipt);}finally{await release(receipt);}throw e;}finally{capability=null;}
 // Network failures after persistence leave a recoverable, held batch, never a partial reimport.
 state.reviews=state.reviews.filter(r=>r.id!==input.id);
 return acknowledge(receipt);
}
async function reject(input,reason){
 const result={reason,problems:[{text:reason==='person_unbekannt'?'Person ist nicht aktiv oder nicht planbar.':'Die Wunschphase ist geschlossen.'}],added:0};
 const context=scopeKey(),user=K.supabaseConnection.state?.userId,reservation=await claim(input);if(reservation.ok!==true)return reservation;
 if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId){await release({id:input.id,claimToken:reservation.claimToken});throw Error('Anmeldung oder Veranstaltung geändert.');}
 let response;try{response=await K.supabaseConnection.wishInboxAckClaimed({id:input.id,revision:input.revision,status:'abgelehnt',result,claimToken:reservation.claimToken});}finally{await release({id:input.id,claimToken:reservation.claimToken});}
 if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId)throw Error('Anmeldung oder Veranstaltung während der Ablehnung geändert.');
 if(response?.reason==='claim_lost')return notice({id:input.id,reason:'claim_lost'});
 if(!response?.stale&&response?.ok!==true)throw Error('Ablehnung wurde nicht bestätigt.');
 if(response?.stale)return {stale:true};
 store().lastResult=state.lastResult=result;store().lastRunAt=state.lastRunAt=new Date().toISOString();await K.persistAll();return result;
}
async function runNow(){
 if(state.inFlight)return {skipped:true,reason:'already_running'};
 state.inFlight=true;
 try{
  if(!await K.daysPublishBridge.planningMembership())return {skipped:true,reason:'role'};
  const context=scopeKey(),user=K.supabaseConnection.state?.userId,inputs=await K.supabaseConnection.wishInboxPending({eventId:eventId()});
  if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId)throw Error('Die Anmeldung oder Veranstaltung wurde geändert.');
  state.reviews=state.reviews.filter(r=>r.context===context&&r.user===user&&inputs.some(i=>i.id===r.id));
  if(inputs.length&&K.supabaseConnection.readPlanSharing)K.planSharing=await K.supabaseConnection.readPlanSharing({raw:true});
  if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId)throw Error('Die Anmeldung oder Veranstaltung wurde geändert.');
  // A crash before the first full persistence can leave a queue-only staged batch.
  // Never release it: there is no durable receipt proving the wishes were saved.
  const durableTags=new Set(Object.values(K.memberUxData?.clubWishInbox||{}).flatMap(s=>Object.values(s.receipts||{})).filter(r=>r.phase==='awaiting_ack').map(r=>r.tag));
  K.syncOutbox=K.syncOutbox.filter(op=>!op.clubInboxBatch||durableTags.has(op.clubInboxBatch));
  state.notices=inputs.filter(i=>i.claimActive&&!i.claimedByMe).map(i=>({id:i.id,reason:'claimed',claimedUntil:i.claimedUntil}));const resumed=new Set(),results=[];
  // Match the exact claim, not merely the login: two PCs may use the same account.
  for(const receipt of Object.values(store().receipts).filter(r=>r.phase==='awaiting_ack')){
   if(receipt.userId&&receipt.userId!==user)throw Error('Bitte mit dem Konto anmelden, das die Übernahme begonnen hat.');
   const current=inputs.find(i=>i.id===receipt.id);
   if(!receipt.claimToken){
    if(!current){await complete(receipt);continue;}
    if(current.revision!==receipt.revision){await rollback(receipt);continue;}
    results.push(await acknowledge(receipt));resumed.add(receipt.id);continue;
   }
   const remote=await K.supabaseConnection.wishInboxReceipt({id:receipt.id});
   if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId)throw Error('Anmeldung oder Veranstaltung während der Belegprüfung geändert.');
   if(!remote||typeof remote.found!=='boolean')throw Error('Übernahmebeleg konnte nicht eindeutig geprüft werden.');
   if(remote.found===true&&remote.status!=='offen'&&remote.takenClaim===receipt.claimToken&&remote.takenRevision===receipt.revision){results.push(await complete(receipt));resumed.add(receipt.id);}
   else if(remote.found===false||remote.status!=='offen'||remote.revision!==receipt.revision){await rollbackAndRelease(receipt);results.push(notice({id:receipt.id,reason:'claim_lost',stale:true}));resumed.add(receipt.id);}
   else {results.push(await acknowledge(receipt));resumed.add(receipt.id);}
  }
  for(const input of inputs){
   if(resumed.has(input.id))continue;
   if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId)throw Error('Die Anmeldung oder Veranstaltung wurde geändert.');
   results.push(await importOne(input,context));
  }
  state.lastError=null;return {processed:results.length,results};
 }catch(e){state.lastError=e.message;throw e;}finally{state.inFlight=false;K.emailCenter?.refreshClubStatus?.();}
}
async function resolve(id,choices){
 if(state.inFlight)throw Error('Ein Abgleich läuft bereits. Bitte kurz warten.');
 const decision=clone(state.reviews.find(r=>r.id===id));if(!decision)throw Error('Bitte den Eingang neu laden.');
 state.inFlight=true;
 try{
  if(!await K.daysPublishBridge.planningMembership())throw Error('Nur berechtigte Planer dürfen diesen Eingang übernehmen.');
  if(decision.context!==scopeKey()||decision.user!==K.supabaseConnection.state?.userId)throw Error('Anmeldung oder Veranstaltung geändert. Bitte neu laden.');
  if(K.sync?.hasProvider?.()){const pulled=await K.sync.pull();if(pulled?.conflicts)throw Error('Es gibt offene Synchronisationskonflikte. Bitte diese zuerst klären.');}
  const inputs=await K.supabaseConnection.wishInboxPending({eventId:eventId()}),input=inputs.find(i=>i.id===id);
  if(!input){state.reviews=state.reviews.filter(r=>r.id!==id);throw Error('Dieser Eingang ist nicht mehr offen. Bitte synchronisieren.');}
  if(decision.context!==scopeKey()||decision.user!==K.supabaseConnection.state?.userId)throw Error('Anmeldung oder Veranstaltung geändert. Bitte neu laden.');
  return await importOne(input,scopeKey(),{...decision,choices});
 }finally{state.inFlight=false;K.emailCenter?.refreshClubStatus?.();}
}
function summary(){const s=store();return {lastRunAt:s.lastRunAt,lastResult:s.lastResult,lastError:state.lastError,notices:clone(state.notices),reviews:clone(state.reviews.filter(r=>r.context===scopeKey()&&r.user===K.supabaseConnection.state?.userId)),pending:Object.values(s.receipts).filter(r=>r.phase==='awaiting_ack').length};}
K.clubWishInbox={state,runNow,resolve,summary,mergeSharing,sharingSavedByMember,applyMetadata,assertWritable,authorizes,restoreOrder};
})();
