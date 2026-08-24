(function(){
 const K=window.KCDP=window.KCDP||{};
 const state={running:false,inFlight:false,lastRunAt:null,nextRunAt:null,lastResult:null,lastError:null,online:typeof navigator==='undefined'?true:navigator.onLine!==false};
 let timer=null;
 function cfg(){return K.integrationConfig?.supabase||{};}
 function clear(){if(timer){clearTimeout(timer);timer=null;}state.running=false;state.nextRunAt=null;}
 function schedule(){clear();const c=cfg();if(!c.onlineSyncEnabled||!c.autoSync)return state;const min=Math.max(1,Number(c.syncIntervalMinutes||1));state.running=true;state.nextRunAt=new Date(Date.now()+min*60000).toISOString();timer=setTimeout(()=>runNow({silent:true}).finally(schedule),min*60000);return state;}
 async function runNow({silent=false}={}){
   if(state.inFlight)return {skipped:true,reason:'already_running'};
   const c=cfg();if(!c.onlineSyncEnabled)return {skipped:true,reason:'disabled'};
   if(!state.online){state.lastError='offline';return {skipped:true,reason:'offline'};}
   if(!K.sync?.hasProvider?.())return {skipped:true,reason:'provider_missing'};
   if(K.memberAccess?.configured?.()&&K.memberAccess?.state?.status!=='authenticated'&&K.supabaseConnection?.state?.authStatus!=='authenticated')return {skipped:true,reason:'auth'};
   state.inFlight=true;
   try{await K.supabaseConnection?.ensureSession?.();const result=await K.sync.syncBoth();state.lastRunAt=new Date().toISOString();state.lastResult=result;state.lastError=null;return result;}
   catch(e){state.lastError=e.message;if(c.offlineAllowed!==false)return {failed:true,offlineFallback:true,error:e.message};throw e;}
   finally{state.inFlight=false;}
 }
 function start(){return schedule();}
 function stop(){clear();}
 if(typeof addEventListener==='function'){
   addEventListener('online',()=>{state.online=true;if(cfg().autoSync)runNow({silent:true}).finally(schedule)});
   addEventListener('offline',()=>{state.online=false;});
 }
 K.autoSync={version:'0.17.4',state,start,stop,runNow,schedule};
})();
