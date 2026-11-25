// Build 326 · KICC-F-113 Phase 2 / DP2-F-KONTO-01 (Hansi 24./25.11.2026): DP2 veröffentlicht die Ist-Zeilen seines Kontoauszugs je Person,
// damit „⏱️ Mein Stundenkonto“ in der Club App dieselben Zahlen zeigt wie der DP2-Kontoauszug – eine Wahrheit, keine zweite Rechnung.
// Gezählt wird mit dem Kern des Kontoauszugs (K.personAccountPrint.counted/active – AGENTS 3: kein Parallel-Core).
// Ziel: kc_dp_konto_published über kc_dp_konto_publish (nur Planungsrollen; Migration im Club-App-Repo 20261125_kc_dp_konto_published.sql).
// Gesamtstand je Veranstaltung; der Server schreibt nur geänderte Zeilen (Prüfsumme). Takt: Auto-Sync, höchstens alle 5 Minuten und nur,
// wenn sich der Stand seit der letzten erfolgreichen Veröffentlichung geändert hat.
(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const VERSION='0.1.0',POLL_MS=5*60*1000;
const state={inFlight:null,lastRunAt:null,lastSignature:null,lastResult:null,lastError:null};
const text=(v,max)=>{const s=String(v??'').trim();return s?s.slice(0,max):null;};
// kleine, stabile Prüfsumme (FNV-1a, 32 Bit) – nur zum Erkennen von Änderungen, kein Schutz
function hash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}
const round2=v=>Math.round(Number(v)*100)/100;

function artOf(a){
  if(a.hourReportId){const r=(K.hourReports||[]).find(x=>x.id===a.hourReportId);if(r?.source==='erstattung'||a.erstattungId)return 'erstattung';return 'sonder';}
  if(a.specialEventId||a.source==='self_report'||a.zone==='special')return 'sonder';
  return 'stand';
}
function anlassOf(a,art){
  if(art==='stand')return 'Dienst am Stand';
  return text(a.specialEventTitle||K.specialEventsCore?.get?.(a.specialEventId)?.titel||String(a.area||'').replace(/^Z\s*·\s*/,'')||'Sondereinsatz',120);
}
// Zeilen für kc_dp_konto_publish – nur Ist-Zeiten, die der Kontoauszug zählt
function rows(){
  const P=K.personAccountPrint;if(!P?.counted||!P?.active)throw new Error('Kontoauszug-Kern nicht geladen.');
  const closed=d=>K.daysPublishBridge?.istStatusFor?.(d)?.istStatus==='closed';
  const out=[];
  for(const a of K.actualShifts||[]){
    if(!a?.id||!a.personId||!/^\d{4}-\d{2}-\d{2}$/.test(String(a.date||''))||!P.active(a))continue;
    const art=artOf(a),start=Number(a.start),end=Number(a.end);
    const row={entry_key:String(a.id).slice(0,120),person_id:String(a.personId).slice(0,80),work_date:a.date,
      start_h:Number.isFinite(start)?round2(start):null,end_h:Number.isFinite(end)?round2(end):null,break_minutes:Math.max(0,Math.round(P.breakMinutes?P.breakMinutes(a):Number(a.breakMinutes||0))),
      minutes:Math.max(0,Math.round(P.counted(a)*60)),art,anlass:anlassOf(a,art),taetigkeit:text(art==='stand'?a.area:(K.hourReportsCore?.activityLabel?.(a.taetigkeit)||a.taetigkeit),40),
      special_event_id:text(a.specialEventId,80),hour_report_id:text(a.hourReportId,80),quelle:text(a.source,40),
      korrigiert:!!(a.correctedAt||(a.original&&(Math.abs(Number(a.original.start)-start)>.001||Math.abs(Number(a.original.end)-end)>.001))),abgeschlossen:closed(a.date)};
    row.checksum=hash(JSON.stringify(row));
    out.push(row);
  }
  return out.sort((x,y)=>x.work_date.localeCompare(y.work_date)||x.entry_key.localeCompare(y.entry_key));
}
const signature=list=>hash(list.map(r=>r.entry_key+':'+r.checksum).join('|'));

async function publishNow({force=false}={}){
  if(!K.supabaseConnection?.publishKonto)return {skipped:true,reason:'provider'};
  if(state.inFlight)return state.inFlight;
  state.inFlight=(async()=>{
    try{
      if(!['admin','planner','duty_manager'].includes(K.currentUser?.role))return {skipped:true,reason:'role'};
      const list=rows(),sig=signature(list);
      if(!force&&sig===state.lastSignature)return {skipped:true,reason:'unchanged'}; // nichts geändert → keine Server-Anfrage
      if(!await K.daysPublishBridge?.planningMembership?.())return {skipped:true,reason:'role'};
      const res=await K.supabaseConnection.publishKonto({eventId:K.eventConfig?.eventId||'KC-WM-2026',rows:list});
      if(res?.ok!==true)throw new Error('Veröffentlichung des Kontoauszugs wurde nicht bestätigt.');
      Object.assign(state,{lastRunAt:new Date().toISOString(),lastSignature:sig,lastResult:res,lastError:null});
      K.recordAudit?.('konto.publish',{entity:'konto',after:{zeilen:list.length,geschrieben:res.geschrieben,entfernt:res.entfernt}});
      return res;
    }catch(e){state.lastError=e.message||String(e);throw e;}
  })().finally(()=>{state.inFlight=null;}); // erst nach dem Setzen freigeben (auch wenn der Lauf ohne await endet)
  return state.inFlight;
}
// Auto-Sync-Takt (src/core/auto-sync.js): höchstens alle 5 Minuten.
async function poll({force=false}={}){
  if(!force&&state.lastRunAt&&Date.now()-Date.parse(state.lastRunAt)<POLL_MS)return {skipped:true,reason:'interval'};
  return publishNow({force});
}
K.kontoPublish={VERSION,state,rows,publishNow,poll,_test:{hash,artOf,signature}};
})();
