(function(){
 const K=window.KCDP=window.KCDP||{},state={status:'idle',pending:0,lastCheckAt:null,lastError:null};
 const enc=encodeURIComponent;
 function cfg(){return K.integrationConfig?.supabase||{}}
 async function rest(table,query=''){
   await K.supabaseConnection.ensureSession();
   const c=cfg(),s=K.supabaseConnection.sessionSnapshot();
   const r=await fetch(String(c.url).replace(/\/$/,'')+'/rest/v1/'+table+query,{cache:'no-store',headers:{apikey:c.publishableKey,Authorization:'Bearer '+s.access_token,Accept:'application/json'}});
   const text=await r.text();let data=[];try{data=text?JSON.parse(text):[]}catch(_){}
   if(!r.ok)throw new Error(data?.message||data?.hint||('Supabase HTTP '+r.status));return data;
 }
 function eventId(){return K.eventConfig?.eventId||'WM-2026'}
 function row(x){const clock=v=>{if(!v)return null;const m=String(v).match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])+Number(m[2])/60:null};return {sourceRecordId:x.id,memberNo:x.member_no||'',personId:x.person_id||'',name:x.display_name||'',date:x.work_date,start:clock(x.start_time),end:clock(x.end_time),breakMinutes:Number(x.break_minutes||0),source:'timeclock',sourceStatus:x.status,publishedAt:x.published_at}}
 async function pendingRows(){
   const c=cfg(),base='?org_id=eq.'+enc(c.orgId)+'&project_id=eq.'+enc(c.projectId);
   const [actuals,receipts]=await Promise.all([rest('kc_dp_timeclock_actuals',base+'&event_id=eq.'+enc(eventId())+'&status=neq.voided&select=id,member_no,person_id,display_name,work_date,start_time,end_time,break_minutes,status,published_at&order=work_date.asc,start_time.asc'),rest('kc_dp_timeclock_receipts',base+'&select=source_actual_id')]);
   const done=new Set((receipts||[]).map(x=>x.source_actual_id));return (actuals||[]).filter(x=>!done.has(x.id)).map(row);
 }
 async function provider(req){
   if(req?.action==='pull'){const rows=await pendingRows();return {rows,meta:{source:'supabase_pc_manager',eventId:eventId(),fetchedAt:new Date().toISOString()}}}
   if(req?.action==='parse_file')throw new Error('Excel bleibt ein manueller Dateiweg; bitte dafür den Dateiimport verwenden. CSV und JSON können hier weiterhin manuell eingelesen werden.');
   throw new Error('Unbekannte TimeClock-Aktion.');
 }
 async function check({announce=true}={}){
   if(!K.auth?.has?.('roster.actual.import')||!K.supabaseConnection?.hasAccessToken?.())return {pending:0,available:false};
   state.status='checking';try{const rows=await pendingRows();state.pending=rows.length;state.lastCheckAt=new Date().toISOString();state.lastError=null;state.status='ready';const b=document.getElementById('actualImportBtn');if(b){b.textContent=rows.length?'⏱ Istzeiten ('+rows.length+')':'⏱ Istzeiten';b.title=rows.length?rows.length+' neue Istzeit(en) aus dem PC-Manager zur Prüfung':'Istzeiten / TimeClock importieren und prüfen';b.classList.toggle('notification',rows.length>0)}if(announce&&rows.length)window.dispatchEvent(new CustomEvent('kc-dp-timeclock-pending',{detail:{count:rows.length}}));return {pending:rows.length,available:true}}catch(e){state.status='error';state.lastError=e.message;return {pending:0,available:false,error:e.message}}
 }
 async function acknowledge(selected,result){
   const c=cfg(),ids=new Map((result?.results||[]).filter(x=>x.ok).map(x=>[x.row?.sourceRecordId||x.row?.source_record_id,x]));
   const rows=selected.filter(x=>x.sourceRecordId&&ids.has(x.sourceRecordId)).map(x=>({org_id:c.orgId,project_id:c.projectId,source_actual_id:x.sourceRecordId,local_actual_id:ids.get(x.sourceRecordId)?.row?.id||null,result:ids.get(x.sourceRecordId)?.skipped?'skipped_duplicate':'imported'}));
   if(!rows.length)return {saved:0};await K.supabaseConnection.ensureSession();const s=K.supabaseConnection.sessionSnapshot(),r=await fetch(String(c.url).replace(/\/$/,'')+'/rest/v1/kc_dp_timeclock_receipts?on_conflict=org_id,project_id,source_actual_id',{method:'POST',headers:{apikey:c.publishableKey,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(rows)});if(!r.ok)throw new Error('Übernahmebestätigung konnte nicht gespeichert werden.');await check({announce:false});return {saved:rows.length};
 }
 function init(){K.timeclockImport?.setProvider?.(provider);setTimeout(()=>check({announce:false}),5000);setInterval(()=>check({announce:true}),300000)}
 K.timeclockSupabase={version:'1.0.0',state,pendingRows,check,acknowledge,provider};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();