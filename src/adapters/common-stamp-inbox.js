(function () {
 'use strict';
 const K=window.KCDP;
 if(!K?.timeclockSupabase)return;
 const originalRows=K.timeclockSupabase.pendingRows;
 const originalAck=K.timeclockSupabase.acknowledge;
 const clock = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const date = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
 function hour(value,workDate) {
  if(!value)return null;
  const d=new Date(value),text=clock.format(d),parts=text.split(':').map(Number);
  const days=(Date.parse(date.format(d))-Date.parse(workDate))/86400000;
  return days*24+parts[0]+parts[1]/60;
 }
 function normalize(pair) {
  return {sourceRecordId:'stamp:'+(pair.kommen_id||pair.gehen_id),memberNo:pair.member_no,personId:pair.person_id,
   date:pair.work_date,start:hour(pair.kommen,pair.work_date),end:hour(pair.gehen,pair.work_date),
   breakMinutes:Number(pair.pause_min||0),sourceStatus:pair.status,source:'timeclock',
   stampMeta:{comingSource:pair.quelle_kommen,goingSource:pair.quelle_gehen,reason:pair.grund_gehen||pair.grund_kommen||'',onSite:pair.vor_ort,spontaneous:pair.spontan===true}};
 }
 async function stampRows() {
  await K.supabaseConnection.ensureSession();
  const c=K.integrationConfig.supabase,s=K.supabaseConnection.sessionSnapshot();
  const response=await fetch(new URL('/rest/v1/rpc/kc_dp_stempel_paare_liste',c.url).href,{
   method:'POST',headers:{apikey:c.publishableKey,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({p_org_id:c.orgId,p_event_id:K.eventConfig?.eventId||'KC-WM-2026',p_von:K.days[0].date,p_bis:K.days.at(-1).date}),
   signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Das gemeinsame Stempelbuch ist noch nicht erreichbar. Bitte Verbindung und Serverstand prüfen.');
  const pairs=await response.json();if(!Array.isArray(pairs))throw Error('Ungültige Antwort des Stempelbuchs.');
  return pairs.map(normalize).filter(row=>{
   const personId=K.timeclockImport?.normalizeRow?.(row)?.personId || row.personId;
   return !K.actualShifts.some(a=>a.status!=='deleted' &&
    (a.sourceRecordId===row.sourceRecordId || (a.personId===personId && ['timeclock','file_import'].includes(a.source))) &&
    a.date===row.date&&a.start===row.start&&a.end===row.end&&Number(a.breakMinutes||0)===row.breakMinutes);
  });
 }
 K.timeclockSupabase.pendingRows=async()=>{
  const [legacy,common]=await Promise.all([originalRows(),stampRows()]);return [...legacy,...common];
 };
 K.timeclockSupabase.acknowledge=async(selected,result)=>{
  // Common-book receipts live in the confirmed workspace actual record, including its source ID.
  const legacy=selected.filter(r=>!String(r.sourceRecordId||'').startsWith('stamp:'));
  if(legacy.length)await originalAck(legacy,result);
  return {saved:selected.length};
 };
 K.commonStampInbox={normalize,stampRows};
})();
