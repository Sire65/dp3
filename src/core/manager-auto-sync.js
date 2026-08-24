(function(){
  const K=window.KCDP=window.KCDP||{};
  const state={status:'idle',inFlight:false,lastAttemptAt:null,lastSuccessAt:null,lastReason:null,lastError:null,lastResult:null,persisted:false};
  let running=null;

  function enabled(){return K.integrationConfig?.pcManager?.autoSync===true;}
  function authenticated(){return K.memberAccess?.state?.status==='authenticated'&&K.supabaseConnection?.state?.authStatus==='authenticated'&&!K.memberAccess?.state?.user?.localTest;}
  function permitted(){try{return !!K.auth?.has?.('roster.people.sync');}catch(_){return false;}}
  function canRun(){
    if(!enabled())return {ok:false,code:'disabled'};
    if(!authenticated())return {ok:false,code:'not_authenticated'};
    if(!permitted())return {ok:false,code:'not_permitted'};
    if(typeof K.pcManagerConnection?.syncAll!=='function')return {ok:false,code:'provider_missing'};
    return {ok:true,code:'ready'};
  }
  function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(_){return null;}}
  function markSkipped(reason,code){state.status='skipped';state.lastReason=reason;state.lastError=null;state.lastResult={ok:false,skipped:true,code,reason};return clone(state.lastResult);}

  async function run(reason='authenticated'){
    if(running)return running;
    const gate=canRun();
    if(!gate.ok)return markSkipped(reason,gate.code);
    state.inFlight=true;state.status='syncing';state.lastAttemptAt=new Date().toISOString();state.lastReason=reason;state.lastError=null;state.persisted=false;
    running=(async()=>{
      try{
        const snapshot=await K.pcManagerConnection.syncAll(),apply=snapshot?.kcDpApply||{};
        if(apply.applied===false){
          const block=K.pcManagerConnection?.state?.lastBlock||{};
          state.status='blocked';state.lastError=null;state.lastResult={ok:false,blocked:true,code:block.code||apply.people?.code||'MANAGER_NOT_READY',reason:block.reason||apply.people?.reason||'Manager/Core-Daten sind noch nicht vollständig freigegeben.',contextApplied:false};
          K.sourceHealthUi?.refresh?.();return clone(state.lastResult);
        }
        let persisted=false;
        if(typeof K.persistAll==='function'){
          try{await K.persistAll();persisted=true;}catch(e){state.lastError='Übernahme erfolgreich, lokales Speichern noch nicht möglich: '+e.message;}
        }
        state.persisted=persisted;state.status='ready';state.lastSuccessAt=new Date().toISOString();
        state.lastResult={ok:true,applied:true,people:Array.isArray(snapshot?.people)?snapshot.people.length:Number(apply.people?.people?.length||0),contextApplied:!!apply.contextApplied,source:K.pcManagerConnection?.state?.lastSource||snapshot?.meta?.source||null,persisted};
        K.sourceHealthUi?.refresh?.();K.dayAvailabilityUi?.refresh?.();K.quickPlanRecommendationsUi?.refresh?.();
        window.dispatchEvent(new CustomEvent('KC_DP_MANAGER_AUTO_SYNC',{detail:clone(state.lastResult)}));
        return clone(state.lastResult);
      }catch(e){
        state.status='error';state.lastError=e?.message||String(e);state.lastResult={ok:false,error:true,reason:state.lastError};
        K.sourceHealthUi?.refresh?.();
        window.dispatchEvent(new CustomEvent('KC_DP_MANAGER_AUTO_SYNC',{detail:clone(state.lastResult)}));
        return clone(state.lastResult);
      }finally{state.inFlight=false;running=null;}
    })();
    return running;
  }

  function wrapAsync(name,reason){
    const api=K.memberAccess,original=api?.[name];if(typeof original!=='function'||original.__kcManagerAutoSync)return false;
    const wrapped=async function(...args){const out=await original.apply(this,args);await run(reason);return out;};
    wrapped.__kcManagerAutoSync=true;wrapped.__kcOriginal=original;api[name]=wrapped;return true;
  }
  function install(){
    const wrapped=['signInPassword','verifyFirstAccessCode','restore'].map(name=>wrapAsync(name,name)).filter(Boolean).length;
    state.status=wrapped?'armed':state.status;return wrapped;
  }

  K.managerAutoSync={version:'0.19.42',state,enabled,authenticated,permitted,canRun,run,install};
  install();
})();
