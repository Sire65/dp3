// DP2-F-SE-02 Stundenmeldungen zu Sondereinsätzen (KICC-F-100, Phase 2).
// Ein Kollege meldet seine Zeit und wählt weitere Kollegen aus, die dabei waren – jeweils mit eigenem Stundenumfang
// (Sammelmeldung). Jede Person erhält eine eigene Zeile mit gemeinsamer sammelId. Die Stunden zählen erst, wenn der
// Planer bestätigt (Phase 3); bis dahin stehen sie im Personenkonto als „gemeldet, noch nicht bestätigt“.
// Fahrzeit von zuhause bis zuhause zählt mit (Betreiber 2026-10-15), daher Ende bis 30:00 (= 06:00 Folgetag).
// Transport austauschbar (AGENTS 18): K.hourReportsTransport.submit (Club App → kc-club) oder lokal in DP2.
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const VERSION='0.1.0';
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

  function mine(personId=self()){return K.hourReports.filter(r=>r.personId===personId||r.gemeldetVon===personId).sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(a.start)-Number(b.start));}
  function restore(saved){if(Array.isArray(saved))K.hourReports=saved.filter(r=>r&&r.id&&r.personId);notify();return K.hourReports.length;}
  function snapshot(){return clone(K.hourReports);}
  const listeners=new Set();
  function notify(){listeners.forEach(fn=>{try{fn()}catch(_){}});}

  K.hourReportsCore={VERSION,DEADLINE_DAYS,MAX_END,activityLabel,reportableEvents,allowedDates,hoursOf,deadline,validate,submit,merge,pull,fromRemote,mine,restore,snapshot,todayIso,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},_test:{buildRows,overlapping}};
})();
