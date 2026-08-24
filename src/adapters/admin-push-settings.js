(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  async function auth(){
    const conn=K.supabaseConnection,c=conn?.validateConfig?.();
    if(!c)throw new Error('Supabase ist nicht verbunden.');
    let token=conn?.sessionSnapshot?.()?.access_token;
    if(!token&&K.storage?.unlocked){try{const saved=await K.storage.get('supabaseSession');if(saved)conn?.restoreSession?.(saved)}catch(_){}}
    try{await conn?.ensureSession?.()}catch(_){ }
    token=conn?.sessionSnapshot?.()?.access_token;
    if(!token)throw new Error('Bitte neu anmelden.');
    return {c,token};
  }
  async function rpc(name,args={}){
    const {c,token}=await auth();
    const r=await fetch(`${c.url}/rest/v1/rpc/${name}`,{
      method:'POST',
      headers:{apikey:c.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify(args),cache:'no-store'
    });
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){data=null}
    if(!r.ok)throw new Error(data?.message||data?.error||'Einstellung konnte nicht geladen werden.');
    return data;
  }
  async function get(){return rpc('kc_dp_admin_push_settings_get')}
  async function set(patch={}){return rpc('kc_dp_admin_push_settings_set',{
    p_active:patch.active??null,
    p_success_enabled:patch.successEnabled??null,
    p_error_enabled:patch.errorEnabled??null
  })}
  K.adminPushSettings={version:'1.0',get,set};
})();