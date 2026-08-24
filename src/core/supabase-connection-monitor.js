(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const state=K.supabaseConnectionMonitorState=K.supabaseConnectionMonitorState||{
  running:false,inFlight:false,failures:0,lastOkAt:null,lastAttemptAt:null,lastError:null,nextCheckAt:null,reason:'init',mode:'checking',detail:''
};
let timer=null,offSync=null,ledObserver=null,painting=false;
const cfg=()=>K.integrationConfig?.supabase||{};
const now=()=>new Date().toISOString();
const online=()=>typeof navigator==='undefined'||navigator.onLine!==false;
const foreground=()=>typeof document==='undefined'||document.visibilityState!=='hidden';
const led=()=>typeof document==='undefined'?null:document.getElementById('supabaseStatusLed');
const waitingForLogin=message=>/keine gültige supabase-auth-sitzung|bitte anmelden|auth-sitzung fehlt|anmeldung.*erforderlich/i.test(String(message||''));
function recentOk(maxMs=90000){const t=Date.parse(state.lastOkAt||'');return Number.isFinite(t)&&Date.now()-t<=maxMs;}
function desiredClass(mode=state.mode){return mode==='ok'?'ok':mode==='checking'?'maintenance':'error';}
function paint(mode,detail=''){
  state.mode=mode;state.detail=detail||state.detail||'';
  const el=led();if(!el)return;
  const cls=desiredClass(mode);
  if(el.className==='led led-status '+cls&&el.title===state.detail)return;
  painting=true;
  el.className='led led-status '+cls;
  el.title=state.detail||({ok:'Supabase verbunden',checking:'Supabase wird geprüft / Verbindung wird wiederhergestellt',error:'Supabase aktuell nicht erreichbar'}[mode]||'Supabase Status');
  el.dataset.kcConnectionMonitor=mode;
  if(K.state)K.state.supabaseConnected=mode==='ok';
  queueMicrotask(()=>{painting=false;});
}
function enforceLed(){
  const el=led();if(!el||painting)return;
  const cls=desiredClass();
  if(!el.classList.contains(cls)||el.dataset.kcConnectionMonitor!==state.mode)paint(state.mode,state.detail);
}
function bindLedGuard(){
  const el=led();if(!el)return false;
  try{ledObserver?.disconnect?.();}catch(_){ }
  ledObserver=new MutationObserver(enforceLed);
  ledObserver.observe(el,{attributes:true,attributeFilter:['class','title','data-kc-connection-monitor']});
  enforceLed();return true;
}
function schedule(ms,reason='heartbeat'){
  if(timer)clearTimeout(timer);
  if(!state.running)return;
  const delay=Math.max(1000,Number(ms)||60000);
  state.nextCheckAt=new Date(Date.now()+delay).toISOString();
  timer=setTimeout(()=>check(reason),delay);
}
function nextNormalDelay(){return foreground()?60000:180000;}
function nextFailureDelay(){return state.failures<=1?3000:state.failures===2?10000:30000;}
async function waitForRuntime(timeoutMs=15000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(K.sync?.hasProvider?.()&&K.supabaseConnection?.ensureSession)return true;
    try{K.supabaseConnection?.configureIfPossible?.();}catch(_){ }
    await new Promise(r=>setTimeout(r,250));
  }
  return !!K.sync?.hasProvider?.();
}
async function check(reason='heartbeat'){
  if(!state.running)return {skipped:true,reason:'stopped'};
  if(state.inFlight)return {skipped:true,reason:'already_running'};
  state.reason=reason;state.lastAttemptAt=now();
  bindLedGuard();
  if(cfg().onlineSyncEnabled===false){
    state.failures=0;state.lastError=null;
    paint('checking','Online-Synchronisation ist bewusst deaktiviert.');
    schedule(nextNormalDelay(),'disabled');return {skipped:true,reason:'disabled'};
  }
  if(!online()){
    state.failures=Math.max(3,state.failures+1);state.lastError='Gerät offline';
    paint('error','Gerät hat keine Internetverbindung. Lokale Arbeit bleibt möglich.');
    schedule(10000,'offline');return {ok:false,offline:true};
  }
  state.inFlight=true;
  try{
    paint('checking',reason==='startup'?'Supabase-Verbindung wird beim Programmstart hergestellt …':'Supabase-Verbindung wird geprüft …');
    const ready=await waitForRuntime();
    if(!ready)throw new Error('Supabase-Provider ist noch nicht bereit.');
    await K.supabaseConnection.ensureSession();
    const result=await K.sync.healthCheck();
    state.failures=0;state.lastOkAt=now();state.lastError=null;
    paint('ok','Supabase verbunden · zuletzt geprüft '+new Date(state.lastOkAt).toLocaleTimeString('de-DE'));
    schedule(nextNormalDelay(),'heartbeat');
    return {ok:true,result};
  }catch(e){
    state.lastError=e?.message||String(e);
    if(waitingForLogin(state.lastError)){
      state.failures=0;
      paint('checking','Supabase erreichbar · Anmeldung wird abgewartet.');
      schedule(5000,'await-login');
      return {ok:false,waitingForLogin:true,error:state.lastError,failures:0};
    }
    state.failures++;
    if(state.failures<3||recentOk())paint('checking',`Kurze Unterbrechung · automatische Wiederverbindung läuft (${state.failures}/3).`);
    else paint('error','Supabase nach drei bestätigten Versuchen nicht erreichbar: '+state.lastError);
    schedule(nextFailureDelay(),'reconnect');
    return {ok:false,error:state.lastError,failures:state.failures};
  }finally{state.inFlight=false;}
}
function start(){
  if(state.running)return state;
  state.running=true;state.mode='checking';state.detail='Supabase-Verbindung wird beim Programmstart hergestellt …';
  bindLedGuard();paint('checking',state.detail);
  try{offSync=K.sync?.on?.(()=>{if(state.failures===0&&recentOk())paint('ok',state.detail);else if(state.failures>0&&state.failures<3)paint('checking',state.detail);});}catch(_){ }
  setTimeout(()=>check('startup'),0);
  return state;
}
function stop(){state.running=false;if(timer)clearTimeout(timer);timer=null;try{offSync?.();}catch(_){ }offSync=null;try{ledObserver?.disconnect?.();}catch(_){ }ledObserver=null;}
if(typeof addEventListener==='function'){
  addEventListener('online',()=>{if(state.running){state.failures=0;paint('checking','Internet wieder verfügbar · Supabase wird neu verbunden …');check('browser-online');}});
  addEventListener('offline',()=>{state.failures=Math.max(3,state.failures+1);state.lastError='Gerät offline';paint('error','Gerät hat keine Internetverbindung. Lokale Arbeit bleibt möglich.');});
  addEventListener('pageshow',()=>{if(state.running)check('pageshow');});
}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.running)check('foreground');});
K.supabaseConnectionMonitor={version:'0.19.51-monitor3',state,start,stop,check,enforceLed};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});else setTimeout(start,0);
})();
