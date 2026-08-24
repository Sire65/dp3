/* KC-DP2 stable PWA/update engine V1.9.
   Startup Cache Guard + controlled Build Migration + Supabase Auth Preflight.
   Every controlled program start verifies the release manifest, validates the current runtime cache
   by SHA-256, checks the Supabase Auth service before login, and records a local green/yellow/red log.
   Same-version fingerprint changes from the canonical production pipeline are treated as a controlled
   migration and are accepted only after full runtime verification.
*/
const ENGINE='kc-dp-update-engine-v2.0-atomic-release';
const META_CACHE='kc-dp-release-meta-v1';
const META_URL=new URL('__kc_dp_release_meta__',self.registration.scope).toString();
const START_LOG_URL=new URL('__kc_dp_start_guard_log__',self.registration.scope).toString();
const UPDATE_MANIFEST='./update-manifest.json';
const FALLBACK='./index.html';
const SUPABASE_AUTH_HEALTH='https://ptblnpiroqftcvlsrhac.supabase.co/auth/v1/health';
const PUSH_RECEIPT_ENDPOINT='https://ptblnpiroqftcvlsrhac.supabase.co/functions/v1/kc-dp-push-receipt';
const NETWORK_TIMEOUT_MS=12000;
const START_GUARD_TIMEOUT_MS=8000;
const AUTH_PREFLIGHT_TIMEOUT_MS=5000;
const MAX_START_LOGS=20;

