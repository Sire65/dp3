(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const byId=id=>document.getElementById(id);
  const isSessionModal=()=>{const modal=byId('modal'),h2=modal?.querySelector('h2');return !!h2&&/Anmeldung\s*\/\s*Monitor/.test(h2.textContent||'')};

  function trace(stage,detail=''){
    try{K.loginTrace?.add?.(stage,'info',detail)}catch(_){}
  }

  function installPublicConfigFastPath(){
    const ma=K.memberAccess;
    if(!ma||typeof ma.restorePublicConfig!=='function'||ma.restorePublicConfig.__kcFastPath)return;
    const original=ma.restorePublicConfig.bind(ma);
    const wrapped=async function(){
      if(ma.configured?.()){
        trace('public-config-fast','Supabase-Konfiguration bereits im Speicher – IndexedDB-Laden übersprungen');
        return true;
      }
      trace('public-config-load-start','Öffentliche Supabase-Konfiguration wird geladen');
      const started=performance.now();
      let timer;
      try{
        const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve('__timeout__'),1800)});
        const result=await Promise.race([original(),timeout]);
        if(result==='__timeout__'){
          trace('public-config-load-timeout',`nach ${Math.round(performance.now()-started)} ms – Loginoberfläche wird trotzdem fortgesetzt`);
          return false;
        }
        trace('public-config-load-ok',`${Math.round(performance.now()-started)} ms`);
        return result;
      }catch(e){
        trace('public-config-load-error',e?.message||e);
        return false;
      }finally{clearTimeout(timer)}
    };
    wrapped.__kcFastPath=true;
    ma.restorePublicConfig=wrapped;
  }

  function installAuthGate(){
    if(K.__singleLoginGateInstalled)return;
    if(typeof K.roleUx?.ensureLogin!=='function'||typeof K.memberAccess?.signInPassword!=='function')return;
    K.__singleLoginGateInstalled=true;
    const flow=K.loginFlowGate=K.loginFlowGate||{version:'0.19.55-single-login-5-state-repair',ensurePromise:null,passwordPromise:null,lastPasswordOkAt:0,lastPasswordUser:null,events:[]};
    const mark=(stage,detail='')=>{flow.events.push({at:new Date().toISOString(),stage,detail:String(detail||'')});if(flow.events.length>100)flow.events.shift();trace(stage,detail);};

    function repairRecentAuthenticatedState(){
      const age=flow.lastPasswordOkAt?Date.now()-flow.lastPasswordOkAt:Infinity;
      if(age>120000)return false;
      if(K.memberAccess?.state?.status==='authenticated')return true;

      let user=flow.lastPasswordUser||K.currentUser||K.postLoginIdentityGuard?.state?.snapshot||null;
      if(!user?.personId)return false;

      const hasToken=typeof K.supabaseConnection?.hasAccessToken==='function'?K.supabaseConnection.hasAccessToken():true;
      if(!hasToken)return false;

      try{
        const role=user.role||K.currentUser?.role||'employee';
        const displayName=user.displayName||user.name||K.currentUser?.displayName||'';
        K.auth?.setCurrentUser?.({personId:user.personId,role,displayName});
        if(K.memberAccess?.state){
          K.memberAccess.state.status='authenticated';
          K.memberAccess.state.user={...(K.memberAccess.state.user||{}),personId:user.personId,role,displayName};
          K.memberAccess.state.lastError=null;
        }
        K.session?.adoptAuthenticatedUser?.({personId:user.personId,role,displayName,provider:'supabase'});
        mark('login-gate-state-repair',`Authentifizierter Zustand nach lokalem Entsperren repariert · ${user.personId}`);
        return true;
      }catch(e){
        mark('login-gate-state-repair-error',e?.message||e);
        return false;
      }
    }

    const originalEnsure=K.roleUx.ensureLogin.bind(K.roleUx);
    K.roleUx.ensureLogin=function(){
      if(K.memberAccess?.state?.status==='authenticated')return Promise.resolve(K.currentUser);

      if(repairRecentAuthenticatedState()){
        mark('login-gate-restored','Bestätigte Identität nach lokalem Entsperren wiederverwendet');
        return Promise.resolve(K.currentUser);
      }

      const recentPassword=flow.lastPasswordOkAt&&Date.now()-flow.lastPasswordOkAt<120000;
      if(recentPassword&&K.postLoginIdentityGuard?.restore){
        try{
          if(K.postLoginIdentityGuard.restore('recent-password-reentry')){
            if(K.memberAccess?.state){
              K.memberAccess.state.status='authenticated';
              if(K.currentUser?.personId)K.memberAccess.state.user={...(K.memberAccess.state.user||{}),personId:K.currentUser.personId,role:K.currentUser.role,displayName:K.currentUser.displayName||''};
            }
            mark('login-gate-restored','Bestätigte Identität nach lokalem Entsperren wiederhergestellt');
            return Promise.resolve(K.currentUser);
          }
        }catch(e){mark('login-gate-restore-error',e?.message||e)}
      }

      if(flow.ensurePromise){mark('login-gate-reuse','Vorhandener Anmeldevorgang wird weiterverwendet');return flow.ensurePromise;}
      mark('login-gate-open','Einziger Anmeldevorgang gestartet');
      const p=Promise.resolve().then(()=>originalEnsure());
      flow.ensurePromise=p.then(user=>{mark('login-gate-ok',K.currentUser?.role||'Benutzer');return user;},err=>{mark('login-gate-error',err?.message||err);throw err;});
      flow.ensurePromise.finally(()=>{if(flow.ensurePromise)flow.ensurePromise=null;});
      return flow.ensurePromise;
    };

    const originalPassword=K.memberAccess.signInPassword.bind(K.memberAccess);
    K.memberAccess.signInPassword=function(args){
      if(flow.passwordPromise){mark('password-gate-reuse','Doppeltes Absenden unterdrückt');return flow.passwordPromise;}
      const started=performance.now();mark('password-gate-start','Passwortprüfung gestartet');
      const p=Promise.resolve().then(()=>originalPassword(args));
      flow.passwordPromise=p.then(user=>{
        flow.lastPasswordOkAt=Date.now();
        flow.lastPasswordUser=user?{...user}:K.currentUser?{...K.currentUser}:null;
        mark('password-gate-ok',`${Math.round(performance.now()-started)} ms`);
        return user;
      },err=>{mark('password-gate-error',err?.message||err);throw err;});
      flow.passwordPromise.finally(()=>{flow.passwordPromise=null;});
      return flow.passwordPromise;
    };
  }

  function hardClose(){
    const back=byId('modalBackdrop'),modal=byId('modal');
    back?.classList.add('hidden');
    if(modal){modal.innerHTML='';modal.classList.remove('wide')}
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    return true;
  }

  function bindCloseTarget(el){
    if(!el||el.dataset.kcSessionCloseGuard==='1')return;
    el.dataset.kcSessionCloseGuard='1';
    const close=e=>{e?.preventDefault?.();e?.stopPropagation?.();hardClose()};
    el.addEventListener('click',close,{capture:true});
    el.addEventListener('pointerup',close,{capture:true});
    el.addEventListener('touchend',close,{passive:false,capture:true});
  }

  function addTopClose(){
    const modal=byId('modal');if(!modal||!isSessionModal())return;
    const h2=modal.querySelector('h2');if(!h2)return;
    let b=byId('kcSessionTopClose');
    if(!b){
      h2.style.position='relative';h2.style.paddingRight='58px';
      b=document.createElement('button');
      b.id='kcSessionTopClose';b.type='button';b.setAttribute('aria-label','Anmeldung / Monitor schließen');b.textContent='×';
      Object.assign(b.style,{position:'absolute',right:'0',top:'50%',transform:'translateY(-50%)',width:'48px',height:'48px',borderRadius:'50%',border:'1px solid #d8c9c1',background:'#fff',fontSize:'32px',lineHeight:'40px',cursor:'pointer',zIndex:'10002',touchAction:'manipulation'});
      h2.appendChild(b);
    }
    bindCloseTarget(b);bindCloseTarget(byId('sessionClose'));
  }

  function loadScriptOnce(selector,src,datasetKey){
    if(document.querySelector(selector))return;
    const s=document.createElement('script');s.src=src;s.async=false;s.dataset[datasetKey]='1';document.head.appendChild(s);
  }
  function loadLoginTrace(){
    if(!K.loginTrace)loadScriptOnce('script[data-kc-login-trace]','src/core/login-trace.js?v=0.19.55-startprotokoll-4-continuous','kcLoginTrace');
    loadScriptOnce('script[data-kc-start-protocol-copy]','src/ui/start-protocol-copy.js?v=0.19.55-copy-2-delete-confirm','kcStartProtocolCopy');
  }

  function collapseStartGuard(){const d=byId('kcStartGuardDetails');if(d&&d.style.display!=='none')d.style.display='none'}
  function manageStartGuardBadge(){
    const badge=byId('kcStartGuardBadge'),btn=byId('kcStartGuardBtn'),details=byId('kcStartGuardDetails');
    if(!badge||!btn||!details)return;
    if(!btn.dataset.kcAutoCollapse){
      btn.dataset.kcAutoCollapse='1';
      btn.addEventListener('click',()=>{setTimeout(()=>{if(details.style.display!=='none')details.style.display='none'},7000)});
    }
    const dialogOpen=!!document.querySelector('#kcDiagOverlay,#kcDiagEmergencyOverlay,#kcDiagImmediateOverlay,#kcDiagWatchdogOverlay,#modalBackdrop:not(.hidden)');
    if(dialogOpen&&details.style.display!=='none')details.style.display='none';
  }

  function apply(){
    try{
      installPublicConfigFastPath();installAuthGate();loadLoginTrace();manageStartGuardBadge();
      if(isSessionModal())addTopClose();
    }catch(e){console.error('KC DP2 mobile session hotfix:',e)}
  }

  K.sessionMobileHotfix={version:'0.19.79-auth-state-repair',apply,hardClose,isSessionModal,loadLoginTrace,collapseStartGuard,manageStartGuardBadge,installAuthGate,installPublicConfigFastPath};
  let applyQueued=false;
  const scheduleApply=()=>{
    if(applyQueued)return;
    applyQueued=true;
    requestAnimationFrame(()=>{applyQueued=false;apply()});
  };
  new MutationObserver(scheduleApply).observe(document.body,{subtree:true,childList:true});
  document.addEventListener('click',e=>{if(e.target?.id==='userBtn'||e.target?.closest?.('.ux-userchip'))setTimeout(apply,0)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isSessionModal()){e.preventDefault();hardClose()}},true);
  window.addEventListener('pageshow',()=>setTimeout(apply,0));
  installPublicConfigFastPath();
  installAuthGate();
  apply();
})();
