// Build 321 · KC-DP-SOLL-UEBERGABE (Hansi 23.11.2026): Sollplan aus der Club-App übernehmen.
// Die Club-App rechnet einen Sollplan und legt ihn als VOLLSTÄNDIGEN Stand ab (Tabelle kc_dp_soll_uebergabe im Club-App-Repo).
// DP2 holt die neueste offene Übergabe über kc_dp_soll_uebergabe_pending ab und zeigt im Sollplan einen Hinweis.
// Die Vorschau vergleicht den Stand mit den schon übernommenen Club-Schichten (planningSource 'club_import' + sourceImportKey):
//   ➕ neu · ✏️ geändert · ➖ entfällt · ＝ unverändert · ⚠️ in DP2 geändert (Wahl: DP2 behalten [Standard] / Club-Stand übernehmen)
//   · ⛔ nicht übernehmbar (unbekannte/gesperrte Person, kein Veranstaltungstag, Prüfung K.validateShift, Überschneidung mit DP2-Dienst).
// Schutz: von Hand in DP2 angelegte Dienste (ohne club_import) werden nie angefasst. Übernommene Dienste, die in DP2 geändert wurden
// (Fingerabdruck clubShiftFp ≠ aktuelle Werte), Ist-Zeiten, eine Tauschanfrage oder einen anderen Status haben, werden nur nach
// ausdrücklicher Wahl geändert oder entfernt. „Entfällt“ entfernt über K.mutations.deleteShift (Status deleted → die Veröffentlichung
// an die Kasse lässt ihn weg). Nichts ändert sich ohne „Übernehmen“. Der Veröffentlichungsweg (Auto-Sync, kc_dp_plan_publish) bleibt unverändert.
(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const VERSION='0.1.0',SOURCE='club_import',POLL_MS=5*60000;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=h=>{const v=Number(h),m=Math.round(v*60);return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;};
const eventId=()=>K.eventConfig?.eventId||'KC-WM-2026';
const orgId=()=>K.integrationConfig?.supabase?.orgId||'';
const scopeKey=()=>JSON.stringify([orgId(),eventId()]);
const INACTIVE=new Set(['deleted','cancelled','absent','failed']);
const ZONES=new Set(['front','back','neutral','special']);
const state={inFlight:false,lastCheckAt:0,lastError:null,pending:null,analysis:null,choices:{},lastResult:null,notice:null};
function store(){K.memberUxData=K.memberUxData||{};const all=K.memberUxData.clubSollInbox=K.memberUxData.clubSollInbox||{};return all[scopeKey()]||(all[scopeKey()]={removed:{},lastApplied:null});}
const num=v=>Math.round(Number(v)*10000)/10000;
// Fingerabdruck der Werte, die die Club-App bestimmt (Zeit, Zone, Bereich, Pause).
function fingerprint(s){return JSON.stringify([String(s?.personId||''),String(s?.date||''),num(s?.start),num(s?.end),String(s?.zone||''),String(s?.area||''),Number(s?.breakMinutes||0)]);}
const canonicalId=id=>K.personIdAliases?.[String(id||'')]||String(id||'');
const clubShifts=()=>(K.shifts||[]).filter(s=>s&&s.layer==='planned'&&s.planningSource===SOURCE&&s.sourceImportKey);
function protectedReasons(s){
 const out=[];
 if(s.clubShiftFp&&fingerprint(s)!==s.clubShiftFp)out.push('in DP2 geändert');
 if(!['draft','published','planned',undefined,null,''].includes(s.status))out.push(`Status „${s.status}“`);
 if((K.actualShifts||[]).some(a=>a&&a.linkedShiftId===s.id&&!INACTIVE.has(a.status)))out.push('hat Ist-Zeiten');
 if((K.swapRequests||[]).some(r=>r&&r.shiftId===s.id&&!['rejected','cancelled','withdrawn'].includes(r.status)))out.push('Tauschanfrage');
 return out;
}
function validRow(r){
 if(!r||typeof r!=='object')return 'Ungültige Zeile.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||'')))return 'Ungültiges Datum.';
 if(!/^KC-P-[A-Z0-9-]{1,30}$/.test(String(r.personId||'')))return 'Ungültige Personen-ID.';
 if(r.importKey!==`CLUB-${r.date}-${r.personId}`)return 'Ungültiger Übernahmeschlüssel.';
 if(typeof r.start!=='number'||typeof r.end!=='number'||!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end>30||r.end<=r.start)return 'Ungültige Von-/Bis-Zeit.';
 if(!ZONES.has(r.zone))return 'Ungültige Zone.';
 if(!Number.isInteger(Number(r.breakMinutes))||Number(r.breakMinutes)<0||Number(r.breakMinutes)>240)return 'Ungültige Pause.';
 return null;
}
// DP2-Dienst aus einer Club-Zeile; base = vorhandener Club-Dienst (geändert) oder null (neu).
function candidateFor(row,input,base=null){
 let c={...(base?clone(base):{}),personId:canonicalId(row.personId),date:row.date,start:Number(row.start),end:Number(row.end),zone:row.zone,area:String(row.area||'Aus Club-App').slice(0,60),layer:'planned',breakMinutes:Number(row.breakMinutes||0),
  status:base?.status||'draft',planningSource:SOURCE,sourceImportKey:row.importKey,clubImportId:input.id,clubImportedAt:new Date().toISOString(),clubRowFp:fingerprint(row)};
 if(!base){c.id='';delete c.breakSegments;}else{delete c.breakSegments;delete c.breakAutoSuggested;}
 c=K.normalizeShiftClassification?.(c)||c;
 if(K.breaks?.applySuggested)c=K.breaks.applySuggested(c);
 c.clubShiftFp=fingerprint(c);
 return c;
}
function issuesFor(c){let issues=[];try{issues=(K.validateShift(c)||[]).map(i=>({level:i.level==='error'?'error':i.level==='info'?'info':'warn',text:i.text}));}catch(e){issues=[{level:'error',text:e.message||String(e)}];}try{K.locks?.requireEditable?.(c.date);}catch(e){issues.push({level:'error',text:e.message});}return issues;}
const overlapsManual=c=>(K.shifts||[]).filter(s=>s.id!==c.id&&s.layer==='planned'&&!INACTIVE.has(s.status)&&s.personId===c.personId&&s.date===c.date&&Number(s.start)<Number(c.end)&&Number(c.start)<Number(s.end)&&s.planningSource!==SOURCE);
// Reiner Vergleich: kein Speichern, keine Netzanfrage.
function analyze(input,{removed=store().removed}={}){
 const items=[],rows=Array.isArray(input?.rows)?input.rows:[],seen=new Set(),club=clubShifts();
 const byKey=new Map();for(const s of club){const prev=byKey.get(s.sourceImportKey);if(!prev||(INACTIVE.has(prev.status)&&!INACTIVE.has(s.status)))byKey.set(s.sourceImportKey,s);}
 for(const row of rows){
  const label={personId:row?.personId,name:row?.name||'',date:row?.date,start:row?.start,end:row?.end,zone:row?.zone,area:row?.area,importKey:row?.importKey};
  const bad=validRow(row);if(bad){items.push({kind:'fehler',row:label,text:bad});continue;}
  if(seen.has(row.importKey)){items.push({kind:'fehler',row:label,text:'Doppelte Zeile.'});continue;}seen.add(row.importKey);
  const pid=canonicalId(row.personId),person=K.person?.(pid);
  if(K.personPlanningAllowed&&!K.personPlanningAllowed(pid)){items.push({kind:'fehler',row:label,text:'Person ist für diese Veranstaltung nicht planbar.'});continue;}
  if(!person?.active){items.push({kind:'fehler',row:label,text:'Person ist in DP2 unbekannt oder nicht aktiv.'});continue;}
  if(!(K.days||[]).some(d=>d.date===row.date)){items.push({kind:'fehler',row:label,text:'Kein Veranstaltungstag in DP2.'});continue;}
  const existing=byKey.get(row.importKey),rowFp=fingerprint(row);
  if(existing&&!INACTIVE.has(existing.status)){
   if(existing.clubRowFp===rowFp){items.push({kind:'gleich',row:label,shiftId:existing.id});continue;}
   const cand=candidateFor(row,input,existing),reasons=protectedReasons(existing),issues=issuesFor(cand),blocked=issues.some(i=>i.level==='error');
   items.push({kind:reasons.length?'konflikt':blocked?'fehler':'geaendert',action:'update',row:label,shiftId:existing.id,before:{start:existing.start,end:existing.end,zone:existing.zone,area:existing.area,breakMinutes:existing.breakMinutes,personId:existing.personId},candidate:cand,issues,reasons,blocked,text:blocked?issues.find(i=>i.level==='error').text:null});
   continue;
  }
  const cand=candidateFor(row,input,null),issues=issuesFor(cand);
  if(existing&&!removed?.[row.importKey]){
   // in DP2 gelöscht, aber nicht von dieser Übernahme: nur auf ausdrücklichen Wunsch wieder anlegen
   const blocked=issues.some(i=>i.level==='error');
   items.push({kind:'konflikt',action:'create',row:label,shiftId:existing.id,candidate:cand,issues,reasons:['in DP2 gelöscht'],blocked,text:blocked?issues.find(i=>i.level==='error').text:null});continue;
  }
  const manual=overlapsManual(cand);
  if(manual.length){items.push({kind:'fehler',row:label,candidate:cand,issues,text:'Überschneidung mit vorhandenem DP2-Dienst – übersprungen (DP2-Dienste werden nicht ersetzt).'});continue;}
  const blocked=issues.some(i=>i.level==='error');
  items.push({kind:blocked?'fehler':'neu',action:'create',row:label,candidate:cand,issues,blocked,text:blocked?issues.find(i=>i.level==='error').text:null});
 }
 const skipped=Array.isArray(input?.uebersprungen)?input.uebersprungen.filter(u=>u&&typeof u==='object'):[];
 // Bei Fehlern ist der vollständige Stand nicht verlässlich: keine Löschung ableiten,
 // auch dann nicht, wenn Personen-ID oder Übernahmeschlüssel nicht mehr zuordenbar sind.
 const incomplete=items.some(i=>i.kind==='fehler'||i.blocked);
 for(const s of byKey.values()){
  if(INACTIVE.has(s.status)||seen.has(s.sourceImportKey))continue;
  const reasons=protectedReasons(s),label={personId:s.personId,name:'',date:s.date,start:s.start,end:s.end,zone:s.zone,area:s.area,importKey:s.sourceImportKey};
  let lockError=null;try{K.locks?.requireEditable?.(s.date);}catch(e){lockError=e.message;}
  // Die Club-App hat zu dieser Person/diesem Tag nichts übergeben (Person nicht eindeutig, Tag nicht veröffentlicht, ausgenommen):
  // das ist keine Planänderung → nicht von selbst löschen, nur auf ausdrückliche Wahl.
  const why=skipped.find(u=>(u.date==null||u.date===s.date)&&(canonicalId(u.personId)===s.personId||(Array.isArray(u.personIds)&&u.personIds.map(canonicalId).includes(s.personId))));
  if(why)reasons.unshift(String(why.grund||'In der Club-App nicht übergeben').slice(0,80));
  const deletionError=lockError||(incomplete?'Übergabe enthält Fehler. Vorhandener Dienst bleibt erhalten; Löschung erst nach einer fehlerfreien neuen Vorschau.':null);
  items.push({kind:deletionError?'fehler':reasons.length?'konflikt':'entfaellt',action:'delete',row:label,shiftId:s.id,reasons,skip:why?String(why.grund||'In der Club-App nicht übergeben').slice(0,80):null,blocked:!!deletionError,text:deletionError});
 }
 const counts={neu:0,geaendert:0,entfaellt:0,gleich:0,konflikt:0,fehler:0};for(const i of items)counts[i.kind]++;
 // Nicht nur das vorgeschlagene Ergebnis vergleichen: bereits als Konflikt markierte
 // Dienste können sich nochmals ändern, ohne dass sich Art oder Club-Vorschlag ändern.
 const signature=JSON.stringify({items:items.map(i=>[i.kind,i.action||'',i.row.importKey,i.shiftId||'',i.candidate?.clubShiftFp||'',i.blocked?1:0,i.reasons||[],i.issues||[]]),shifts:K.shifts||[],actualShifts:K.actualShifts||[],swapRequests:K.swapRequests||[],removed});
 return {id:input?.id||null,pruefsumme:input?.pruefsumme||null,stand:input?.stand||null,items,counts,signature,changes:counts.neu+counts.geaendert+counts.entfaellt+counts.konflikt};
}
// Was bei „Übernehmen“ passiert: neu/geändert/entfällt immer, Konflikte nur mit Wahl 'club'.
function plannedOps(analysis,choices={}){
 return analysis.items.filter(i=>!i.blocked&&(['neu','geaendert','entfaellt'].includes(i.kind)||(i.kind==='konflikt'&&choices[i.row.importKey]==='club')));
}
function applyOps(ops,input){
 const res={added:0,updated:0,removed:0,removedKeys:[]};
 const reason=`Club-App-Sollplan ${String(input.id).slice(0,8)}`;
 for(const op of ops.filter(o=>o.action==='delete')){K.mutations.deleteShift(op.shiftId,{reason:reason+': entfällt'});res.removed++;res.removedKeys.push(op.row.importKey);}
 for(const op of ops.filter(o=>o.action==='update')){const c=clone(op.candidate);K.mutations.saveShift(c,{existingId:op.shiftId,reason:reason+': geändert'});res.updated++;}
 for(const op of ops.filter(o=>o.action==='create')){const c=clone(op.candidate);K.mutations.saveShift(c,{existingId:null,reason:reason+': neu'});res.added++;}
 return res;
}
async function planningAllowed(){
 if(K.auth?.has?.('roster.plan.edit')!==true)return false;
 if(!K.daysPublishBridge?.planningMembership)return false;
 return !!await K.daysPublishBridge.planningMembership();
}
async function fetchPending(){
 const reply=await K.supabaseConnection.sollInboxPending({eventId:eventId()});
 if(!reply||!reply.id)return null;
 if(reply.eventId&&reply.eventId!==eventId())return null;
 if(!Array.isArray(reply.rows))throw Error('Ungültige Antwort der Club-App-Übergabe.');
 return reply;
}
async function check({force=false}={}){
 if(state.inFlight)return {skipped:true,reason:'already_running'};
 if(!force&&Date.now()-state.lastCheckAt<POLL_MS)return {skipped:true,reason:'throttled'};
 if(K.planningDataReady===false)return {skipped:true,reason:'planning_data_loading'};
 if(K.workMode&&!K.workPeopleReady)return {skipped:true,reason:'people_not_ready'};
 if(!K.supabaseConnection?.sollInboxPending||!K.supabaseConnection?.hasAccessToken?.())return {skipped:true,reason:'offline'};
 state.inFlight=true;state.lastCheckAt=Date.now();
 try{
  if(!await planningAllowed()){state.pending=null;state.analysis=null;return {skipped:true,reason:'role'};}
  const input=await fetchPending();state.pending=input;state.analysis=input?analyze(input):null;
  if(input&&state.analysis&&!state.analysis.changes&&(store().lastApplied?.id===input.id||!state.analysis.counts.fehler)){
   // Stand ist schon vollständig übernommen (z. B. Bestätigung ging verloren): still bestätigen.
   try{await ack(input,'uebernommen',{...state.analysis.counts,autoAck:true});}catch(_){}
  }
  state.lastError=null;render();return {ok:true,pending:!!input,counts:state.analysis?.counts||null};
 }catch(e){state.lastError=e.message||String(e);return {failed:true,error:state.lastError};}
 finally{state.inFlight=false;}
}
async function ack(input,status,result){
 const reply=await K.supabaseConnection.sollInboxAck({id:input.id,status,result});
 if(reply?.ok===true||reply?.stale===true){if(state.pending?.id===input.id){state.pending=null;state.analysis=null;}render();return reply;}
 throw Error('Bestätigung an die Club-App fehlt.');
}
async function apply(choices={}){
 if(state.inFlight)throw Error('Ein Abgleich läuft bereits. Bitte kurz warten.');
 const preview=state.analysis,previewInput=state.pending;if(!preview||!previewInput)throw Error('Bitte die Vorschau neu öffnen.');
 state.inFlight=true;
 const context=scopeKey(),tag=`clubsoll:${previewInput.id}`;let mutated=false,result=null,snapshot=null,auditStart=0,storeBefore=null;
 try{
  K.auth.require('roster.plan.edit','Sie dürfen den Sollplan nicht bearbeiten.');
  if(!await planningAllowed())throw Error('Nur berechtigte Planer dürfen den Club-App-Sollplan übernehmen.');
  if(K.sync?.hasProvider?.()){const pulled=await K.sync.pull();if(pulled?.conflicts||pulled?.conflict)throw Error('Es gibt offene Synchronisationskonflikte. Bitte diese zuerst klären.');}
  const input=await fetchPending();
  if(!input||input.id!==previewInput.id||input.pruefsumme!==previewInput.pruefsumme)throw Error('Inzwischen liegt ein neuerer Stand der Club-App vor. Bitte die Vorschau neu öffnen.');
  if(context!==scopeKey())throw Error('Die Veranstaltung wurde geändert.');
  const fresh=analyze(input);
  if(fresh.signature!==preview.signature)throw Error('Der Sollplan wurde seit der Vorschau geändert. Bitte die Vorschau neu öffnen.');
  const ops=plannedOps(fresh,choices);
  const run=()=>applyOps(ops,input);
  snapshot=clone(K.shifts);auditStart=(K.auditLog||[]).length;storeBefore=clone(store());mutated=true;
  result=K.sync?.stageLocalBatch?K.sync.stageLocalBatch(tag,run):run();
  const s=store();for(const key of result.removedKeys)s.removed[key]=new Date().toISOString();
  for(const op of ops.filter(o=>o.action==='create'))delete s.removed[op.row.importKey];
  s.lastApplied={id:input.id,pruefsumme:input.pruefsumme,at:new Date().toISOString()};
  const persisted=await K.persistAll?.();
  if(K.cloudPrimary?.active?.()&&persisted?.confirmed!==true)throw Error('Planungsdaten noch nicht von Supabase bestätigt. Die Übernahme wurde zurückgenommen.');
  K.sync?.settleLocalBatch?.(tag,true);mutated=false;
  K.historyManager?.record?.('Club-App-Sollplan übernommen');
  K.recordAudit?.('Club-App-Sollplan übernommen',{entity:'club_soll_inbox',entityId:input.id,reason:`Club-App-Sollplan ${input.id}`,after:{...fresh.counts,added:result.added,updated:result.updated,removed:result.removed}});
  const summary={added:result.added,updated:result.updated,removed:result.removed,unchanged:fresh.counts.gleich,kept:fresh.counts.konflikt-ops.filter(o=>o.kind==='konflikt').length,skipped:fresh.counts.fehler,problems:fresh.items.filter(i=>i.kind==='fehler').slice(0,40).map(i=>({importKey:i.row.importKey,text:i.text})),dp2Version:K.VERSION,build:typeof window!=='undefined'?window.KC_DP_BUILD||null:null};
  state.lastResult=summary;
  try{await ack(input,'uebernommen',summary);}catch(e){state.notice='Übernommen und gespeichert. Die Bestätigung an die Club-App wird beim nächsten Abruf nachgeholt.';}
  return summary;
 }catch(e){
  if(mutated){
   K.shifts=snapshot;if(storeBefore)K.memberUxData.clubSollInbox[context]=storeBefore;if(Array.isArray(K.auditLog))K.auditLog.length=Math.min(K.auditLog.length,auditStart);
   K.sync?.settleLocalBatch?.(tag,false);
   try{await K.persistAll?.();}catch(_){}
   K.refreshWorkflowState?.();
  }
  state.lastError=e.message||String(e);throw e;
 }finally{state.inFlight=false;render();}
}
async function discard(){
 const input=state.pending;if(!input)return null;
 if(!await planningAllowed())throw Error('Nur berechtigte Planer dürfen die Übergabe verwerfen.');
 return ack(input,'verworfen',{verworfen:true,dp2Version:K.VERSION});
}

// ---------- Oberfläche (nur im Sollplan, nur für Planer) ----------
// Nur im aktiven Register „Sollplan“ (nicht Dashboard/Stundenmatrix, die ebenfalls layer 'planned' nutzen).
function plannedRegister(){
 const active=K.v020Shell?.state?.active??K.v020ShellState?.active??(typeof document!=='undefined'?document.body?.dataset?.v020Register:undefined);
 return active!=null?active==='planned':K.state?.layer==='planned';
}
const el=id=>typeof document!=='undefined'?document.getElementById(id):null;
function closeModal(){el('modalBackdrop')?.classList.add('hidden');const m=el('modal');if(m){m.innerHTML='';m.classList.remove('wide');}document.body?.classList?.remove('modal-open');}
function openModal(html){const b=el('modalBackdrop'),m=el('modal');if(!b||!m)return null;m.classList.add('wide');m.innerHTML=html;b.classList.remove('hidden');document.body.classList.add('modal-open');return m;}
const personName=id=>K.person?.(canonicalId(id))?.name||id;
const standText=v=>{try{return new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:K.eventConfig?.timezone||'Europe/Berlin'}).format(new Date(v));}catch(_){return String(v||'');}};
function hintText(a){
 const c=a.counts,parts=[];
 if(!clubShifts().length)return `📥 Plan aus der Club-App übernehmen (${c.neu+c.geaendert+c.konflikt+c.fehler+c.gleich} Schichten${state.pending?.stand?', Stand '+esc(standText(state.pending.stand)):''})`;
 if(c.neu)parts.push(`${c.neu} neu`);if(c.geaendert)parts.push(`${c.geaendert} geändert`);if(c.entfaellt)parts.push(`${c.entfaellt} entfällt`);if(c.konflikt)parts.push(`${c.konflikt} zu prüfen`);
 return `📥 Änderungen aus der Club-App: ${parts.join(' · ')||'keine'}`;
}
function render(){
 if(typeof document==='undefined'||!document.body)return;
 const a=state.analysis,show=!!(a&&(a.changes||a.counts.fehler)&&plannedRegister()&&K.auth?.has?.('roster.plan.edit'));
 let bar=el('clubSollHint');
 if(!show){if(bar)bar.remove();return;}
 const main=el('mainView');if(!main?.parentNode)return;
 if(!bar){bar=document.createElement('div');bar.id='clubSollHint';bar.setAttribute('role','status');bar.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 12px;padding:8px 12px;border-radius:10px;background:#eef5ff;border:1px solid #9bb9e0;color:#1d3557;font-weight:600';main.parentNode.insertBefore(bar,main);}
 const text=hintText(a);
 if(bar.dataset.text!==text){bar.dataset.text=text;bar.innerHTML=`<span>${text}</span><button type="button" id="clubSollOpen" class="primary" style="min-height:36px">Ansehen</button>`;bar.querySelector('#clubSollOpen').onclick=()=>preview();}
}
const kindLabel={neu:'➕ neu',geaendert:'✏️ geändert',entfaellt:'➖ entfällt',konflikt:'⚠️ in DP2 geändert',fehler:'⛔ nicht übernehmbar',gleich:'＝ unverändert'};
function rowText(i){const r=i.row,c=i.candidate;const zeit=c?`${time(c.start)}–${time(c.end)}`:`${time(r.start)}–${time(r.end)}`;return `<b>${esc(personName(r.personId)||r.name)}</b> · ${esc(r.date)} · ${zeit}${c?.breakMinutes?` · Pause ${c.breakMinutes} Min.`:''} · ${esc(c?.area||r.area||'')}`;}
function preview(){
 if(!state.pending)return;
 const a=state.analysis=analyze(state.pending);
 const order=['neu','geaendert','entfaellt','konflikt','fehler'];
 const list=order.flatMap(k=>a.items.filter(i=>i.kind===k)).map(i=>{
  let extra='';
  if(i.kind==='geaendert'&&i.before)extra=`<small>bisher ${time(i.before.start)}–${time(i.before.end)} · ${esc(i.before.area||'')}</small>`;
  if(i.kind==='konflikt'){const was=i.action==='delete'?'entfernen':i.action==='create'?'wieder anlegen':`${time(i.candidate.start)}–${time(i.candidate.end)}`;
   extra=`<small>${esc(i.reasons.join(', '))} – Club-Vorschlag: ${esc(was)}</small><label style="display:inline-flex;gap:6px;margin-right:12px"><input type="radio" name="cs-${esc(i.row.importKey)}" value="keep" checked data-cs-key="${esc(i.row.importKey)}"> DP2 behalten</label><label style="display:inline-flex;gap:6px"><input type="radio" name="cs-${esc(i.row.importKey)}" value="club" data-cs-key="${esc(i.row.importKey)}" ${i.blocked?'disabled':''}> Club-Stand übernehmen</label>${i.blocked?`<small>${esc(i.text)}</small>`:''}`;}
  if(i.kind==='fehler')extra=`<small>${esc(i.text||'')}</small>`;
  const warn=(i.issues||[]).filter(x=>x.level!=='error').map(x=>esc(x.text)).join(' · ');
  return `<div class="${i.kind==='fehler'?'bad':i.kind==='konflikt'?'warn':'ok'}" data-cs-kind="${i.kind}">${i.skip?'➖ entfällt? – '+esc(i.skip):kindLabel[i.kind]} · ${rowText(i)}${extra}${warn&&i.kind!=='fehler'?`<small>${warn}</small>`:''}</div>`;}).join('');
 const c=a.counts;
 const m=openModal(`<h2>📥 Sollplan aus der Club-App</h2><div class="transfer-stats"><span><b>${c.neu}</b><small>neu</small></span><span><b>${c.geaendert}</b><small>geändert</small></span><span><b>${c.entfaellt}</b><small>entfällt</small></span><span><b>${c.konflikt}</b><small>zu prüfen</small></span><span><b>${c.gleich}</b><small>unverändert</small></span><span><b>${c.fehler}</b><small>nicht übernehmbar</small></span></div><div class="ai-summary">Stand der Club-App: ${esc(standText(state.pending?.stand||state.pending?.createdAt))}. Übernommene Dienste kommen als Entwurf in den Sollplan; von Hand in DP2 angelegte Dienste bleiben unberührt. Erst wenn der Plan fertig ist übernehmen – danach geht er wie jeder DP2-Sollplan an die Kasse. Bereitschaft kommt nicht mit.</div><div class="transfer-list">${list||'<div>Keine Änderungen.</div>'}</div><p id="clubSollResult" role="status"></p><div class="modal-actions"><button class="secondary" id="csClose">Schließen</button><button class="secondary" id="csDiscard">Verwerfen</button><button class="primary" id="csApply">Übernehmen</button></div>`);
 if(!m)return;
 el('csClose').onclick=closeModal;
 el('csDiscard').onclick=async()=>{if(!confirm('Diesen Stand der Club-App verwerfen? Im Sollplan ändert sich nichts.'))return;try{await discard();closeModal();}catch(e){el('clubSollResult').textContent='✕ '+e.message;}};
 el('csApply').onclick=async()=>{
  const choices={};m.querySelectorAll('input[data-cs-key]:checked').forEach(x=>{choices[x.dataset.csKey]=x.value;});
  const n=plannedOps(state.analysis,choices).length;
  if(!confirm(`${n} Änderungen in den Sollplan übernehmen?`))return;
  el('csApply').disabled=true;
  try{const r=await apply(choices);el('clubSollResult').textContent=`✓ ${r.added} neu, ${r.updated} geändert, ${r.removed} entfernt, ${r.kept} in DP2 behalten, ${r.skipped} nicht übernehmbar.${state.notice?' '+state.notice:''}`;el('csApply').hidden=true;el('csDiscard').hidden=true;K.v020Shell?.select?.('planned',{quiet:true});}
  catch(e){el('clubSollResult').textContent='✕ '+e.message;el('csApply').disabled=false;}
 };
}
function install(){
 if(typeof document==='undefined'||!document.addEventListener)return;
 const onRegister=()=>setTimeout(()=>{if(plannedRegister())check().catch(()=>{});render();},0);
 try{window.addEventListener?.('kc-v020-register-change',onRegister);}catch(_){}
 let pending=false;
 try{new MutationObserver(()=>{if(pending)return;pending=true;(window.requestAnimationFrame||setTimeout)(()=>{pending=false;render();});}).observe(document.body,{childList:true});}catch(_){}
 setTimeout(onRegister,4000);
}
if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
K.clubSollInbox={version:VERSION,state,fingerprint,analyze,plannedOps,applyOps,check,apply,discard,preview,render,store,protectedReasons,plannedRegister};
})();
