// Build 307 · Ist-Rückmeldung nach dem Dienst (Vorgabe Hansi 08.11.2026).
// Die Club-App fragt nach jedem geplanten Dienst: „Dein Dienst heute war 11:00–15:00 – als Ist übernehmen?
// [Ja] [Andere Zeiten] [Ich war nicht da]“. Die Antworten speichert der Club-Server in kc_dp_dienst_rueckmeldung
// (nur service_role). DP2 liest und entscheidet ausschließlich über kc_dp_rueckmeldungen_liste und
// kc_dp_rueckmeldung_entscheiden (wie die Sonderstunden, src/core/hour-reports.js).
//
// Regeln:
// - „passt“ (= Soll) → planer_status automatisch → zählt sofort (Ist-Quelle self_confirm, Ist = Soll).
// - Abweichung ab 15 Min., „nicht_da“, „korrektur“ → zu_bestaetigen (Planer bestätigt), kleinere Abweichung → automatisch.
// - Geändert und bestätigt/automatisch → Ist-Quelle self_change, original = Soll.
// - Vorrang: Planer-Korrektur > Kasse/Stempeluhr/Import/manuell > Live-Buchung der App > diese Selbstauskunft.
//   Eine Selbstauskunft überschreibt nie eine vorhandene Buchung; dann steht sie nur als Hinweis im Kontoauszug.
// - Je Rückmeldung genau EINE Ist-Zeit (Feld istRueckmeldungId); neue Version → dieselbe Ist-Zeit aktualisieren.
// - nicht_da bestätigt → keine Ist-Zeit, der Solldienst gilt als „nicht da“ (keine fehlende Buchung).
// - abgelehnt → keine Ist-Zeit; zu_bestaetigen → zählt nicht, steht als „wartet auf Bestätigung“.
// - Zeiten kommen als timestamptz; DP2 rechnet mit Dezimalstunden am Diensttag (Europe/Berlin, 25,5 = 01:30 Folgetag).
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const VERSION='0.1.0';
  const SELF=['self_confirm','self_change'];
  const COUNTED=['automatisch','bestaetigt'];
  const POLL_MS=5*60000;
  K.istRueckmeldungen=Array.isArray(K.istRueckmeldungen)?K.istRueckmeldungen:[];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const isoDate=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;};
  const inactive=a=>!a||['deleted','cancelled','absent','failed'].includes(String(a.status||''));
  const self=()=>K.currentUser?.personId||null;
  const tz=()=>K.eventConfig?.timezone||'Europe/Berlin';
  let lastPullAt=0,pulling=null;

  // timestamptz → Dezimalstunden bezogen auf den Diensttag (Europe/Berlin). Nach Mitternacht > 24.
  function hoursOn(iso,workDate){
    if(iso==null||iso==='')return null;
    if(typeof iso==='number')return Number.isFinite(iso)?iso:null;
    const d=new Date(iso);if(Number.isNaN(d.getTime())||!isoDate(workDate))return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz(),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const v=t=>parts.find(p=>p.type===t)?.value;
    const local=`${v('year')}-${v('month')}-${v('day')}`;
    const days=Math.round((Date.parse(local+'T12:00:00Z')-Date.parse(workDate+'T12:00:00Z'))/86400000);
    return Math.round((days*24+Number(v('hour'))%24+Number(v('minute'))/60)*60)/60;
  }
  const fmt=h=>{if(!Number.isFinite(Number(h)))return '–';const v=Number(h),x=((v%24)+24)%24,m=Math.round(x*60);return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}${v>=24?' (+1)':''}`;};
  const span=(a,b)=>`${fmt(a)}–${fmt(b)}`;

  // Supabase-Zeile (snake_case, kc_dp_rueckmeldungen_liste) → DP2-Zeile.
  function fromRemote(r){
    const date=isoDate(r.work_date||r.date);
    const num=v=>v==null||v===''?null:Number(v);
    return {
      id:String(r.id),eventId:r.event_id||r.eventId||null,dienstRef:r.dienst_ref??r.dienstRef??null,personId:r.person_id||r.personId,date,bereich:r.bereich||'',
      sollStart:hoursOn(r.soll_start??r.sollStart,date),sollEnd:hoursOn(r.soll_ende??r.sollEnd,date),sollPause:Number(r.soll_pause??r.sollPause??0)||0,
      ergebnis:r.ergebnis??null,istStart:hoursOn(r.ist_start??r.istStart,date),istEnd:hoursOn(r.ist_ende??r.istEnd,date),pauseMin:num(r.pause_min??r.pauseMin),
      grund:r.grund||'',bemerkung:r.bemerkung||'',planerStatus:r.planer_status||r.planerStatus||'offen',planerGrund:r.planer_grund||r.planerGrund||'',
      entschiedenAm:r.entschieden_am||r.entschiedenAm||null,gefragtAm:r.gefragt_am||r.gefragtAm||null,beantwortetAm:r.beantwortet_am||r.beantwortetAm||null,
      version:Number(r.version||1),geaendertAm:r.geaendert_am||r.geaendertAm||null,
      // Zusatz Hansi 08.11.2026: Stimmung (1 😀 gut, 2 🙂 geht so, 3 ☹️ nicht gut) und Besetzung nach dem Dienst.
      zufrieden:[1,2,3].includes(Number(r.zufrieden))?Number(r.zufrieden):null,besetzung:['zu_wenig','passt','zu_viel'].includes(r.besetzung)?r.besetzung:null,feedbackAm:r.feedback_am||r.feedbackAm||null,
      raw:{sollStart:r.soll_start??null,sollEnde:r.soll_ende??null,istStart:r.ist_start??null,istEnde:r.ist_ende??null}
    };
  }
  function merge(rows){
    let changed=0;
    for(const r of rows||[]){
      if(!r?.id||!r.personId||!isoDate(r.date))continue;
      const i=K.istRueckmeldungen.findIndex(x=>x.id===r.id);
      if(i<0){K.istRueckmeldungen.push(clone(r));changed++;}
      else if(Number(r.version||0)>Number(K.istRueckmeldungen[i].version||0)||(Number(r.version||0)===Number(K.istRueckmeldungen[i].version||0)&&JSON.stringify({...K.istRueckmeldungen[i],...r})!==JSON.stringify(K.istRueckmeldungen[i]))){K.istRueckmeldungen[i]={...K.istRueckmeldungen[i],...clone(r)};changed++;}
    }
    if(changed)notify();
    return changed;
  }
  const byId=id=>K.istRueckmeldungen.find(r=>r.id===id)||null;

  // Ist-Zeiten, die diese Rückmeldung ergeben würde (passt = Soll).
  function times(r){
    if(r.ergebnis==='passt')return {start:r.sollStart,end:r.sollEnd,breakMinutes:Number(r.sollPause||0)};
    if(['geaendert','korrektur'].includes(r.ergebnis))return {start:r.istStart,end:r.istEnd,breakMinutes:r.pauseMin==null?Number(r.sollPause||0):Number(r.pauseMin)};
    return null;
  }
  function deltaMinutes(r){const t=times(r);if(!t||!Number.isFinite(t.start)||!Number.isFinite(r.sollStart))return null;const s=Math.round((t.start-r.sollStart)*60),e=Math.round((t.end-r.sollEnd)*60),d=Math.round(((t.end-t.start)-(r.sollEnd-r.sollStart))*60);return {start:s,end:e,duration:d};}
  function shiftFor(r){
    const list=(K.shifts||[]).filter(s=>s.layer==='planned'&&!inactive(s));
    const ref=r.dienstRef!=null?list.find(s=>String(s.id)===String(r.dienstRef)):null;if(ref)return ref;
    const same=list.filter(s=>s.personId===r.personId&&s.date===r.date);
    if(!Number.isFinite(r.sollStart))return same.length===1?same[0]:null;
    const ranked=same.map(s=>({s,ov:Math.min(Number(s.end),r.sollEnd)-Math.max(Number(s.start),r.sollStart)})).filter(x=>x.ov>0).sort((a,b)=>b.ov-a.ov);
    return ranked[0]?.s||null;
  }
  const ownActual=r=>(K.actualShifts||[]).find(a=>a.istRueckmeldungId===r.id&&a.status!=='deleted')||null;
  // Vorhandene Buchung mit Vorrang (alles, was nicht aus dieser Rückmeldung stammt) für denselben Dienst.
  function otherBooking(r){
    const shift=shiftFor(r),t=times(r)||{};
    const from=Math.min(...[r.sollStart,t.start].filter(Number.isFinite)),to=Math.max(...[r.sollEnd,t.end].filter(Number.isFinite));
    return (K.actualShifts||[]).find(a=>!inactive(a)&&a.istRueckmeldungId!==r.id&&a.personId===r.personId&&a.date===r.date&&(
      shift&&a.linkedShiftId===shift.id||(!a.linkedShiftId||!shift||a.linkedShiftId===shift.id)&&Number.isFinite(from)&&Number.isFinite(to)&&Math.max(Number(a.start),from)<Math.min(Number(a.end),to)))||null;
  }
  const counts=r=>['passt','geaendert','korrektur'].includes(r.ergebnis)&&COUNTED.includes(r.planerStatus);

  // Anzeigezustand einer Rückmeldung (Kontoauszug, Planer-Liste, Ist-Abgleich).
  function stateOf(r){
    const e=r.ergebnis,ps=r.planerStatus,t=times(r),own=ownActual(r);
    const base={row:r,soll:span(r.sollStart,r.sollEnd),ist:t?span(t.start,t.end):'',counted:false};
    // Nur Feedback (ergebnis null): mit vorhandener Buchung (Kasse/Stempeluhr) ist das keine fehlende Antwort.
    if(e==null){const b=otherBooking(r);return b?{...base,code:'gebucht',icon:'ℹ️',text:'Buchung vorhanden',booking:b}:{...base,code:'keine_antwort',icon:'⏳',text:'keine Antwort'};}
    if(ps==='abgelehnt')return {...base,code:'abgelehnt',icon:'❌',text:'abgelehnt'};
    if(!COUNTED.includes(ps))return {...base,code:'wartet',icon:'⏳',text:'wartet auf Bestätigung'};
    if(e==='nicht_da')return {...base,code:'nicht_da',icon:'🚫',text:'nicht da'};
    if(own&&own.source==='manual_correction')return {...base,code:own.istRueckmeldungKorrektur?'korrigiert':'planer_korrektur',icon:'✏️',text:own.istRueckmeldungKorrektur?'Buchung nach Rückmeldung korrigiert':'vom Planer korrigiert',counted:true,actual:own};
    if(own&&SELF.includes(own.source))return {...base,code:own.source==='self_confirm'?'bestaetigt':'geaendert',icon:own.source==='self_confirm'?'✅':'✏️',text:own.source==='self_confirm'?'bestätigt (Ist = Soll)':'geändert',counted:true,actual:own};
    const other=otherBooking(r);
    if(other)return {...base,code:e==='korrektur'?'korrektur_offen':'ueberlagert',icon:e==='korrektur'?'⏳':'ℹ️',text:e==='korrektur'?'Korrektur bestätigt – Buchung muss ein Zeitprüfer korrigieren':'Buchung vorhanden – Rückmeldung nur als Hinweis',booking:other};
    return {...base,code:'nicht_gebucht',icon:'⏳',text:K.actualWorkflow?.status==='closed'?'bestätigt, Istplan abgeschlossen – noch nicht gebucht':'bestätigt, noch nicht gebucht'};
  }

  function canApply(){return K.auth?.has?K.auth.has('roster.actual.import'):true;}
  function retire(a,reason){
    const before=clone(a);a.status='deleted';a.deletedAt=new Date().toISOString();a.deletedBy=self();a.supersededReason=reason;a.version=Number(a.version||0)+1;a.updatedAt=a.deletedAt;
    K.recordAudit?.('actual.self_report.retire',{entity:'actual_shift',entityId:a.id,before,after:clone(a),reason});
    K.sync?.enqueue?.({entity:'actual_shift',operation:'delete',payload:clone(a),baseVersion:before.version||null});
  }
  function applyOne(r){
    const own=ownActual(r);
    if(!counts(r)){if(own&&SELF.includes(own.source)){retire(own,'Ist-Rückmeldung zählt nicht (mehr)');return 'entfernt';}return 'keine';}
    const t=times(r);if(!t||!Number.isFinite(t.start)||!Number.isFinite(t.end)||t.end<=t.start)return 'ungueltig';
    if(own&&own.source==='manual_correction'&&!(own.istRueckmeldungKorrektur&&Number(own.istRueckmeldungVersion)!==Number(r.version)))return 'planer';
    const other=own&&own.source==='manual_correction'?own:otherBooking(r);
    if(r.ergebnis==='korrektur'&&other){
      // Bestätigte Korrektur einer Kassen-/App-Buchung: die Buchung selbst wird korrigiert (Rohbuchung bleibt als original).
      if(!(K.auth?.has?K.auth.has('roster.actual.correct'):true))return 'korrektur_offen';
      K.actual.correctActual(other.id,{start:t.start,end:t.end,breakMinutes:t.breakMinutes,istRueckmeldungId:r.id,istRueckmeldungVersion:r.version,istRueckmeldungKorrektur:true},{reason:`Ist-Rückmeldung (Korrektur) vom Planer bestätigt${r.grund?' · '+r.grund:''}`});
      return 'korrigiert';
    }
    if(other){if(own&&SELF.includes(own.source))retire(own,'Buchung vorhanden – Vorrang vor der Selbstauskunft');return 'ueberlagert';}
    const source=r.ergebnis==='passt'?'self_confirm':'self_change';
    if(own&&own.source===source&&Number(own.istRueckmeldungVersion)===Number(r.version)&&Number(own.start)===t.start&&Number(own.end)===t.end&&Number(own.breakMinutes||0)===Number(t.breakMinutes||0))return 'unveraendert';
    const shift=shiftFor(r);
    const candidate={id:own?.id||`A-IR-${String(r.id).slice(0,40)}`,personId:r.personId,date:r.date,start:t.start,end:t.end,breakMinutes:Number(t.breakMinutes||0),linkedShiftId:shift?.id||own?.linkedShiftId||null,matchMethod:shift?'ist_rueckmeldung':own?.matchMethod,
      istRueckmeldungId:r.id,istRueckmeldungVersion:r.version,istRueckmeldungErgebnis:r.ergebnis,status:'recorded',original:{start:r.sollStart,end:r.sollEnd,breakMinutes:Number(r.sollPause||0),source:'plan'}};
    if(!candidate.linkedShiftId)delete candidate.linkedShiftId;
    K.actual.saveActual(candidate,{reason:`Ist-Rückmeldung ${r.ergebnis==='passt'?'bestätigt (Ist = Soll)':'geändert'} · ${r.planerStatus}`,source});
    return own?'aktualisiert':'angelegt';
  }
  function apply(){
    const out={angelegt:0,aktualisiert:0,entfernt:0,ueberlagert:0,korrigiert:0,blocked:false,errors:[]};
    if(!canApply()||!K.actual?.saveActual)return {...out,skipped:'rights'};
    if(K.actualWorkflow?.status==='closed'){out.blocked=true;return out;}
    for(const r of K.istRueckmeldungen){try{const res=applyOne(r);if(res in out)out[res]++;}catch(e){out.errors.push({id:r.id,personId:r.personId,error:e.message||String(e)});}}
    if(out.angelegt||out.aktualisiert||out.entfernt||out.korrigiert)notify();
    return out;
  }

  function range(){
    const today=new Date().toISOString().slice(0,10),dates=(K.days||[]).map(d=>d.date).filter(Boolean).sort();
    const von=dates[0]&&dates[0]<today?dates[0]:new Date(Date.now()-60*86400000).toISOString().slice(0,10);
    const bis=dates.at(-1)&&dates.at(-1)>today?dates.at(-1):today;
    return {von,bis};
  }
  async function pull({von,bis}={}){
    if(!K.supabaseConnection?.istRueckmeldungen)throw new Error('Supabase-Verbindung nicht bereit.');
    const r=range(),rows=await K.supabaseConnection.istRueckmeldungen({von:von||r.von,bis:bis||r.bis});
    const changed=merge((rows||[]).map(fromRemote));lastPullAt=Date.now();
    const applied=apply();
    K.recordAudit?.('ist_rueckmeldung.pull',{entity:'ist_rueckmeldung',after:{received:(rows||[]).length,changed,applied:{angelegt:applied.angelegt,aktualisiert:applied.aktualisiert,entfernt:applied.entfernt}}});
    if(changed||applied.angelegt||applied.aktualisiert||applied.entfernt||applied.korrigiert){try{await K.persistAll?.();}catch(_){/* Speicherfehler meldet die App selbst */}}
    return {received:(rows||[]).length,changed,applied};
  }
  // Auto-Sync-Takt (src/core/auto-sync.js): höchstens alle 5 Minuten und nur für Planerrollen.
  async function poll({force=false}={}){
    if(!K.supabaseConnection?.istRueckmeldungen||!canApply())return {skipped:true,reason:'role'};
    if(!force&&Date.now()-lastPullAt<POLL_MS)return {skipped:true,reason:'interval'};
    if(pulling)return pulling;
    pulling=pull().finally(()=>{pulling=null;});return pulling;
  }

  function warnings(id){
    const r=byId(id);if(!r)return [];const out=[],t=times(r),d=deltaMinutes(r);
    if(!(K.people||[]).some(p=>p.personId===r.personId&&p.active!==false))out.push({level:'error',code:'person_unknown',text:'Diese Person ist in DP2 nicht als aktive Person angelegt.'});
    if(!shiftFor(r))out.push({level:'info',code:'no_shift',text:'Kein passender Solldienst in DP2 gefunden (evtl. inzwischen geändert).'});
    if(t&&(!Number.isFinite(t.start)||!Number.isFinite(t.end)||t.end<=t.start))out.push({level:'error',code:'times',text:'Die gemeldeten Zeiten sind unvollständig.'});
    const other=otherBooking(r);
    if(other&&r.ergebnis!=='nicht_da'){
      const label={timeclock:'Stempeluhr',cash_register:'Kasse',file_import:'Import',manual:'manuell',manual_correction:'Planer-Korrektur',planned_transfer:'Sollplan-Übernahme',self_report:'Sonderstunden-Meldung'}[other.source]||other.source||'Buchung';
      if(r.ergebnis==='korrektur')out.push({level:(K.auth?.has?K.auth.has('roster.actual.correct'):true)?'warn':'error',code:'booking_correct',text:`Korrigiert die Buchung ${span(other.start,other.end)} (${label}).${(K.auth?.has?K.auth.has('roster.actual.correct'):true)?'':' Dafür ist das Recht „Istzeiten korrigieren“ (Zeitprüfer) nötig.'}`});
      else out.push({level:'info',code:'booking',text:`Buchung ${span(other.start,other.end)} (${label}) hat Vorrang – die Rückmeldung bleibt ein Hinweis.`});
    }
    if(r.ergebnis==='nicht_da'&&other)out.push({level:'warn',code:'absent_booking',text:`Meldet „nicht da“, es gibt aber eine Buchung ${span(other.start,other.end)}.`});
    if(d&&Math.max(Math.abs(d.start),Math.abs(d.end))>=15)out.push({level:'info',code:'delta',text:`Abweichung Beginn ${d.start>0?'+':''}${d.start} Min., Ende ${d.end>0?'+':''}${d.end} Min.`});
    if(K.actualWorkflow?.status==='closed')out.push({level:'error',code:'closed',text:'Der Istplan ist abgeschlossen. Für einen Nachtrag zuerst wieder öffnen.'});
    return out;
  }
  function canDecide(){return K.auth?.has?K.auth.has('roster.actual.import'):true;}
  async function decide(id,{status,reason=''}={}){
    K.auth?.require?.('roster.actual.import','Sie dürfen Ist-Rückmeldungen nicht entscheiden.');
    const r=byId(id);if(!r)throw new Error('Rückmeldung nicht gefunden.');
    if(r.planerStatus!=='zu_bestaetigen')throw new Error('Diese Rückmeldung ist bereits entschieden oder braucht keine Bestätigung.');
    if(!['bestaetigt','abgelehnt'].includes(status))throw new Error('Bitte bestätigen oder ablehnen.');
    if(status==='abgelehnt'&&!String(reason).trim())throw new Error('Für eine Ablehnung ist ein Grund erforderlich.');
    if(status==='bestaetigt'){const blocking=warnings(id).filter(w=>w.level==='error');if(blocking.length)throw new Error(blocking.map(w=>w.text).join(' '));}
    // Erst Supabase (gemeinsame Quelle), dann lokal buchen – kein Mischstand.
    if(!K.supabaseConnection?.istRueckmeldungEntscheiden)throw new Error('Supabase-Verbindung nicht bereit.');
    const res=await K.supabaseConnection.istRueckmeldungEntscheiden(r.id,status,String(reason||'').trim());
    if(!res?.ok||res.stale){await pull().catch(()=>{});throw new Error('Diese Rückmeldung wurde inzwischen geändert oder anders entschieden. Bitte die Liste neu laden.');}
    const before=clone(r);
    Object.assign(r,{planerStatus:res.status||status,planerGrund:String(reason||'').trim(),entschiedenAm:new Date().toISOString(),version:Number(res.version||Number(r.version||1)+1)});
    let applied=null;try{applied=applyOne(r);}catch(e){applied='fehler: '+(e.message||e);}
    K.recordAudit?.(`ist_rueckmeldung.${status==='bestaetigt'?'confirm':'reject'}`,{entity:'ist_rueckmeldung',entityId:r.id,before,after:clone(r),reason,meta:{applied}});
    notify();
    try{await K.persistAll?.();}catch(_){/* Speicherfehler meldet die App selbst */}
    return {...clone(r),applied};
  }

  function list({filter='zu_bestaetigen'}={}){
    const rows=K.istRueckmeldungen.filter(r=>filter==='alle'||(filter==='keine_antwort'?r.ergebnis==null&&!otherBooking(r):filter==='zu_bestaetigen'?r.planerStatus==='zu_bestaetigen':filter==='erledigt'?r.ergebnis!=null&&r.planerStatus!=='zu_bestaetigen':true));
    return rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.sollStart)-Number(b.sollStart)||String(K.person?.(a.personId)?.name||a.personId).localeCompare(String(K.person?.(b.personId)?.name||b.personId),'de'));
  }
  function counts_(){return {zu_bestaetigen:K.istRueckmeldungen.filter(r=>r.planerStatus==='zu_bestaetigen').length,keine_antwort:K.istRueckmeldungen.filter(r=>r.ergebnis==null&&!otherBooking(r)).length,alle:K.istRueckmeldungen.length};}
  function forPersonDate(personId,date){return K.istRueckmeldungen.filter(r=>r.personId===personId&&r.date===date).map(stateOf);}
  // Solldienste, die nach bestätigtem „nicht da“ als abwesend gelten (keine fehlende Buchung).
  function absentShift(s){if(!s)return false;return K.istRueckmeldungen.some(r=>r.ergebnis==='nicht_da'&&COUNTED.includes(r.planerStatus)&&shiftFor(r)?.id===s.id);}
  function stateForShift(s){const r=K.istRueckmeldungen.find(x=>x.personId===s?.personId&&x.date===s?.date&&shiftFor(x)?.id===s.id);return r?stateOf(r):null;}
  // „Stimmung & Besetzung“ je Tag und Bereich (Planer-Auswertung für die weitere Planung).
  const FACES={1:'😀',2:'🙂',3:'☹️'};
  function stimmung({von=null,bis=null}={}){
    const map=new Map();
    for(const r of K.istRueckmeldungen){
      if(r.zufrieden==null&&r.besetzung==null)continue;if(von&&r.date<von||bis&&r.date>bis)continue;
      const bereich=r.bereich||shiftFor(r)?.area||'ohne Bereich',key=r.date+'|'+bereich;
      if(!map.has(key))map.set(key,{date:r.date,bereich,gut:0,geht:0,schlecht:0,zuWenig:0,passt:0,zuViel:0,antworten:0});
      const g=map.get(key);g.antworten++;
      if(r.zufrieden===1)g.gut++;else if(r.zufrieden===2)g.geht++;else if(r.zufrieden===3)g.schlecht++;
      if(r.besetzung==='zu_wenig')g.zuWenig++;else if(r.besetzung==='passt')g.passt++;else if(r.besetzung==='zu_viel')g.zuViel++;
    }
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.bereich.localeCompare(b.bereich,'de'));
  }
  function restore(saved){if(Array.isArray(saved))K.istRueckmeldungen=saved.filter(r=>r&&r.id&&r.personId);notify();return K.istRueckmeldungen.length;}
  function snapshot(){return clone(K.istRueckmeldungen);}
  const listeners=new Set();
  function notify(){listeners.forEach(fn=>{try{fn()}catch(_){}});}

  K.istRueckmeldung={VERSION,SELF_SOURCES:SELF,fromRemote,hoursOn,merge,pull,poll,apply,applyOne,times,deltaMinutes,shiftFor,stateOf,warnings,canDecide,decide,list,counts:counts_,forPersonDate,absentShift,stimmung,FACES,stateForShift,restore,snapshot,fmt,span,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
})();