async function fetchWithTimeout(input,opt={},timeoutMs=NETWORK_TIMEOUT_MS){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(input,{...opt,signal:opt.signal||controller.signal});}
  finally{clearTimeout(timer);}
}
async function readMeta(){const c=await caches.open(META_CACHE),r=await c.match(META_URL);if(!r)return null;try{return await r.json();}catch(_){return null;}}
async function writeMeta(meta){const c=await caches.open(META_CACHE);await c.put(META_URL,new Response(JSON.stringify(meta),{headers:{'Content-Type':'application/json','X-KC-DP-Engine':ENGINE}}));return meta;}
async function readStartLogs(){const c=await caches.open(META_CACHE),r=await c.match(START_LOG_URL);if(!r)return [];try{const x=await r.json();return Array.isArray(x)?x:[];}catch(_){return [];}}
async function appendStartLog(entry){const c=await caches.open(META_CACHE),logs=await readStartLogs();logs.unshift(entry);await c.put(START_LOG_URL,new Response(JSON.stringify(logs.slice(0,MAX_START_LOGS),null,2),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-KC-DP-Engine':ENGINE}}));return entry;}
async function fetchManifest(timeoutMs=NETWORK_TIMEOUT_MS){const r=await fetchWithTimeout(`${UPDATE_MANIFEST}?sw=${Date.now()}`,{cache:'no-store',headers:{'Cache-Control':'no-cache'}},timeoutMs);if(!r.ok)throw new Error(`Manifest HTTP ${r.status}`);const m=await r.json();if(!m?.version||!Array.isArray(m.files))throw new Error('Manifest unvollständig');return m;}
async function sha256Hex(buffer){const d=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function manifestFingerprint(m){
  const files=(m.files||[]).map(f=>({path:String(f.installPath||f.path||''),source:String(f.downloadPath||f.path||''),bytes:Number(f.bytes||0),sha256:String(f.sha256||'').toLowerCase(),runtime:f.runtime!==false,forceRefresh:f.forceRefresh===true})).sort((a,b)=>a.path.localeCompare(b.path));
  const canonical=JSON.stringify({version:String(m.version||''),cacheName:String(m.cacheName||`kc-dp-release-${m.version||''}`),files});
  return sha256Hex(new TextEncoder().encode(canonical));
}
async function verifiedResponse(file,response){const buffer=await response.arrayBuffer();if(Number(file.bytes||0)>0&&Math.abs(buffer.byteLength-Number(file.bytes))>4)throw new Error(`${file.installPath||file.path}: Dateigröße stimmt nicht`);if(file.sha256){const h=await sha256Hex(buffer);if(h.toLowerCase()!==String(file.sha256).toLowerCase())throw new Error(`${file.installPath||file.path}: SHA-256 stimmt nicht`);}const headers=new Headers(response.headers);headers.set('X-KC-DP-Verified','1');if(file.sha256)headers.set('X-KC-DP-SHA256',String(file.sha256));return new Response(buffer,{status:200,statusText:'OK',headers});}
async function cacheRelease(m){const cacheName=m.cacheName||`kc-dp-release-${m.version}`,cache=await caches.open(cacheName),files=m.files.filter(x=>x.runtime!==false);for(const f of files){const source=new URL(f.downloadPath||f.path,self.registration.scope).toString(),target=new URL(f.installPath||f.path,self.registration.scope).toString(),hit=await cache.match(target,{ignoreSearch:true});if(hit)continue;const r=await fetchWithTimeout(source,{cache:'no-store'});if(!r.ok)throw new Error(`${f.installPath||f.path}: HTTP ${r.status}`);await cache.put(target,await verifiedResponse(f,r));}return cacheName;}
async function ensureInitialRelease(){let meta=await readMeta();if(meta?.activeCache)return meta;const m=await fetchManifest(),cacheName=await cacheRelease(m),fingerprint=await manifestFingerprint(m);return writeMeta({activeCache:cacheName,activeVersion:m.version,manifestFingerprint:fingerprint,buildId:`${m.version}-${fingerprint.slice(0,12)}`,previousCache:null,previousVersion:null,pendingBoot:false,switchedAt:null,engine:ENGINE});}
async function refreshForcedRuntime(meta){try{if(!meta?.activeCache)return meta;const m=await fetchManifest();if(String(m.version)!==String(meta.activeVersion))return meta;const forced=m.files.filter(x=>x.runtime!==false&&x.forceRefresh===true);if(!forced.length)return meta;const cache=await caches.open(meta.activeCache);for(const f of forced){const source=new URL(f.downloadPath||f.path,self.registration.scope),target=new URL(f.installPath||f.path,self.registration.scope).toString();source.searchParams.set('kc_sw_refresh',Date.now().toString());const r=await fetchWithTimeout(source.toString(),{cache:'no-store'});if(!r.ok)throw new Error(`${f.installPath||f.path}: HTTP ${r.status}`);const verified=await verifiedResponse(f,r);const headers=new Headers(verified.headers);headers.set('X-KC-DP-Release',String(m.version));headers.set('X-KC-DP-Forced-Refresh','1');await cache.put(target,new Response(await verified.arrayBuffer(),{status:200,headers}));}meta={...meta,forcedRefreshAt:new Date().toISOString(),engine:ENGINE};await writeMeta(meta);}catch(_){}return meta;}
async function pruneCaches(meta){const keys=(await caches.keys()).filter(k=>k.startsWith('kc-dp-release-'));const keep=new Set([meta?.activeCache,meta?.previousCache].filter(Boolean));for(const k of keys)if(!keep.has(k))await caches.delete(k);}
async function pruneAllOldReleaseCaches(activeCache){const keys=(await caches.keys()).filter(k=>k.startsWith('kc-dp-release-'));let removed=0;for(const k of keys){if(k!==activeCache){await caches.delete(k);removed++;}}return removed;}
async function maybeRollback(meta){if(!meta?.pendingBoot||!meta.previousCache)return meta;const age=Date.now()-Number(meta.switchedAt||0);if(age<120000)return meta;const old=await caches.open(meta.previousCache),ok=await old.match(new URL(FALLBACK,self.registration.scope).toString(),{ignoreSearch:true});if(!ok)return meta;const reverted={...meta,activeCache:meta.previousCache,activeVersion:meta.previousVersion||'previous',previousCache:meta.activeCache,previousVersion:meta.activeVersion,pendingBoot:false,rolledBackAt:new Date().toISOString(),rollbackReason:'BOOT_NOT_CONFIRMED'};await writeMeta(reverted);return reverted;}
async function normalizeRecoveryCache(meta){try{if(!meta?.activeCache)return meta;const m=await fetchManifest();if(String(m.version)!==String(meta.activeVersion))return meta;const cache=await caches.open(meta.activeCache);for(const f of m.files.filter(x=>x.runtime!==false&&x.installPath)){const target=new URL(f.installPath,self.registration.scope).toString();if(await cache.match(target,{ignoreSearch:true}))continue;const source=new URL(f.downloadPath||f.path,self.registration.scope).toString();const hit=await cache.match(source,{ignoreSearch:true});if(hit)await cache.put(target,hit.clone());}}catch(_){}return meta;}
async function activeMeta(){return maybeRollback((await readMeta())||await ensureInitialRelease());}
async function tellClients(payload){const list=await clients.matchAll({type:'window',includeUncontrolled:true});for(const c of list)c.postMessage(payload);}

function startStep(run,name,status,detail){run.steps.push({at:new Date().toISOString(),name,status,detail:String(detail||'')});}
async function runAuthPreflight(run){
  const started=Date.now();
  try{
    const url=`${SUPABASE_AUTH_HEALTH}?kc_start_guard=${Date.now()}`;
    const r=await fetchWithTimeout(url,{cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'}},AUTH_PREFLIGHT_TIMEOUT_MS);
    const latencyMs=Date.now()-started;
    run.authPreflight={ok:r.ok,httpStatus:r.status,latencyMs,endpoint:SUPABASE_AUTH_HEALTH,error:null};
    if(r.ok){startStep(run,'Supabase Auth','green',`Erreichbar · HTTP ${r.status} · ${latencyMs} ms`);return 'green';}
    if(r.status===401||r.status===403){startStep(run,'Supabase Auth','green',`Auth-Service erreichbar · HTTP ${r.status} · ${latencyMs} ms`);return 'green';}
    if(r.status>=500){startStep(run,'Supabase Auth','red',`Serverfehler HTTP ${r.status} nach ${latencyMs} ms`);return 'red';}
    startStep(run,'Supabase Auth','yellow',`Auth-Service erreichbar, aber HTTP ${r.status} nach ${latencyMs} ms`);return 'yellow';
  }catch(e){
    const latencyMs=Date.now()-started,message=e?.name==='AbortError'?`Keine Antwort innerhalb ${AUTH_PREFLIGHT_TIMEOUT_MS/1000} Sekunden`:(e?.message||String(e));
    run.authPreflight={ok:false,httpStatus:null,latencyMs,endpoint:SUPABASE_AUTH_HEALTH,error:message};
    startStep(run,'Supabase Auth','yellow',`${message} · ${latencyMs} ms`);
    return 'yellow';
  }
}
async function verifyManifestRelease(m,run){
  const cacheName=m.cacheName||`kc-dp-release-${m.version}`,cache=await caches.open(cacheName),files=m.files.filter(f=>f&&f.runtime!==false&&f.path);
  let verified=0,refreshed=0;
  for(const f of files){
    const install=f.installPath||f.path,target=new URL(install,self.registration.scope).toString();
    let valid=false,hit=await cache.match(target,{ignoreSearch:true});
    if(hit){
      try{
        if(f.sha256){const b=await hit.clone().arrayBuffer(),h=await sha256Hex(b);valid=h.toLowerCase()===String(f.sha256).toLowerCase()&&(!Number(f.bytes||0)||Math.abs(b.byteLength-Number(f.bytes))<=4);}else if(Number(f.bytes||0)>0){const b=await hit.clone().arrayBuffer();valid=Math.abs(b.byteLength-Number(f.bytes))<=4;}else valid=true;
      }catch(_){valid=false;}
    }
    if(!valid){
      const source=new URL(f.downloadPath||f.path,self.registration.scope);source.searchParams.set('kc_start_guard',Date.now().toString());
      const r=await fetchWithTimeout(source.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}},START_GUARD_TIMEOUT_MS);
      if(!r.ok)throw new Error(`${install}: HTTP ${r.status}`);
      const vr=await verifiedResponse(f,r);const headers=new Headers(vr.headers);headers.set('X-KC-DP-Release',String(m.version));headers.set('X-KC-DP-Start-Guard','1');const body=await vr.arrayBuffer();await cache.put(target,new Response(body,{status:200,headers}));refreshed++;
    }
    verified++;
  }
  startStep(run,'Runtime-Dateien','green',`${verified} geprüft, ${refreshed} erneuert`);
  return {cacheName,verified,refreshed};
}
async function finishStartRun(run){run.finishedAt=new Date().toISOString();await appendStartLog(run);await tellClients({type:'KC_DP_START_GUARD_STATUS',run}).catch(()=>{});return run;}
async function runStartGuard(){
  const run={id:`START-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`,startedAt:new Date().toISOString(),finishedAt:null,status:'running',engine:ENGINE,version:null,manifestFingerprint:null,buildId:null,buildConflict:false,buildMigration:false,authPreflight:null,activeCache:null,removedOldCaches:0,steps:[]};
  startStep(run,'Startprüfung','green','Wächter gestartet');
  try{
    const m=await fetchManifest(START_GUARD_TIMEOUT_MS);run.version=String(m.version);run.manifestFingerprint=await manifestFingerprint(m);run.buildId=`${run.version}-${run.manifestFingerprint.slice(0,12)}`;
    startStep(run,'Update-Manifest','green',`Version ${m.version}, Cache ${m.cacheName||`kc-dp-release-${m.version}`}`);
    startStep(run,'Build-Fingerprint','green',run.buildId);
    const old=await readMeta();
    if(old?.activeVersion&&String(old.activeVersion)===run.version&&old.manifestFingerprint&&String(old.manifestFingerprint)!==run.manifestFingerprint){
      run.buildMigration=true;run.activeCache=old.activeCache||null;
      startStep(run,'Build-Migration','yellow',`Offizieller Hotfix bei gleicher Version: ${String(old.manifestFingerprint).slice(0,12)} → ${run.manifestFingerprint.slice(0,12)}. Vollständige SHA-256-Prüfung wird erzwungen.`);
    }
    const authStatus=await runAuthPreflight(run);
    const verified=await verifyManifestRelease(m,run);
    const next={...(old||{}),activeCache:verified.cacheName,activeVersion:run.version,manifestFingerprint:run.manifestFingerprint,buildId:run.buildId,previousCache:null,previousVersion:null,pendingBoot:false,switchedAt:null,startGuardAt:new Date().toISOString(),lastAuthPreflight:run.authPreflight,lastBuildMigration:run.buildMigration?{at:new Date().toISOString(),from:old?.manifestFingerprint||null,to:run.manifestFingerprint}:old?.lastBuildMigration||null,engine:ENGINE};
    await writeMeta(next);run.activeCache=verified.cacheName;startStep(run,'Aktiver Release','green',`${run.version} / ${run.buildId} ist aktiv und verifiziert`);
    run.removedOldCaches=await pruneAllOldReleaseCaches(verified.cacheName);startStep(run,'Alte Release-Caches','green',run.removedOldCaches?`${run.removedOldCaches} alter Cache gelöscht`:'Keine alten Release-Caches vorhanden');
    run.status=authStatus==='red'?'red':(run.buildMigration?'yellow':authStatus);
  }catch(e){
    const meta=await readMeta().catch(()=>null);run.activeCache=meta?.activeCache||null;
    const hasFallback=!!meta?.activeCache;
    run.status=hasFallback?'yellow':'red';
    startStep(run,'Startprüfung',run.status,e?.name==='AbortError'?'Zeitüberschreitung beim Servercheck':(e?.message||String(e)));
    if(hasFallback)startStep(run,'Offline-Fallback','yellow',`Nur verifizierter vorhandener Cache ${meta.activeCache} wird verwendet; alte Fremd-Caches werden nicht aktiviert.`);
  }
  return finishStartRun(run);
}
function isCriticalRuntime(req,url){return req.mode==='navigate'||['script','style'].includes(req.destination)||/\.(?:js|css)(?:$|\?)/i.test(url.pathname)||url.pathname.endsWith('/index.html');}
async function activeCacheResponse(request){const meta=await activeMeta(),cache=await caches.open(meta.activeCache);return (await cache.match(request,{ignoreSearch:true}))||(await cache.match(new URL(FALLBACK,self.registration.scope).toString(),{ignoreSearch:true}))||Response.error();}
function badgeHtml(run){
  const status=run?.status||'yellow',green=status==='green',yellow=status==='yellow',bg=green?'#176b3a':yellow?'#9a6a00':'#a31724',label=green?'✓ GRÜN':yellow?'⚠ GELB':'✕ ROT';
  const details=(run?.steps||[]).map(s=>`${s.status==='green'?'✓':s.status==='yellow'?'⚠':'✕'} ${s.name}: ${s.detail}`).join('\n').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div id="kcStartGuardBadge" style="position:fixed;right:10px;bottom:10px;z-index:2147483600;font-family:system-ui,Arial,sans-serif"><button id="kcStartGuardBtn" type="button" style="border:0;border-radius:999px;padding:9px 13px;background:${bg};color:#fff;font-weight:800;box-shadow:0 3px 12px #0004">Start ${label}</button><pre id="kcStartGuardDetails" style="display:none;white-space:pre-wrap;width:min(88vw,560px);max-height:45vh;overflow:auto;margin:7px 0 0;padding:12px;border-radius:12px;background:#fff;color:#222;border:2px solid ${bg};box-shadow:0 8px 26px #0005;font:12px/1.45 ui-monospace,monospace">${details}</pre></div><script>(function(){var b=document.getElementById('kcStartGuardBtn'),d=document.getElementById('kcStartGuardDetails');if(b&&d)b.addEventListener('click',function(){d.style.display=d.style.display==='none'?'block':'none'});})();</script>`;
}
async function injectBadge(response,run){try{const type=response.headers.get('content-type')||'';if(!/text\/html/i.test(type))return response;let html=await response.text();const badge=badgeHtml(run);html=html.includes('</body>')?html.replace('</body>',badge+'</body>'):html+badge;const h=new Headers(response.headers);h.set('Cache-Control','no-store');h.delete('Content-Length');return new Response(html,{status:response.status,statusText:response.statusText,headers:h});}catch(_){return response;}}
async function pushReceipt(data,eventName){try{const notificationId=String(data?.notificationId||'');if(!notificationId)return false;const sub=await self.registration.pushManager.getSubscription();const endpoint=sub?.endpoint;if(!endpoint)return false;const r=await fetchWithTimeout(PUSH_RECEIPT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({notificationId,endpoint,event:eventName}),cache:'no-store'});return r.ok;}catch(_){return false;}}

self.addEventListener('install',event=>event.waitUntil((async()=>{await ensureInitialRelease();await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{let meta=await ensureInitialRelease();meta=await refreshForcedRuntime(meta);meta=await normalizeRecoveryCache(meta);await pruneCaches(meta);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.origin!==self.location.origin)return;const d=event.data||{};if(d.type==='KC_DP_SWITCH_RELEASE')event.waitUntil((async()=>{try{const cache=await caches.open(String(d.cacheName||'')),expected=Array.isArray(d.expectedFiles)?d.expectedFiles:[];for(const p of expected){const u=new URL(p,self.registration.scope).toString();if(!await cache.match(u,{ignoreSearch:true}))throw new Error(`Update-Datei fehlt im geprüften Cache: ${p}`);}const old=await activeMeta(),next={activeCache:String(d.cacheName),activeVersion:String(d.version),manifestFingerprint:null,buildId:null,previousCache:old?.activeCache||null,previousVersion:old?.activeVersion||null,pendingBoot:true,switchedAt:Date.now(),engine:ENGINE};await writeMeta(next);await pruneCaches(next);await tellClients({type:'KC_DP_UPDATE_ACTIVATED',version:String(d.version)});}catch(e){await tellClients({type:'KC_DP_UPDATE_ACTIVATION_FAILED',version:String(d.version||''),message:e instanceof Error?e.message:String(e)});}})());if(d.type==='KC_DP_BOOT_OK')event.waitUntil((async()=>{const meta=await readMeta();if(meta?.pendingBoot&&String(d.version||'')===String(meta.activeVersion||'')){meta.pendingBoot=false;meta.bootConfirmedAt=new Date().toISOString();await writeMeta(meta);await pruneCaches(meta);}})());if(d.type==='KC_DP_RELEASE_STATUS')event.waitUntil((async()=>{const meta=await activeMeta();event.source?.postMessage?.({type:'KC_DP_RELEASE_STATUS_RESULT',meta});})());if(d.type==='KC_DP_START_GUARD_LOG')event.waitUntil((async()=>{event.source?.postMessage?.({type:'KC_DP_START_GUARD_LOG_RESULT',logs:await readStartLogs()});})());});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin){if(/\.supabase\.co$/i.test(url.hostname)){event.respondWith(fetchWithTimeout(event.request,{cache:'no-store'}));}return;}
  if(url.toString()===START_LOG_URL){event.respondWith((async()=>new Response(JSON.stringify(await readStartLogs(),null,2),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}))());return;}
  if(url.searchParams.has('kc_update')||event.request.headers.get('X-KC-DP-Update')==='1'){event.respondWith(fetchWithTimeout(event.request,{cache:'no-store'}));return;}
  if(url.pathname.endsWith('/update-manifest.json')||url.pathname.endsWith('/service-worker.js')){event.respondWith(fetchWithTimeout(event.request,{cache:'no-store'}));return;}
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      const run=await runStartGuard();
      let r;
      try{
        const meta=await activeMeta(),cache=await caches.open(meta.activeCache),canonical=new URL(FALLBACK,self.registration.scope).toString();
        r=(await cache.match(canonical,{ignoreSearch:true}))||await fetchWithTimeout(event.request,{cache:'no-store',headers:{'Cache-Control':'no-cache'}},START_GUARD_TIMEOUT_MS);
      }catch(_){r=await activeCacheResponse(event.request);}
      return injectBadge(r,run);
    })());return;
  }
  if(isCriticalRuntime(event.request,url)){
    event.respondWith((async()=>{
      const meta=await activeMeta(),cache=await caches.open(meta.activeCache);
      const verified=await cache.match(event.request,{ignoreSearch:true});
      if(verified)return verified;
      try{return await fetchWithTimeout(event.request,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});}
      catch(_){return Response.error();}
    })());return;
  }
  event.respondWith((async()=>{const meta=await activeMeta(),cache=await caches.open(meta.activeCache),hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;try{const r=await fetchWithTimeout(event.request);if(r&&r.ok)await cache.put(event.request,r.clone());return r;}catch(_){return (await cache.match(new URL(FALLBACK,self.registration.scope).toString(),{ignoreSearch:true}))||Response.error();}})());
});

self.addEventListener('push',event=>{let data={};try{data=event.data?.json?.()||{body:event.data?.text?.()||''};}catch(_){data={body:event.data?.text?.()||''};}const title=data.title||'KC DP';event.waitUntil((async()=>{await self.registration.showNotification(title,{body:data.body||'',data:data.data||{},tag:data.data?.notificationId||undefined,renotify:true});await pushReceipt(data.data,'displayed');})());});
self.addEventListener('notificationclick',event=>{event.notification.close();const data=event.notification.data||{},query=new URLSearchParams();if(data.notificationId)query.set('notification',data.notificationId);if(data.route)query.set('route',data.route);if(data.date)query.set('date',data.date);if(data.requestId)query.set('request',data.requestId);const url='./index.html'+(query.toString()?'?'+query.toString():'');event.waitUntil((async()=>{await pushReceipt(data,'opened');const list=await clients.matchAll({type:'window',includeUncontrolled:true});for(const c of list){if('focus'in c){c.postMessage({type:'KC_DP_NOTIFICATION_OPEN',data});return c.focus();}}return clients.openWindow?clients.openWindow(url):undefined;})());});
self.addEventListener('notificationclose',event=>{const data=event.notification?.data||{};event.waitUntil(pushReceipt(data,'dismissed'));});
