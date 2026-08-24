(function(){
  const K=window.KCDP=window.KCDP||{};
  let provider=typeof window.KCDPAuthProvider==='function'?window.KCDPAuthProvider:null;
  const state={mode:'authenticated',lastActivityAt:new Date().toISOString(),timeoutMinutes:10,provider:!!provider};
  function monitorUser(){return {personId:null,role:'read_only',displayName:'Monitor'};}
  async function login({personId,role='employee',pin=''}){
    if(provider){const res=await provider({action:'login',personId,role,pin});if(!res?.ok)throw new Error(res?.message||'Anmeldung abgelehnt.');personId=res.personId||personId;role=res.role||role;}
    else {if(String(pin)!=='2468')throw new Error('Demo-PIN falsch. Für Produktion muss der KC-Auth-Provider verbunden werden.');}
    const p=K.person(personId);if(!p)throw new Error('Person nicht gefunden.');K.auth.setCurrentUser({personId,role,displayName:p.name});state.mode='authenticated';touch();K.recordAudit?.('session.login',{entity:'session',entityId:personId,after:{role,provider:!!provider}});return K.currentUser;
  }
  function logout(reason='manuell'){const before={...K.currentUser};K.currentUser=monitorUser();state.mode='monitor';touch();K.recordAudit?.('session.logout',{entity:'session',entityId:before.personId,before,after:K.currentUser,reason});return K.currentUser;}
  function touch(){state.lastActivityAt=new Date().toISOString();}
  function expired(){
    // Eine echte Supabase-Sitzung verwaltet ihre Gültigkeit über Access-/Refresh-Token.
    // Der lokale Demo-/Monitor-Timeout darf diese Cloud-Sitzung nicht nach 10 Minuten künstlich abmelden.
    if(state.provider==='supabase')return false;
    return state.mode==='authenticated'&&(Date.now()-new Date(state.lastActivityAt).getTime())>state.timeoutMinutes*60000;
  }
  function check(){if(expired())logout('Inaktivität');return state.mode;}
  function adoptAuthenticatedUser({personId,role='employee',displayName='',provider:providerName='trusted'}={}){const p=K.person(personId);if(!p)throw new Error('Person nicht gefunden.');K.auth.setCurrentUser({personId,role,displayName:displayName||p.name});state.mode='authenticated';state.provider=providerName||!!provider;touch();K.recordAudit?.('session.login',{entity:'session',entityId:personId,after:{role,provider:providerName||'trusted'}});return K.currentUser;}
  K.session={version:'0.18.1',state,login,logout,adoptAuthenticatedUser,touch,check,isMonitor:()=>state.mode==='monitor',setProvider(fn){provider=typeof fn==='function'?fn:null;state.provider=!!provider;},setTimeoutMinutes(v){state.timeoutMinutes=Math.max(1,Number(v||10));}};
})();
