(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  let ensureFlight=null;
  let refreshFlight=null;
  let installed=false;
  let unlistenSync=null;

  function supLed(){return document.getElementById('supabaseStatusLed');}
  function paint(kind,title=''){
    const el=supLed();
    if(!el)return;
    const cls=kind==='ok'?'ok':kind==='error'?'error':'maintenance';
    el.className='led led-status '+cls;
    el.title=title||(
      cls==='ok'?'Supabase verbunden und geprüft':
      cls==='error'?'Supabase nicht verbunden':
      'Supabase-Verbindung wird geprüft'
    );
    if(K.state)K.state.supabaseConnected=cls==='ok';
  }

  function wireSyncLed(){
    if(unlistenSync||typeof K.sync?.on!=='function')return;
    unlistenSync=K.sync.on(ev=>{
      const st=String(ev?.state?.status||K.sync?.state?.status||'');
      const auth=String(K.supabaseConnection?.state?.authStatus||'');
      if(st==='ready'&&auth==='authenticated')paint('ok','Supabase verbunden · Auth und Datenbank geprüft');
      else if(st==='checking'||st==='syncing'||st==='maintenance'||auth==='refreshing'||auth==='authenticating')paint('maintenance','Supabase-Verbindung wird geprüft');
      else if(st==='error'||st==='offline'||auth==='error'||auth==='signed_out')paint('error','Supabase nicht verbunden');
      else paint('maintenance','Supabase-Status noch nicht verifiziert');
    });
  }

  function install(){
    const sb=K.supabaseConnection;
    if(!sb||installed||sb.__kcSessionSingleFlight){wireSyncLed();return !!installed||!!sb?.__kcSessionSingleFlight;}
    const originalEnsure=typeof sb.ensureSession==='function'?sb.ensureSession.bind(sb):null;
    const originalRefresh=typeof sb.refreshSession==='function'?sb.refreshSession.bind(sb):null;
    if(!originalEnsure)return false;

    sb.ensureSession=async function(){
      if(ensureFlight)return ensureFlight;
      ensureFlight=Promise.resolve().then(()=>originalEnsure()).finally(()=>{ensureFlight=null;});
      return ensureFlight;
    };

    if(originalRefresh){
      sb.refreshSession=async function(){
        if(refreshFlight)return refreshFlight;
        refreshFlight=Promise.resolve().then(()=>originalRefresh()).finally(()=>{refreshFlight=null;});
        return refreshFlight;
      };
    }

    sb.__kcSessionSingleFlight=true;
    installed=true;
    wireSyncLed();
    return true;
  }

  async function refreshOnForeground(){
    if(!install())return;
    if(K.memberAccess?.state?.status!=='authenticated'&&!K.supabaseConnection?.hasAccessToken?.()){
      paint('error','Supabase: keine aktive Anmeldung');
      return;
    }
    paint('maintenance','Supabase-Verbindung wird geprüft');
    try{
      await K.supabaseConnection.ensureSession();
      if(!K.sync?.hasProvider?.())throw new Error('Supabase-Provider ist nicht verbunden.');
      const health=await K.sync.healthCheck();
      if(health?.ok===false)throw new Error('Supabase-Healthcheck fehlgeschlagen.');
      paint('ok','Supabase verbunden · Auth und Datenbank geprüft');
      window.dispatchEvent(new CustomEvent('KC_DP_SUPABASE_SESSION_READY'));
    }catch(e){
      if(K.sync?.state){K.sync.state.status='error';K.sync.state.lastError=e?.message||String(e);}
      K.supabaseConnection.state.lastError=e?.message||String(e);
      paint('error','Supabase nicht verbunden · '+(e?.message||String(e)));
      window.dispatchEvent(new CustomEvent('KC_DP_SUPABASE_SESSION_REFRESH_FAILED',{detail:{message:e?.message||String(e)}}));
    }
  }

  const boot=()=>{install();setTimeout(refreshOnForeground,0);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pageshow',()=>setTimeout(refreshOnForeground,0));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refreshOnForeground,0);});

  K.supabaseSessionGuard={version:'0.19.55-single-flight-led-2',install,refreshOnForeground,paint};
})();
