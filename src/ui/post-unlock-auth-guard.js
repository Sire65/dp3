(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  if(K.__postUnlockAuthGuardInstalled)return;
  K.__postUnlockAuthGuardInstalled=true;

  const MAX_AGE_MS=120000;
  const state=K.postUnlockAuthGuard={
    version:'0.19.55-build83',
    confirmed:null,
    confirmedAt:0,
    explicitLogout:false
  };

  function trace(stage,detail=''){
    try{K.loginTrace?.add?.(stage,'info',detail)}catch(_){}
  }

  function snapshotUser(user){
    const u=user||K.currentUser||K.memberAccess?.state?.user||null;
    if(!u?.personId)return null;
    return {
      personId:u.personId,
      role:u.role||K.currentUser?.role||'employee',
      displayName:u.displayName||u.name||K.currentUser?.displayName||''
    };
  }

  function capture(user){
    const s=snapshotUser(user);
    if(!s)return false;
    state.confirmed=s;
    state.confirmedAt=Date.now();
    state.explicitLogout=false;
    trace('post-unlock-auth-captured',`${s.personId} · ${s.role}`);
    return true;
  }

  function clear(reason=''){
    state.confirmed=null;
    state.confirmedAt=0;
    state.explicitLogout=true;
    trace('post-unlock-auth-cleared',reason||'Explizite Abmeldung');
  }

  function canRestore(){
    if(state.explicitLogout||!state.confirmed?.personId)return false;
    if(Date.now()-state.confirmedAt>MAX_AGE_MS)return false;
    const tokenCheck=K.supabaseConnection?.hasAccessToken;
    if(typeof tokenCheck==='function'&&!tokenCheck.call(K.supabaseConnection))return false;
    return true;
  }

  function restore(reason='ensure-login'){
    if(!canRestore())return false;
    const s=state.confirmed;
    try{
      K.auth?.setCurrentUser?.({personId:s.personId,role:s.role,displayName:s.displayName});
      if(K.memberAccess?.state){
        K.memberAccess.state.status='authenticated';
        K.memberAccess.state.user={...(K.memberAccess.state.user||{}),personId:s.personId,role:s.role,displayName:s.displayName};
        K.memberAccess.state.lastError=null;
      }
      K.session?.adoptAuthenticatedUser?.({personId:s.personId,role:s.role,displayName:s.displayName,provider:'supabase'});
      try{K.postLoginIdentityGuard?.restore?.('post-unlock-direct-guard')}catch(_){}
      trace('post-unlock-auth-restored',`${s.personId} · ${reason}`);
      return true;
    }catch(e){
      trace('post-unlock-auth-restore-error',e?.message||e);
      return false;
    }
  }

  function install(){
    const ma=K.memberAccess,ru=K.roleUx;
    if(!ma||!ru)return false;

    if(typeof ma.signInPassword==='function'&&!ma.signInPassword.__kcPostUnlockCapture){
      const base=ma.signInPassword.bind(ma);
      const wrapped=async function(args){
        const user=await base(args);
        capture(user);
        return user;
      };
      wrapped.__kcPostUnlockCapture=true;
      ma.signInPassword=wrapped;
    }

    if(typeof ma.signOut==='function'&&!ma.signOut.__kcPostUnlockClear){
      const base=ma.signOut.bind(ma);
      const wrapped=async function(...args){
        clear('Explizite Abmeldung');
        return base(...args);
      };
      wrapped.__kcPostUnlockClear=true;
      ma.signOut=wrapped;
    }

    if(typeof ru.ensureLogin==='function'&&!ru.ensureLogin.__kcPostUnlockGuard){
      const base=ru.ensureLogin.bind(ru);
      const wrapped=function(...args){
        if(K.memberAccess?.state?.status==='authenticated')return Promise.resolve(K.currentUser);
        if(restore('erneute Login-Anforderung nach bestätigter Anmeldung'))return Promise.resolve(K.currentUser);
        return base(...args);
      };
      wrapped.__kcPostUnlockGuard=true;
      ru.ensureLogin=wrapped;
    }

    trace('post-unlock-guard-ready','Build 83 · Doppel-Login-Schutz aktiv');
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(install()||tries>=40)clearInterval(timer);
    },100);
  }
})();
