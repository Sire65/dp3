(function(){
'use strict';
const K=window.KCDP=window.KCDP||{},clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const state={inFlight:false,lastRunAt:null,lastError:null,lastResult:null};
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
function authorizes(token,row){return !!token&&token===capability&&row.source==='club_app'&&row.personId===token.personId&&['admin','planner','duty_manager'].includes(K.currentUser?.role);}
function phaseOpen(){return K.state?.wishPhase==='open'&&K.workflow?.status!=='published';}
function validateEntry(e,personId){
 if(!e||!['available','preferred','if_needed','unavailable'].includes(e.wishType))return ['Unbekannte Zeitart.'];
 if(!['time','day'].includes(e.scope||'time'))return ['Ungültiger Sperrbereich.'];
 if(!['V','H','B','Z'].includes(e.wishZone||'B'))return ['Ungültiger Einsatzbereich.'];
 if(typeof e.start!=='number'||typeof e.end!=='number'||!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end>24||e.end<=e.start)return ['Ungültige Von-/Bis-Zeit.'];
 if(!K.days.some(d=>d.date===e.date))return ['Datum liegt außerhalb der Veranstaltung.'];
 return (K.wishContract.validate({...e,personId})||[]).filter(x=>x.level==='error').map(x=>x.text);
}
function prepare(input){
 const problems=[],accepted=[],direct=K.wishes.filter(w=>active(w)&&w.personId===input.personId&&w.source!=='club_app');let skipped=0;
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
function mergeSharing(rows=[]){
 let merged=clone(rows||[]);
 for(const meta of Object.values(store().metadata)){
  if(typeof meta.shareWithColleagues!=='boolean')continue;
  // The server table has no timestamps and only the member may write it. Never
  // widen server permissions from an inbox overlay; a saved refusal wins.
  if(meta.shareWithColleagues)continue;
  merged=merged.filter(r=>String(r.person_id)!==meta.personId);
  for(const plan_kind of ['can','wish','standby'])merged.push({org_id:orgId(),person_id:meta.personId,plan_kind,allow_view:false,allow_copy:false,source:'club_app'});
 }
 return merged;
}
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
 if(typeof meta.shareWithColleagues==='boolean'){
  K.memberUxData.colleagueSharing=K.memberUxData.colleagueSharing||{};
  K.memberUxData.colleagueSharing[meta.personId]={allow:meta.shareWithColleagues,updatedAt:meta.submittedAt};
 }
 K.planSharing=mergeSharing(K.planSharing);
}
function snapshot(input){return {wishes:clone(K.wishes.filter(w=>w.personId===input.personId&&w.source==='club_app'&&K.days.some(d=>d.date===w.date))),standby:clone(K.memberUxData?.assistantStandby?.[input.personId]),sharing:clone((K.planSharing||[]).filter(r=>r.person_id===input.personId)),consent:clone(K.memberUxData?.colleagueSharing?.[input.personId]),metadata:clone(store().metadata[input.id])};}
async function rollback(receipt){
 const s=store(),before=receipt.before;
 K.wishes=K.wishes.filter(w=>!(w.source==='club_app'&&w.personId===receipt.personId&&receipt.dates.includes(w.date))).concat(clone(before.wishes));
 K.sync.settleLocalBatch(receipt.tag,false);
 K.auditLog=(K.auditLog||[]).filter(r=>!receipt.auditIds.includes(r.id));
 K.memberUxData.assistantStandby=K.memberUxData.assistantStandby||{};
 if(before.standby===undefined)delete K.memberUxData.assistantStandby[receipt.personId];else K.memberUxData.assistantStandby[receipt.personId]=clone(before.standby);
 K.memberUxData.colleagueSharing=K.memberUxData.colleagueSharing||{};
 if(before.consent===undefined)delete K.memberUxData.colleagueSharing[receipt.personId];else K.memberUxData.colleagueSharing[receipt.personId]=clone(before.consent);
 K.planSharing=(K.planSharing||[]).filter(r=>r.person_id!==receipt.personId).concat(clone(before.sharing));
 if(before.metadata===undefined)delete s.metadata[receipt.id];else s.metadata[receipt.id]=clone(before.metadata);
 delete s.receipts[receipt.id];
 await K.persistAll();
}
async function complete(receipt){
 K.sync.settleLocalBatch(receipt.tag,true);
 // Keep a compact durable receipt across restarts; an ACK timeout never imports twice.
 store().receipts[receipt.id]={id:receipt.id,personId:receipt.personId,revision:receipt.revision,phase:'done',result:receipt.result};
 store().lastRunAt=state.lastRunAt=new Date().toISOString();store().lastResult=state.lastResult=receipt.result;
 await K.persistAll();return receipt.result;
}
async function acknowledge(receipt){
 if(receipt.context!==scopeKey())throw Error('Die Veranstaltung wurde während der Übernahme geändert.');
 const userId=K.supabaseConnection.state?.userId;
 const reply=await K.supabaseConnection.wishInboxAck({id:receipt.id,revision:receipt.revision,status:'uebernommen',result:receipt.result});
 if(receipt.context!==scopeKey()||userId!==K.supabaseConnection.state?.userId)throw Error('Die Anmeldung oder Veranstaltung wurde während der Bestätigung geändert.');
 if(reply?.stale===true){await rollback(receipt);return {stale:true};}
 if(reply?.ok!==true)throw Error('Club-App-Bestätigung fehlt. Der gesicherte Eingang wird erneut geprüft.');
 return complete(receipt);
}
async function importOne(input,context){
 if(context!==scopeKey()||!phaseOpen())return reject(input,'wunschphase_geschlossen');
 const person=K.people.find(p=>p.personId===input.personId);
 if(!person?.active||(K.personPlanningAllowed&&!K.personPlanningAllowed(input.personId)))return reject(input,'person_unbekannt');
 if(input.eventId!==eventId()||input.source!=='club_app'||!input.id||!Number.isInteger(input.revision)||input.revision<1||!Array.isArray(input.entries)||!input.standby||typeof input.standby!=='object'||Array.isArray(input.standby))throw Error('Ungültiger Club-App-Eingang.');
 const prior=store().receipts[input.id];
 if(prior?.revision===input.revision&&prior.phase==='awaiting_ack')return acknowledge(prior);
 if(prior?.revision>=input.revision&&prior.phase==='done')return K.supabaseConnection.wishInboxAck({id:input.id,revision:input.revision,status:'uebernommen',result:prior.result});
 const prepared=prepare(input),before=snapshot(input),tag=`club:${input.id}:${input.revision}`,auditStart=K.auditLog.length;
 if(typeof input.shareWithColleagues==='boolean'&&['can','wish','standby'].some(kind=>{const row=(K.planSharing||[]).find(r=>r.person_id===input.personId&&r.plan_kind===kind);return !!row?.allow_view!==input.shareWithColleagues||!!row?.allow_copy!==input.shareWithColleagues;}))prepared.problems.push({text:'Kollegenfreigabe vorgemerkt. Die zentrale Freigabe kann mit der vorhandenen Schnittstelle nur das Mitglied selbst in DP2 speichern; keine stellvertretende Änderung durch den Planer.'});
 const receipt={id:input.id,personId:input.personId,revision:input.revision,phase:'awaiting_ack',context,tag,before,dates:K.days.map(d=>d.date),auditIds:[],result:{added:0,replaced:0,skipped:prepared.skipped,standbyDays:Object.keys(prepared.standby).length,problems:prepared.problems,dp2Version:K.VERSION}};
 store().receipts[input.id]=receipt;
 try{
  capability={personId:input.personId};
  K.sync.stageLocalBatch(tag,()=>{
   for(const row of before.wishes.filter(active)){K.mutations.deleteWish(row.id,{reason:'Club-App-Wunscheingang',clubImport:capability});receipt.result.replaced++;}
   for(const row of prepared.accepted){const saved=K.mutations.saveWish(row,{reason:'Club-App-Wunscheingang',clubImport:capability});if(saved.duplicate)receipt.result.skipped++;else receipt.result.added++;}
   const meta={id:input.id,personId:input.personId,orgId:orgId(),eventId:input.eventId,revision:input.revision,standby:prepared.standby,shareWithColleagues:input.shareWithColleagues??before.metadata?.shareWithColleagues??null,submittedAt:input.submittedAt||new Date().toISOString()};
   applyMetadata(meta);K.sync.enqueue({entity:'club_wish_meta',operation:'update',payload:meta,baseVersion:null});
   K.recordAudit('Club-App-Wunscheingang',{entity:'wish_inbox',entityId:input.id,reason:`Club-App-Wunscheingang ${input.personId} rev ${input.revision}`,after:receipt.result});
  });
  receipt.auditIds=K.auditLog.slice(auditStart).map(r=>r.id);
  await K.persistAll();
 }catch(e){receipt.auditIds=K.auditLog.slice(auditStart).map(r=>r.id);await rollback(receipt);throw e;}finally{capability=null;}
 // Network failures after persistence leave a recoverable, held batch, never a partial reimport.
 return acknowledge(receipt);
}
async function reject(input,reason){
 const result={reason,problems:[{text:reason==='person_unbekannt'?'Person ist nicht aktiv oder nicht planbar.':'Die Wunschphase ist geschlossen.'}],added:0};
 const response=await K.supabaseConnection.wishInboxAck({id:input.id,revision:input.revision,status:'abgelehnt',result});
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
  if(inputs.length&&K.supabaseConnection.readPlanSharing)K.planSharing=await K.supabaseConnection.readPlanSharing({raw:true});
  // A crash before the first full persistence can leave a queue-only staged batch.
  // Never release it: there is no durable receipt proving the wishes were saved.
  const durableTags=new Set(Object.values(K.memberUxData?.clubWishInbox||{}).flatMap(s=>Object.values(s.receipts||{})).filter(r=>r.phase==='awaiting_ack').map(r=>r.tag));
  K.syncOutbox=K.syncOutbox.filter(op=>!op.clubInboxBatch||durableTags.has(op.clubInboxBatch));
  // Resume a durable batch before newer input. An absent row after an ACK timeout means it
  // is no longer open; retain the saved wishes (the RPC cannot distinguish ACK by this/another PC).
  for(const receipt of Object.values(store().receipts).filter(r=>r.phase==='awaiting_ack')){
   const current=inputs.find(i=>i.id===receipt.id);
   if(!current)await complete(receipt);
   else if(current.revision!==receipt.revision)await rollback(receipt);
  }
  const results=[];
  for(const input of inputs){
   if(context!==scopeKey()||user!==K.supabaseConnection.state?.userId)throw Error('Die Anmeldung oder Veranstaltung wurde geändert.');
   results.push(await importOne(input,context));
  }
  state.lastError=null;return {processed:results.length,results};
 }catch(e){state.lastError=e.message;throw e;}finally{state.inFlight=false;K.emailCenter?.refreshClubStatus?.();}
}
function summary(){const s=store();return {lastRunAt:s.lastRunAt,lastResult:s.lastResult,lastError:state.lastError,pending:Object.values(s.receipts).filter(r=>r.phase==='awaiting_ack').length};}
K.clubWishInbox={state,runNow,summary,mergeSharing,sharingSavedByMember,applyMetadata,assertWritable,authorizes,restoreOrder};
})();
