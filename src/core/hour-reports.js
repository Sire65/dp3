// DP2-F-SE-02 Stundenmeldungen zu Sondereinsätzen (KICC-F-100, Phase 2).
// Ein Kollege meldet seine Zeit und wählt weitere Kollegen aus, die dabei waren – jeweils mit eigenem Stundenumfang
// (Sammelmeldung). Jede Person erhält eine eigene Zeile mit gemeinsamer sammelId. Die Stunden zählen erst, wenn der
// Planer bestätigt (Phase 3); bis dahin stehen sie im Personenkonto als „gemeldet, noch nicht bestätigt“.
// Fahrzeit von zuhause bis zuhause zählt mit (Betreiber 2026-10-15), daher Ende bis 30:00 (= 06:00 Folgetag).
// Transport austauschbar (AGENTS 18): K.hourReportsTransport.submit (Club App → kc-club) oder lokal in DP2.
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const VERSION='0.2.0';
  const DEADLINE_DAYS=3,MAX_PERSONS=30,MAX_SPAN=16,MAX_END=30,MAX_BREAK=180,MAX_NOTE=500;
  K.hourReports=Array.isArray(K.hourReports)?K.hourReports:[];
  // Auswahl statt Freitext (AGENTS 13); austauschbare Liste (AGENTS 4).
  K.hourReportActivities=Array.isArray(K.hourReportActivities)?K.hourReportActivities:[
    {id:'kochen',label:'Kochen'},
    {id:'vorbereitung',label:'Vorbereitung'},
    {id:'transport',label:'Transport / Fahrt'},
    {id:'einkauf',label:'Einkauf / Besorgung'},
    {id:'getraenke',label:'Getränke mischen'},
    {id:'aufraeumen',label:'Aufräumen / Spülen'},
    {id:'sonstiges',label:'Sonstiges'}
  ];
  const OPEN=['gemeldet','bestaetigt'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const isoDate=v=>{const s=String(v||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const d=new Date(s+'T12:00:00Z');return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==s?null:s;};
  const todayIso=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const quarter=v=>Number.isFinite(v)&&Math.abs(v*4-Math.round(v*4))<1e-9;
  const self=()=>K.currentUser?.personId||null;
  const activityLabel=id=>K.hourReportActivities.find(a=>a.id===id)?.label||id;

  function events(){return (K.specialEventsCore?.list?.()||[]).filter(e=>e.aktiv!==false);}
  function eventById(id){return events().find(e=>e.id===id)||null;}
  // Einsätze, für die gemeldet werden kann: Termin nicht mehr offen und (falls Termine bekannt) mindestens ein Tag erreicht.
  function reportableEvents(today=todayIso()){
    return events().map(e=>({...e,reportable:e.effective.terminStatus!=='OFFEN'&&(!e.effective.dates.length||e.effective.dates.some(d=>d<=today))})).sort((a,b)=>Number(b.reportable)-Number(a.reportable)||String(a.effective.datumVon||'9999').localeCompare(String(b.effective.datumVon||'9999')));
  }
  function allowedDates(ev,today=todayIso()){return ev.effective.terminStatus==='FEST'&&ev.effective.dates.length?ev.effective.dates.filter(d=>d<=today):[];}
  function hoursOf(r){const gross=Math.max(0,Number(r.end)-Number(r.start));return K.breakConfig?.hoursAccounting==='deducted'?Math.max(0,gross-Math.max(0,Number(r.breakMinutes)||0)/60):gross;}
  function deadline(date,today=todayIso()){const last=addDays(date,DEADLINE_DAYS);const left=Math.round((new Date(last+'T12:00:00Z')-new Date(today+'T12:00:00Z'))/86400000);return {last,left,late:left<0};}
  function overlapping(personId,date,start,end,specialEventId){return K.hourReports.find(r=>r.personId===personId&&r.date===date&&r.specialEventId===specialEventId&&OPEN.includes(r.status)&&Number(r.start)<end&&Number(r.end)>start)||null;}

  function validate(sub,{today=todayIso()}={}){
    const errors=[],ev=eventById(sub?.specialEventId);
    if(!ev)errors.push('Bitte einen Sondereinsatz aus der Liste wählen.');
    else if(ev.effective.terminStatus==='OFFEN')errors.push('Für diesen Einsatz steht der Termin noch nicht fest.');
    const date=isoDate(sub?.date);
    if(!date)errors.push('Bitte ein gültiges Datum wählen.');
    else{
      if(date>today)errors.push('Stunden können erst nach dem Einsatz gemeldet werden.');
      const allowed=ev?allowedDates(ev,'9999-12-31'):[];
      if(allowed.length&&!allowed.includes(date))errors.push('Das Datum gehört nicht zu diesem Einsatz.');
    }
    if(!K.hourReportActivities.some(a=>a.id===sub?.taetigkeit))errors.push('Bitte eine Tätigkeit aus der Liste wählen.');
    if(String(sub?.bemerkung||'').length>MAX_NOTE)errors.push('Die Bemerkung ist zu lang.');
    const entries=Array.isArray(sub?.eintraege)?sub.eintraege:[];
    if(!entries.length)errors.push('Bitte mindestens eine Person mit Zeiten angeben.');
    if(entries.length>MAX_PERSONS)errors.push(`Höchstens ${MAX_PERSONS} Personen je Meldung.`);
    const seen=new Set();
    for(const e of entries){
      const p=(K.people||[]).find(x=>x.personId===e?.personId),name=p?.name||e?.personId||'?';
      if(!p||p.active===false){errors.push(`Unbekannte Person: ${name}.`);continue;}
      if(seen.has(e.personId)){errors.push(`${name} ist doppelt ausgewählt.`);continue;}seen.add(e.personId);
      const s=Number(e.start),en=Number(e.end),b=Number(e.breakMinutes||0);
      if(!quarter(s)||!quarter(en)||s<0||s>=24||en<=s||en>MAX_END)errors.push(`${name}: Bitte gültige Von-/Bis-Zeiten wählen.`);
      else if(en-s>MAX_SPAN)errors.push(`${name}: Mehr als ${MAX_SPAN} Stunden am Stück bitte beim Planer melden.`);
      if(!Number.isInteger(b)||b<0||b>MAX_BREAK||b/60>=Math.max(0,en-s))errors.push(`${name}: Die Pause passt nicht zur Zeit.`);
    }
    return errors;
  }

  function buildRows(sub,{sammelId,today=todayIso(),source='dp2'}={}){
    const ev=eventById(sub.specialEventId),late=deadline(sub.date,today).late,created=[],skipped=[];
    for(const e of sub.eintraege){
      const start=Number(e.start),end=Number(e.end);
      const dup=overlapping(e.personId,sub.date,start,end,sub.specialEventId);
      if(dup){skipped.push({personId:e.personId,grund:'schon gemeldet',vorhandenId:dup.id});continue;}
      created.push({id:`HR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,sammelId,eventId:ev.eventId||K.eventConfig?.eventId||'KC-WM-2026',specialEventId:ev.id,specialEventTitle:ev.titel,personId:e.personId,gemeldetVon:self(),date:sub.date,start,end,breakMinutes:Number(e.breakMinutes||0),taetigkeit:sub.taetigkeit,bemerkung:String(sub.bemerkung||'').trim(),status:'gemeldet',verspaetet:late,gemeldetAm:new Date().toISOString(),source,version:1});
    }
    return {created,skipped};
  }

  function merge(rows){
    let changed=0;
    for(const r of rows||[]){
      if(!r?.id||!r.personId||!isoDate(r.date))continue;
      const i=K.hourReports.findIndex(x=>x.id===r.id);
      if(i<0){K.hourReports.push(clone(r));changed++;}
      else if(Number(r.version||0)>=Number(K.hourReports[i].version||0)){K.hourReports[i]={...K.hourReports[i],...clone(r)};changed++;}
    }
    if(changed)notify();
    return changed;
  }

  async function submit(sub,{today=todayIso()}={}){
    if(!self())throw new Error('Bitte zuerst anmelden.');
    const clean={specialEventId:sub?.specialEventId,date:isoDate(sub?.date),taetigkeit:sub?.taetigkeit,bemerkung:String(sub?.bemerkung||'').trim(),eintraege:(sub?.eintraege||[]).map(e=>({personId:e.personId,start:Number(e.start),end:Number(e.end),breakMinutes:Number(e.breakMinutes||0)}))};
    const errors=validate(clean,{today});if(errors.length)throw new Error(errors.join(' '));
    const transport=K.hourReportsTransport;
    if(transport?.submit){
      const res=await transport.submit(clean);
      merge(res?.rows||[]);
      K.recordAudit?.('hour_report.submit',{entity:'hour_report',entityId:res?.sammelId||null,after:{count:(res?.rows||[]).length,skipped:(res?.skipped||[]).length,via:'transport'}});
      return {sammelId:res?.sammelId||null,created:res?.rows||[],skipped:res?.skipped||[]};
    }
    const sammelId=`SM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const {created,skipped}=buildRows(clean,{sammelId,today});
    K.hourReports.push(...clone(created));
    for(const r of created){K.recordAudit?.('hour_report.submit',{entity:'hour_report',entityId:r.id,after:r});K.sync?.enqueue?.({entity:'hour_report',operation:'create',payload:clone(r),baseVersion:null});}
    notify();
    try{await K.persistAll?.();}catch(_){/* Speicherfehler meldet die App selbst */}
    return {sammelId,created,skipped};
  }

  // Planer: offene Meldungen aus dem Club-App-Eingang (Supabase) abholen.
  async function pull(){
    if(!K.supabaseConnection?.hourReportsPending)throw new Error('Supabase-Verbindung nicht bereit.');
    const rows=await K.supabaseConnection.hourReportsPending({eventId:K.eventConfig?.eventId||'KC-WM-2026'});
    const n=merge((rows||[]).map(fromRemote));
    K.recordAudit?.('hour_report.pull',{entity:'hour_report',after:{received:(rows||[]).length,changed:n}});
    return {received:(rows||[]).length,changed:n};
  }
  // Supabase-Zeile (snake_case) → DP2-Zeile.
  function fromRemote(r){
    return {id:String(r.id),sammelId:r.sammel_id||r.sammelId||null,eventId:r.event_id||r.eventId,specialEventId:r.special_event_id||r.specialEventId,specialEventTitle:r.special_event_title||r.specialEventTitle||'',personId:r.person_id||r.personId,gemeldetVon:r.gemeldet_von||r.gemeldetVon||null,date:r.work_date||r.date,start:Number(r.start_h??r.start),end:Number(r.end_h??r.end),breakMinutes:Number(r.break_minutes??r.breakMinutes??0),taetigkeit:r.taetigkeit,bemerkung:r.bemerkung||'',status:r.status,verspaetet:!!r.verspaetet,gemeldetAm:r.gemeldet_am||r.gemeldetAm||null,entschiedenVon:r.entschieden_von||null,entschiedenAm:r.entschieden_am||null,ablehngrund:r.ablehngrund||null,source:r.source||'club_app',version:Number(r.version||1)};
  }


  // ---------- Phase 3 (DP2-F-SE-03): Planer entscheidet. Bestätigt = Ist-Zeit über den vorhandenen Ist-Kern (K.actual.saveActual). ----------
  const isRemote=r=>r.source==='club_app'&&/^[0-9a-f-]{36}$/i.test(String(r.id));
  const byId=id=>K.hourReports.find(r=>r.id===id)||null;
  function canDecide(){return K.auth?.has?K.auth.has('roster.actual.import'):true;}
  // Hinweise vor dem Bestätigen (keine Sperre): Doppelzeiten, verspätet, Person unbekannt, Istplan abgeschlossen.
  function warnings(id){
    const r=byId(id);if(!r)return [];const out=[];
    if(!(K.people||[]).some(p=>p.personId===r.personId&&p.active!==false))out.push({level:'error',code:'person_unknown',text:'Diese Person ist in DP2 nicht als aktive Person angelegt.'});
    const same=(K.actualShifts||[]).filter(a=>a.personId===r.personId&&a.date===r.date&&a.status!=='deleted'&&a.hourReportId!==r.id&&Math.max(Number(a.start),Number(r.start))<Math.min(Number(a.end),Number(r.end)));
    for(const a of same)out.push({level:'warn',code:'overlap',text:`Überschneidet sich mit einer Istzeit ${fmt(a.start)}–${fmt(a.end)} (${a.source==='timeclock'?'Stempeluhr':a.source==='self_report'?'andere Meldung':'Ist'}).`});
    if(r.verspaetet)out.push({level:'info',code:'late',text:'Nach Ablauf der Meldefrist (3 Tage) gemeldet.'});
    if(K.actualWorkflow?.status==='closed')out.push({level:'error',code:'closed',text:'Der Istplan ist abgeschlossen. Für einen Nachtrag zuerst wieder öffnen.'});
    return out;
  }
  const fmt=h=>{const v=Number(h),x=v>=24?v-24:v;return `${String(Math.floor(x)).padStart(2,'0')}:${String(Math.round(x%1*60)).padStart(2,'0')}${v>=24?' (+1)':''}`;};
  function pending(){return K.hourReports.filter(r=>r.status==='gemeldet');}
  function groups({status='gemeldet'}={}){
    const map=new Map();
    for(const r of K.hourReports.filter(x=>status==='alle'||(status==='erledigt'?['bestaetigt','abgelehnt'].includes(x.status):x.status===status))){const k=r.sammelId||r.id;if(!map.has(k))map.set(k,[]);map.get(k).push(r);}
    return [...map.entries()].map(([sammelId,rows])=>({sammelId,rows:rows.sort((a,b)=>String(K.person?.(a.personId)?.name||a.personId).localeCompare(String(K.person?.(b.personId)?.name||b.personId),'de')),first:rows[0]})).sort((a,b)=>String(a.first.date).localeCompare(String(b.first.date))||String(a.first.gemeldetAm||'').localeCompare(String(b.first.gemeldetAm||'')));
  }
  async function decide(id,{status,reason=''}={}){
    K.auth?.require?.('roster.actual.import','Sie dürfen Stundenmeldungen nicht entscheiden.');
    const r=byId(id);if(!r)throw new Error('Meldung nicht gefunden.');
    if(r.status!=='gemeldet')throw new Error('Diese Meldung ist bereits entschieden.');
    if(!['bestaetigt','abgelehnt'].includes(status))throw new Error('Bitte bestätigen oder ablehnen.');
    if(status==='abgelehnt'&&!String(reason).trim())throw new Error('Für eine Ablehnung ist ein Grund erforderlich.');
    let candidate=null;
    if(status==='bestaetigt'){
      const blocking=warnings(id).filter(w=>w.level==='error');if(blocking.length)throw new Error(blocking.map(w=>w.text).join(' '));
      const title=r.specialEventTitle||K.specialEventsCore?.get?.(r.specialEventId)?.titel||'Sondereinsatz';
      candidate={id:`A-SE-${String(r.id).slice(0,40)}`,personId:r.personId,date:r.date,start:Number(r.start),end:Number(r.end),breakMinutes:Number(r.breakMinutes||0),zone:'special',area:`Z · ${title}`,specialEventId:r.specialEventId,specialEventTitle:title,hourReportId:r.id,sammelId:r.sammelId||null,taetigkeit:r.taetigkeit,status:'recorded'};
      const errs=(K.actual?.validateActual?.(candidate)||[]).filter(x=>x.level==='error');if(errs.length)throw new Error(errs.map(x=>x.text).join(' '));
    }
    // Erst die gemeinsame Quelle (Supabase) entscheiden, dann lokal buchen – so entsteht kein Mischstand (AGENTS 16).
    if(isRemote(r)){
      if(!K.supabaseConnection?.hourReportDecide)throw new Error('Supabase-Verbindung nicht bereit.');
      const res=await K.supabaseConnection.hourReportDecide({id:r.id,status,reason,actualId:candidate?.id||null});
      if(!res?.ok){await pull().catch(()=>{});throw new Error('Diese Meldung wurde inzwischen anders bearbeitet. Bitte die Liste neu laden.');}
    }
    const before=clone(r);
    if(candidate){const out=K.actual.saveActual(candidate,{reason:`Sonderstunden-Meldung ${r.id} bestätigt`,source:'self_report'});r.actualId=out?.record?.id||out?.id||candidate.id;}
    Object.assign(r,{status,ablehngrund:status==='abgelehnt'?String(reason).trim():null,entschiedenAm:new Date().toISOString(),entschiedenVon:self(),version:Number(r.version||1)+1});
    K.recordAudit?.(`hour_report.${status==='bestaetigt'?'confirm':'reject'}`,{entity:'hour_report',entityId:r.id,before,after:clone(r),reason});
    K.sync?.enqueue?.({entity:'hour_report',operation:'update',payload:clone(r),baseVersion:before.version});
    notify();
    try{await K.persistAll?.();}catch(_){/* Speicherfehler meldet die App selbst */}
    return clone(r);
  }
  async function decideGroup(sammelId,{status,reason=''}={}){
    const out={done:[],failed:[]};
    for(const r of pending().filter(x=>(x.sammelId||x.id)===sammelId)){try{out.done.push(await decide(r.id,{status,reason}));}catch(e){out.failed.push({id:r.id,personId:r.personId,error:e.message||String(e)});}}
    return out;
  }

  function mine(personId=self()){return K.hourReports.filter(r=>r.personId===personId||r.gemeldetVon===personId).sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(a.start)-Number(b.start));}
  function restore(saved){if(Array.isArray(saved))K.hourReports=saved.filter(r=>r&&r.id&&r.personId);notify();return K.hourReports.length;}
  function snapshot(){return clone(K.hourReports);}
  const listeners=new Set();
  function notify(){listeners.forEach(fn=>{try{fn()}catch(_){}});}

  K.hourReportsCore={VERSION,warnings,pending,groups,decide,decideGroup,canDecide,DEADLINE_DAYS,MAX_END,activityLabel,reportableEvents,allowedDates,hoursOf,deadline,validate,submit,merge,pull,fromRemote,mine,restore,snapshot,todayIso,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},_test:{buildRows,overlapping}};
})();
