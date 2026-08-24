(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const AUTH_TIMEOUT_MS=6500,RPC_TIMEOUT_MS=12000;
  const state={version:'0.19.55-install-auth-2',lastLoadAt:null,lastError:null};
  const withTimeout=(p,ms,label)=>Promise.race([Promise.resolve(p),new Promise((_,rej)=>setTimeout(()=>rej(new Error(`${label} hat nicht rechtzeitig geantwortet.`)),ms))]);
  function cfg(){try{return K.supabaseConnection?.validateConfig?.()||null}catch(_){return null}}
  async function token(){
    try{await K.memberAccess?.restorePublicConfig?.()}catch(_){}
    let t=K.supabaseConnection?.sessionSnapshot?.()?.access_token;
    if(!t&&K.storage?.unlocked){
      try{const s=await withTimeout(K.storage.get('supabaseSession'),1800,'Gespeicherte Anmeldung');if(s)K.supabaseConnection?.restoreSession?.(s)}catch(_){}
      t=K.supabaseConnection?.sessionSnapshot?.()?.access_token;
    }
    if(!t){try{await withTimeout(K.memberAccess?.restore?.(),AUTH_TIMEOUT_MS,'Anmeldung wiederherstellen')}catch(_){}}
    try{await withTimeout(K.supabaseConnection?.ensureSession?.(),AUTH_TIMEOUT_MS,'Supabase-Anmeldung')}catch(_){}
    return K.supabaseConnection?.sessionSnapshot?.()?.access_token||null;
  }
  async function rpc(name,args){
    const c=cfg(),t=await token();
    if(!c||!t){const e=new Error('Die Online-Anmeldung ist abgelaufen oder konnte nicht wiederhergestellt werden.');e.code='KC_DP_REAUTH_REQUIRED';throw e;}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),RPC_TIMEOUT_MS);
    try{
      const r=await fetch(`${c.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:c.publishableKey,Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(args||{}),cache:'no-store',signal:controller.signal});
      const text=await r.text();
      if(!r.ok){
        if(r.status===401){const e=new Error('Die Online-Anmeldung ist abgelaufen.');e.code='KC_DP_REAUTH_REQUIRED';throw e;}
        if(r.status===403)throw new Error('Für die Installationshistorie fehlt die Berechtigung.');
        throw new Error(`Installationshistorie konnte nicht geladen werden (${r.status}).`);
      }
      try{return text?JSON.parse(text):null}catch(_){return text}
    }catch(e){if(e?.name==='AbortError')throw new Error('Installationshistorie hat nicht rechtzeitig geantwortet.');throw e}
    finally{clearTimeout(timer)}
  }
  async function adminList(limit=250){
    try{const rows=await rpc('kc_dp_installation_admin_list',{p_limit:Math.max(1,Math.min(Number(limit)||250,1000))})||[];state.lastLoadAt=new Date().toISOString();state.lastError=null;return Array.isArray(rows)?rows:[]}
    catch(e){state.lastError=e?.message||String(e);throw e}
  }
  K.installationHistory={state,adminList};
})();
