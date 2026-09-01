(function(){
  const K=window.KCDP=window.KCDP||{};
  const CURRENT_RELEASE='0.20.0';
  const MANIFEST_URL='update-manifest.json';
  const SNOOZE_MS=12*60*60*1000;
  const REPORT_QUEUE_KEY='kc_dp_pending_update_reports_v1';
  const state={status:'idle',manifest:null,lastCheckAt:null,lastError:null,phase:'idle',downloadedBytes:0,totalBytes:0};
  K.APP_RELEASE=CURRENT_RELEASE;

  function semver(v){return String(v||'0').replace(/^v/i,'').split('.').map(x=>Number.parseInt(x,10)||0).slice(0,3).concat([0,0,0]).slice(0,3);}
  function newer(a,b){const A=semver(a),B=semver(b);for(let i=0;i<3;i++){if(A[i]>B[i])return true;if(A[i]<B[i])return false;}return false;}
  function bytesText(n){n=Number(n||0);if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
  function etaText(seconds){if(!Number.isFinite(seconds)||seconds<0)return 'wird berechnet…';if(seconds<2)return 'weniger als 2 Sek.';if(seconds<60)return `ca. ${Math.ceil(seconds)} Sek.`;return `ca. ${Math.ceil(seconds/60)} Min.`;}
  function reportId(){return `KCDP-UPD-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;}
  function cleanPath(path){return String(path||'').replace(/^\.\//,'').replace(/^\//,'');}
  function sameOriginUrl(path,cacheBust=false){const u=new URL(cleanPath(path),location.href);if(cacheBust)u.searchParams.set('kc_update',Date.now().toString());return u.toString();}
  async function sha256(buffer){const digest=await crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}
  const CANONICAL_TEXT_EXTENSIONS=new Set(['html','js','css','webmanifest','svg']);
  function canonicalVerifiedBuffer(file,buffer){const clean=installPath(file).split(/[?#]/)[0].toLowerCase(),dot=clean.lastIndexOf('.'),ext=dot>=0?clean.slice(dot+1):'';if(!CANONICAL_TEXT_EXTENSIONS.has(ext))return buffer;return new TextEncoder().encode(new TextDecoder().decode(buffer).replace(/\r\n?/g,'\n')).buffer;}
  function safeStoreGet(key,fallback=null){try{const x=localStorage.getItem(key);return x?JSON.parse(x):fallback;}catch(_){return fallback;}}
  function safeStoreSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}}
  function queueReport(report){const q=safeStoreGet(REPORT_QUEUE_KEY,[]);q.push(report);safeStoreSet(REPORT_QUEUE_KEY,q.slice(-10));}
  function snoozed(version){const x=safeStoreGet('kc_dp_update_snooze',null);return !!(x&&x.version===version&&Date.now()-Number(x.at||0)<SNOOZE_MS);}
  function snooze(version){safeStoreSet('kc_dp_update_snooze',{version,at:Date.now()});}

  async function fetchManifest(){
    if(!/^https?:$/.test(location.protocol))throw new Error('Updateprüfung benötigt die Web-Version über HTTPS/HTTP.');
    const r=await fetch(`${MANIFEST_URL}?t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`Update-Manifest nicht erreichbar (HTTP ${r.status}).`);
    const m=await r.json();
    if(!m||!m.version||!Array.isArray(m.files))throw new Error('Update-Manifest ist unvollständig.');
    return m;
  }
  async function check({manual=false}={}){
    state.status='checking';state.lastCheckAt=new Date().toISOString();state.lastError=null;
    try{
      const m=await fetchManifest();state.manifest=m;
      if(newer(m.version,CURRENT_RELEASE)||(String(m.version)===String(CURRENT_RELEASE)&&Number(m.build||0)>Number(window.KC_DP_BUILD||0))){
        state.status='available';
        if(manual||!snoozed(m.version))window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_AVAILABLE',{detail:m}));
        return {available:true,manifest:m};
      }
      state.status='current';
      if(manual)window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_CURRENT',{detail:{version:CURRENT_RELEASE}}));
      return {available:false,manifest:m};
    }catch(e){
      state.status='error';state.lastError=e.message;
      if(manual)window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_CHECK_ERROR',{detail:{message:e.message}}));
      return {available:false,error:e};
    }
  }

  function downloadPath(file){return cleanPath(file?.downloadPath||file?.path);}
  function installPath(file){return cleanPath(file?.installPath||file?.path);}
  async function fetchFile(file,onChunk){
    const source=downloadPath(file),url=sameOriginUrl(source,true),r=await fetch(url,{cache:'no-store',headers:{'X-KC-DP-Update':'1'}});
    if(!r.ok)throw new Error(`${installPath(file)}: HTTP ${r.status}`);
    const chunks=[];let loaded=0;
    if(r.body?.getReader){
      const reader=r.body.getReader();
      for(;;){const {done,value}=await reader.read();if(done)break;if(value){chunks.push(value);loaded+=value.byteLength;onChunk(value.byteLength);}}
      const out=new Uint8Array(loaded);let off=0;for(const c of chunks){out.set(c,off);off+=c.byteLength;}
      return {buffer:out.buffer,type:r.headers.get('content-type')||'application/octet-stream'};
    }
    const buffer=await r.arrayBuffer();onChunk(buffer.byteLength);return {buffer,type:r.headers.get('content-type')||'application/octet-stream'};
  }
  async function stage(manifest){
    if(!('caches'in window)||!('serviceWorker'in navigator)||!window.crypto?.subtle)throw new Error('Dieses Gerät unterstützt die sichere Update-Installation nicht vollständig.');
    const files=manifest.files.filter(f=>f&&f.path&&f.runtime!==false),total=files.reduce((s,f)=>s+Number(f.bytes||0),0),cacheName=manifest.cacheName||`kc-dp-release-${manifest.version}`,cache=await caches.open(cacheName),started=performance.now();
    state.status='installing';state.phase='download';state.downloadedBytes=0;state.totalBytes=total;
    for(let i=0;i<files.length;i++){
      const file=files[i];
      const onChunk=n=>{state.downloadedBytes+=n;const elapsed=Math.max(.1,(performance.now()-started)/1000),rate=state.downloadedBytes/elapsed,remaining=Math.max(0,total-state.downloadedBytes),eta=rate>0?remaining/rate:Infinity;window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_PROGRESS',{detail:{phase:'download',file:installPath(file),index:i+1,count:files.length,downloaded:state.downloadedBytes,total,percent:total?Math.min(99,Math.round(state.downloadedBytes/total*100)):0,rate,eta}}));};
      const {buffer,type}=await fetchFile(file,onChunk),verifiedBuffer=canonicalVerifiedBuffer(file,buffer);
      if(Number(file.bytes||0)>0&&Math.abs(verifiedBuffer.byteLength-Number(file.bytes))>4)throw new Error(`${installPath(file)}: Dateigröße stimmt nicht mit dem Release überein.`);
      if(file.sha256){state.phase='verify';window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_PROGRESS',{detail:{phase:'verify',file:installPath(file),index:i+1,count:files.length,downloaded:state.downloadedBytes,total,percent:total?Math.min(99,Math.round(state.downloadedBytes/total*100)):0,eta:0}}));const hash=await sha256(verifiedBuffer);if(hash.toLowerCase()!==String(file.sha256).toLowerCase())throw new Error(`${installPath(file)}: SHA-256-Integritätsprüfung fehlgeschlagen (ist ${hash.slice(0,12)}…, erwartet ${String(file.sha256).slice(0,12)}…).`);}
      await cache.put(sameOriginUrl(installPath(file),false),new Response(buffer,{status:200,headers:{'Content-Type':type,'Content-Length':String(buffer.byteLength),'X-KC-DP-Release':manifest.version,'X-KC-DP-SHA256':file.sha256||''}}));
    }
    safeStoreSet('kc_dp_staged_release',{version:manifest.version,cacheName,at:Date.now()});
    window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_PROGRESS',{detail:{phase:'activate',downloaded:total,total,percent:100,eta:0}}));
    return {cacheName,total};
  }
  async function activate(manifest){
    state.phase='activate';
    let reg=await navigator.serviceWorker.getRegistration('./');
    const workerUrl='service-worker.js?v=0.20.0-b'+Number(manifest?.build||window.KC_DP_BUILD||184);
    if(!reg)reg=await navigator.serviceWorker.register(workerUrl,{updateViaCache:'none'});
    else{try{await reg.update();}catch(_){}}
    await navigator.serviceWorker.ready;
    if(reg.installing||reg.waiting){
      const candidate=reg.installing||reg.waiting;
      if(candidate.state!=='activated')await new Promise(resolve=>{const timeout=setTimeout(resolve,12000);candidate.addEventListener('statechange',()=>{if(candidate.state==='activated'){clearTimeout(timeout);resolve();}});});
    }
    const controller=reg.active||navigator.serviceWorker.controller;
    if(!controller)throw new Error('Der KC-DP2 Update-Dienst ist noch nicht aktiv. Bitte die Seite einmal neu laden und erneut versuchen.');
    const cacheName=manifest.cacheName||`kc-dp-release-${manifest.version}`,expectedFiles=manifest.files.filter(f=>f.runtime!==false).map(f=>installPath(f));
    await new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      const timeout=setTimeout(()=>{navigator.serviceWorker.removeEventListener('message',handler);channel.port1.close();reject(new Error('Der Update-Dienst hat die Aktivierung nicht bestätigt. Bitte Seite neu laden und erneut versuchen.'));},30000);
      const finish=error=>{clearTimeout(timeout);navigator.serviceWorker.removeEventListener('message',handler);channel.port1.close();error?reject(error):resolve();};
      function accept(data){
        if(data?.type==='KC_DP_UPDATE_ACTIVATED'&&data?.version===manifest.version)finish();
        else if(data?.type==='KC_DP_UPDATE_ACTIVATION_FAILED'&&data?.version===manifest.version)finish(new Error(data?.message||'Aktivierung fehlgeschlagen.'));
      }
      function handler(e){accept(e.data);}
      channel.port1.onmessage=e=>accept(e.data);
      navigator.serviceWorker.addEventListener('message',handler);
      controller.postMessage({type:'KC_DP_SWITCH_RELEASE',version:manifest.version,cacheName,expectedFiles},[channel.port2]);
    });
    safeStoreSet('kc_dp_last_installed_release',{version:manifest.version,at:Date.now()});
  }

  function makeErrorReport(error,target,phase){
    const nav=navigator||{};
    return {reportId:reportId(),type:'update_failure',at:new Date().toISOString(),appRelease:CURRENT_RELEASE,targetRelease:target?.version||null,phase:phase||state.phase||'unknown',message:error?.message||String(error),stack:String(error?.stack||'').slice(0,5000),online:nav.onLine,userAgent:String(nav.userAgent||'').slice(0,1000),language:nav.language||null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1},page:{origin:location.origin,path:location.pathname},serviceWorker:{supported:'serviceWorker'in nav,controller:!!nav.serviceWorker?.controller},cacheNames:[],role:K.currentUser?.role||null};
  }
  async function sendReport(report){try{report.cacheNames='caches'in window?await caches.keys():[];}catch(_){report.cacheNames=[];}if(!K.supabaseConnection?.sendClientReport)throw new Error('Supabase-Fehlerbericht ist noch nicht eingerichtet.');return K.supabaseConnection.sendClientReport(report);}
  async function flushQueuedReports(){const q=safeStoreGet(REPORT_QUEUE_KEY,[]);if(!q.length||!navigator.onLine||!K.supabaseConnection?.hasAccessToken?.())return {sent:0};const left=[];let sent=0;for(const r of q){try{await sendReport(r);sent++;}catch(_){left.push(r);}}safeStoreSet(REPORT_QUEUE_KEY,left);return {sent};}
  async function install(manifest=state.manifest){
    if(!manifest)throw new Error('Kein Update ausgewählt.');
    try{await stage(manifest);await activate(manifest);state.status='installed';state.phase='done';window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_SUCCESS',{detail:{version:manifest.version}}));return {ok:true,version:manifest.version};}
    catch(error){state.status='failed';state.lastError=error.message;const report=makeErrorReport(error,manifest,state.phase);state.lastReport=report;window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_FAILED',{detail:{error,report,version:manifest.version}}));return {ok:false,error,report};}
  }
  async function reportFailure(report){try{const result=await sendReport(report);return {ok:true,result};}catch(error){queueReport(report);return {ok:false,queued:true,error};}}
  function downloadReport(report){const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`KC_DP2_Updatefehler_${report.reportId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
  async function ensureEngine(){if(!('serviceWorker'in navigator)||!/^https?:$/.test(location.protocol))return null;try{return await navigator.serviceWorker.register('service-worker.js?v=0.20.0-b'+Number(window.KC_DP_BUILD||184),{updateViaCache:'none'});}catch(_){return null;}}
  function confirmBoot(){try{const c=navigator.serviceWorker?.controller;if(c)c.postMessage({type:'KC_DP_BOOT_OK',version:CURRENT_RELEASE});}catch(_){}}
  function schedule(){ensureEngine();setTimeout(confirmBoot,5000);setTimeout(()=>{flushQueuedReports();check();},1500);setInterval(()=>flushQueuedReports(),15*60*1000);setInterval(()=>check(),5*60*1000);window.addEventListener('online',()=>{flushQueuedReports();check();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const last=Date.parse(state.lastCheckAt||0)||0;if(Date.now()-last>60000)check();}});}

  K.updateManager={version:'0.19.45',CURRENT_RELEASE,state,check,install,snooze,reportFailure,downloadReport,flushQueuedReports,bytesText,etaText};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
