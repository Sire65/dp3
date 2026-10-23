(function(){
  const K=window.KCDP=window.KCDP||{};
  const CURRENT_RELEASE='0.20.0';
  const MANIFEST_URL='update-manifest.json';
  const REMOTE_MANIFEST_URL='https://raw.githubusercontent.com/Sire65/dp3/codex/club-app-interface/update-manifest.json';
  const LOCAL_REPO_HOST=/^(?:127\.0\.0\.1|localhost)$/i.test(location.hostname)||location.protocol==='file:';
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
    let commit=null;if(LOCAL_REPO_HOST){const ref=await fetch('https://api.github.com/repos/Sire65/dp3/commits/codex%2Fclub-app-interface',{cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000)});if(!ref.ok)throw Error('GitHub-Stand nicht erreichbar (HTTP '+ref.status+'). Bitte später erneut prüfen.');commit=String((await ref.json()).sha||'');if(!/^[a-f0-9]{40}$/.test(commit))throw Error('GitHub hat keine gültige Commit-Kennung geliefert.');}const source=LOCAL_REPO_HOST?'https://raw.githubusercontent.com/Sire65/dp3/'+commit+'/update-manifest.json':MANIFEST_URL;
    const r=await fetch(`${source}?t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`Update-Manifest nicht erreichbar (HTTP ${r.status}).`);
    const m=await r.json();
    if(!m||!m.version||!Array.isArray(m.files))throw new Error('Update-Manifest ist unvollständig.');
    if(commit)m.sourceCommit=commit;return m;
  }
  async function check({manual=false}={}){
    if(state.installing||state.status==='installed')return {available:false,busy:!!state.installing,installed:state.status==='installed'};state.status='checking';state.lastCheckAt=new Date().toISOString();state.lastError=null;
    try{
      const m=await fetchManifest();if(state.installing||state.status==='installed')return {available:false,busy:!!state.installing};state.manifest=m;
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
  function runtimeType(file,fallback){const ext=installPath(file).split('.').pop().toLowerCase();return ({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',woff2:'font/woff2',pdf:'application/pdf',wav:'audio/wav',mp3:'audio/mpeg'})[ext]||fallback||'application/octet-stream';}
  async function fetchFile(file,onChunk,manifest){
    const source=downloadPath(file),url=LOCAL_REPO_HOST?new URL(source,'https://raw.githubusercontent.com/Sire65/dp3/'+manifest.sourceCommit+'/update-manifest.json').toString():sameOriginUrl(source,true),r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error(`${installPath(file)}: HTTP ${r.status}`);
    const chunks=[];let loaded=0;
    if(r.body?.getReader){
      const reader=r.body.getReader();
      for(;;){const {done,value}=await reader.read();if(done)break;if(value){chunks.push(value);loaded+=value.byteLength;onChunk(value.byteLength);}}
      const out=new Uint8Array(loaded);let off=0;for(const c of chunks){out.set(c,off);off+=c.byteLength;}
      return {buffer:out.buffer,type:runtimeType(file,r.headers.get('content-type'))};
    }
    const buffer=await r.arrayBuffer();onChunk(buffer.byteLength);return {buffer,type:runtimeType(file,r.headers.get('content-type'))};
  }
  async function stage(manifest){
    if(LOCAL_REPO_HOST&&!/^[a-f0-9]{40}$/.test(String(manifest.sourceCommit||'')))throw Error('Update bitte erneut prüfen: Der feste GitHub-Stand fehlt.');
    if(!('caches'in window)||!('serviceWorker'in navigator)||!window.crypto?.subtle)throw new Error('Dieses Gerät unterstützt die sichere Update-Installation nicht vollständig.');
    const files=manifest.files.filter(f=>f&&f.path&&f.runtime!==false),total=files.reduce((s,f)=>s+Number(f.bytes||0),0),cacheName=manifest.cacheName||`kc-dp-release-${manifest.version}`,cache=await caches.open(cacheName),started=performance.now();
    state.status='installing';state.phase='download';state.downloadedBytes=0;state.totalBytes=total;
    for(let i=0;i<files.length;i++){
      const file=files[i];
      const onChunk=n=>{state.downloadedBytes+=n;const elapsed=Math.max(.1,(performance.now()-started)/1000),rate=state.downloadedBytes/elapsed,remaining=Math.max(0,total-state.downloadedBytes),eta=rate>0?remaining/rate:Infinity;window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_PROGRESS',{detail:{phase:'download',file:installPath(file),index:i+1,count:files.length,downloaded:state.downloadedBytes,total,percent:total?Math.min(99,Math.round(state.downloadedBytes/total*100)):0,rate,eta}}));};
      const {buffer,type}=await fetchFile(file,onChunk,manifest),verifiedBuffer=canonicalVerifiedBuffer(file,buffer);
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
    const reg=await navigator.serviceWorker.register('service-worker.js?engine=stable-v3-b302',{updateViaCache:'none'});
    await reg.update();
    if(reg.installing||reg.waiting){
      const candidate=reg.installing||reg.waiting;candidate.postMessage({type:'KC_DP_ACTIVATE_WORKER'});
      if(candidate.state!=='activated')await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{candidate.removeEventListener('statechange',changed);reject(new Error('Der neue Update-Dienst konnte nicht starten. Bitte DP2 über den aktuellen Programmordner öffnen.'));},20000);function changed(){if(candidate.state==='activated'||candidate.state==='redundant'){clearTimeout(timeout);candidate.removeEventListener('statechange',changed);candidate.state==='activated'?resolve():reject(new Error('Der Update-Dienst wurde beim Start ersetzt. Bitte erneut prüfen.'));}}candidate.addEventListener('statechange',changed);changed();});
    }
    const controller=reg.active||navigator.serviceWorker.controller;
    if(!controller)throw new Error('Der KC-DP2 Update-Dienst ist noch nicht aktiv. Bitte die Seite einmal neu laden und erneut versuchen.');
    const info=await workerRequest(controller,{type:'KC_DP_UPDATE_ENGINE_INFO'});
    state.workerInfo={scriptURL:controller.scriptURL,engine:info?.engine||null,protocol:info?.protocol||null};
    if(info?.type!=='KC_DP_UPDATE_ENGINE_INFO_RESULT'||info.protocol!==2)throw new Error('Der lokale Update-Dienst ist veraltet. Bitte DP2 über den aktuellen Programmordner starten.');
    const cacheName=manifest.cacheName||`kc-dp-release-${manifest.version}`,expectedFiles=manifest.files.filter(f=>f.runtime!==false).map(f=>installPath(f));
    const requestId=crypto.randomUUID();state.activation={requestId,cacheName,files:expectedFiles.length,startedAt:new Date().toISOString()};
    await new Promise((resolve,reject)=>{
      const channel=new MessageChannel();let settled=false;
      const timeout=setTimeout(async()=>{for(let attempt=0;attempt<12&&!settled;attempt++){const status=await workerRequest(controller,{type:'KC_DP_UPDATE_ENGINE_INFO'}).catch(()=>null);state.activation.receipt=status?.meta||null;state.activation.worker=status?.activation||null;if(status?.meta?.activeCache===cacheName&&status?.meta?.activationRequestId===requestId){finish();return;}if(status?.activation?.requestId!==requestId||!['checking','committing'].includes(status.activation.phase))break;await new Promise(resolve=>setTimeout(resolve,2000));}if(!settled)finish(new Error('Der Update-Dienst hat die Aktivierung nicht bestätigt. Bitte den technischen Bericht herunterladen.'));},30000);
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);navigator.serviceWorker.removeEventListener('message',handler);channel.port1.close();error?reject(error):resolve();};
      function accept(data){
        if(data?.type==='KC_DP_UPDATE_ACTIVATED'&&data?.version===manifest.version&&data?.cacheName===cacheName&&data?.requestId===requestId)finish();
        else if(data?.type==='KC_DP_UPDATE_ACTIVATION_FAILED'&&data?.version===manifest.version&&data?.requestId===requestId)finish(new Error(data?.message||'Aktivierung fehlgeschlagen.'));
      }
      function handler(e){if(e.source===controller)accept(e.data);}
      channel.port1.onmessage=e=>accept(e.data);
      navigator.serviceWorker.addEventListener('message',handler);
      controller.postMessage({type:'KC_DP_SWITCH_RELEASE',version:manifest.version,cacheName,expectedFiles,requestId},[channel.port2]);
    });
    safeStoreSet('kc_dp_last_installed_release',{version:manifest.version,at:Date.now()});
  }

  function workerRequest(worker,message){
    return new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(new Error('Der lokale Update-Dienst antwortet nicht. Bitte DP2 über den aktuellen Programmordner starten; keine Browserdaten löschen.'));},12000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};try{worker.postMessage(message,[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}});
  }

  function makeErrorReport(error,target,phase){
    const nav=navigator||{};
    return {reportId:reportId(),type:'update_failure',at:new Date().toISOString(),appRelease:CURRENT_RELEASE,targetRelease:target?.version||null,targetBuild:target?.build||null,currentBuild:window.KC_DP_BUILD||null,phase:phase||state.phase||'unknown',message:error?.message||String(error),stack:String(error?.stack||'').slice(0,5000),online:nav.onLine,userAgent:String(nav.userAgent||'').slice(0,1000),language:nav.language||null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1},page:{origin:location.origin,path:location.pathname},serviceWorker:{supported:'serviceWorker'in nav,controller:!!nav.serviceWorker?.controller,scriptURL:nav.serviceWorker?.controller?.scriptURL||null,engine:state.workerInfo||null,activation:state.activation||null},cacheNames:[],role:K.currentUser?.role||null};
  }
  async function sendReport(report){try{report.cacheNames='caches'in window?await caches.keys():[];}catch(_){report.cacheNames=[];}if(!K.supabaseConnection?.sendClientReport)throw new Error('Supabase-Fehlerbericht ist noch nicht eingerichtet.');return K.supabaseConnection.sendClientReport(report);}
  async function flushQueuedReports(){const q=safeStoreGet(REPORT_QUEUE_KEY,[]);if(!q.length||!navigator.onLine||!K.supabaseConnection?.hasAccessToken?.())return {sent:0};const left=[];let sent=0;for(const r of q){try{await sendReport(r);sent++;}catch(_){left.push(r);}}safeStoreSet(REPORT_QUEUE_KEY,left);return {sent};}
  async function installCore(manifest=state.manifest){
    if(!manifest)throw new Error('Kein Update ausgewählt.');
    if(location.protocol==='file:')throw new Error('Für Updates DP2-OFFLINE-STARTEN.cmd verwenden und DP2 über die feste lokale HTTP-Adresse öffnen.');
    if(state.installing)return {ok:false,busy:true};state.installing=true;try{if(K.storage?.unlocked&&K.persistAll)await K.persistAll();await K.sync?.whenDurable?.();await stage(manifest);await activate(manifest);state.status='installed';state.phase='done';window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_SUCCESS',{detail:{version:manifest.version,build:manifest.build}}));return {ok:true,version:manifest.version,build:manifest.build};}
    catch(error){state.status='failed';state.lastError=error.message;const report=makeErrorReport(error,manifest,state.phase);state.lastReport=report;window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_FAILED',{detail:{error,report,version:manifest.version}}));return {ok:false,error,report};}finally{state.installing=false;}
  }
  async function install(manifest=state.manifest){if(navigator.locks)return navigator.locks.request('kc-dp-program-update',{ifAvailable:true},lock=>lock?installCore(manifest):Promise.resolve({ok:false,busy:true}));return installCore(manifest); }
  async function reportFailure(report){try{const result=await sendReport(report);return {ok:true,result};}catch(error){queueReport(report);return {ok:false,queued:true,error};}}
  function downloadReport(report){const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`KC_DP2_Updatefehler_${report.reportId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
  async function ensureEngine(){if(!('serviceWorker'in navigator)||!/^https?:$/.test(location.protocol))return null;try{return await navigator.serviceWorker.register('service-worker.js?engine=stable-v3-b302',{updateViaCache:'none'});}catch(_){return null;}}
  function confirmBoot(){try{const c=navigator.serviceWorker?.controller;if(c)c.postMessage({type:'KC_DP_BOOT_OK',version:CURRENT_RELEASE});}catch(_){}}
  function schedule(){ensureEngine();setTimeout(confirmBoot,5000);setTimeout(()=>{flushQueuedReports();check();},1500);setInterval(()=>flushQueuedReports(),15*60*1000);setInterval(()=>check(),5*60*1000);window.addEventListener('online',()=>{flushQueuedReports();check();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const last=Date.parse(state.lastCheckAt||0)||0;if(Date.now()-last>60000)check();}});}

  K.updateManager={singlePipeline:true,fetchManifest,LOCAL_REPO_HOST,REMOTE_MANIFEST_URL,version:'0.19.45',CURRENT_RELEASE,state,check,install,snooze,reportFailure,downloadReport,flushQueuedReports,bytesText,etaText};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
