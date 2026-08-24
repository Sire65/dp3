(function(){
  const K=window.KCDP=window.KCDP||{};
  const state=K.databaseDiagnosticsState=K.databaseDiagnosticsState||{
    local:null,performance:null,performanceHistory:[],startup:{startedAt:performance.now(),phases:[],readyMs:null,loginPromptAtMs:null,loginRequestMs:null,userWaitMs:null},remote:null,steps:{},lastMeasuredAt:null,deviceName:'',tx:0,rx:0,lastTrafficAt:null
  };
  const now=()=>new Date().toISOString();
  const ms=(a,b)=>Math.max(0,Math.round((b-a)*10)/10);
  const perf=()=>globalThis.performance?.now?.()??Date.now();
  const clone=v=>JSON.parse(JSON.stringify(v));
  const status=(ok,label,detail='',latencyMs=null)=>({ok:!!ok,label,detail:String(detail||''),latencyMs,at:now()});

  function defaultDeviceName(){
    try{return String(K.integrationConfig?.supabase?.deviceName||navigator.userAgentData?.platform||navigator.platform||'KC-DP Gerät');}
    catch(_){return String(K.integrationConfig?.supabase?.deviceName||'KC-DP Gerät');}
  }
  state.deviceName=state.deviceName||defaultDeviceName();

  K.sync?.on?.(evt=>{
    if(evt.type==='traffic'){
      if(evt.direction==='tx')state.tx++;
      if(evt.direction==='rx')state.rx++;
      state.lastTrafficAt=now();
    }
  });

  async function measureLocal({rounds=8}={}){
    if(!K.storage?.unlocked)throw new Error('IndexedDB ist noch nicht entsperrt.');
    const payload={probe:'KC_DP_DB_DIAG_V1',ts:now(),text:'x'.repeat(512)};
    let write=0,read=0;
    for(let i=0;i<rounds;i++){
      const key=`__diag_${Date.now()}_${i}`;
      let t=perf();await K.storage.put(key,payload);write+=perf()-t;
      t=perf();const got=await K.storage.get(key);read+=perf()-t;
      if(got?.probe!==payload.probe)throw new Error('IndexedDB Testdatensatz konnte nicht korrekt gelesen/entschlüsselt werden.');
      await K.storage.remove(key);
    }
    const result={ok:true,writeMs:Math.round(write/rounds*10)/10,readMs:Math.round(read/rounds*10)/10,totalMs:Math.round((write+read)/rounds*10)/10,rounds,at:now()};
    state.local=result;state.lastMeasuredAt=result.at;return result;
  }

  async function runPerformanceSuite({rounds=8,onProgress}={}){
    if(!K.storage?.benchmark)throw new Error('Performance-Core ist nicht verfügbar.');
    const result=await K.storage.benchmark({rounds,onProgress}),storage=K.storage.stats?.()||{},startup=clone(state.startup);
    const technicalReadyMs=startup.readyMs==null?null:Math.max(0,startup.readyMs-Number(startup.userWaitMs||0)),scoreParts=[result.perRecord.rawMs<=8,result.perRecord.cryptoMs<=20,result.perRecord.secureMs<=35,technicalReadyMs==null||technicalReadyMs<=1800];
    result.score=Math.round(scoreParts.filter(Boolean).length/scoreParts.length*100);result.grade=result.score>=90?'sehr gut':result.score>=75?'gut':result.score>=50?'prüfen':'kritisch';result.storage=storage;result.startup=startup;
    state.performance=result;state.local={ok:true,writeMs:Math.round(result.secure.writeMs/result.rounds*10)/10,readMs:Math.round(result.secure.readMs/result.rounds*10)/10,totalMs:result.perRecord.secureMs,rounds:result.rounds,measurement:'secure-per-record',at:result.at};state.performanceHistory=[result,...(state.performanceHistory||[])].slice(0,10);state.lastMeasuredAt=result.at;return clone(result);
  }
  function markStartup(phase,detail=''){const at=performance.now(),row={phase:String(phase),detail:String(detail||''),atMs:Math.round((at-state.startup.startedAt)*10)/10};state.startup.phases.push(row);if(phase==='ready')state.startup.readyMs=row.atMs;return clone(row)}
  function markLogin(stage){const at=Math.round((performance.now()-state.startup.startedAt)*10)/10;if(stage==='prompt'){state.startup.loginPromptAtMs=at;return at}if(stage==='request-start'){state.startup.loginRequestStartedAtMs=at;state.startup.userWaitMs=Math.max(0,Math.round((at-Number(state.startup.loginPromptAtMs||at))*10)/10);return at}if(stage==='request-end'){state.startup.loginRequestMs=Math.max(0,Math.round((at-Number(state.startup.loginRequestStartedAtMs||at))*10)/10);return state.startup.loginRequestMs}return at}

  async function timed(fn){const t=perf();const value=await fn();return {value,latencyMs:ms(t,perf())};}

  async function runSupabaseSuite({onStep}={}){
    const steps={};let cfg;
    const publish=(key,row)=>{steps[key]=row;state.steps={...steps};try{onStep?.(key,clone(row),clone(steps));}catch(_){ }return row;};
    const finishEarly=()=>{state.remote={ok:false,latencyMs:null,at:now()};state.lastMeasuredAt=state.remote.at;return {ok:false,steps:clone(steps),remote:clone(state.remote)};};
    try{cfg=K.supabaseConnection.validateConfig();publish('projectUrl',status(true,'Projekt-URL','gültig'));}
    catch(e){publish('projectUrl',status(false,'Projekt-URL',e.message));return finishEarly();}
    try{
      const key=String(cfg.publishableKey||'');
      if(!key)throw new Error('Publishable Key fehlt. Bitte den Key exakt aus Futura Academy kopieren.');
      publish('publishableKey',status(true,'Publishable Key',key.startsWith('sb_publishable_')?'Publishable Key erkannt':'Legacy anon Key erkannt'));
    }catch(e){publish('publishableKey',status(false,'Publishable Key',e.message));return finishEarly();}

    try{const r=await timed(()=>K.supabaseConnection.testProject());publish('project',status(true,'Projekt erreichbar',`HTTP ${r.value.status||200}`,r.latencyMs));}
    catch(e){publish('project',status(false,'Projekt erreichbar',e.message));}

    try{const r=await timed(()=>K.supabaseConnection.ensureSession());const uid=K.supabaseConnection.state.userId||'angemeldet';publish('auth',status(true,'Benutzer-Anmeldung',uid,r.latencyMs));}
    catch(e){publish('auth',status(false,'Benutzer-Anmeldung',e.message));}

    if(steps.auth?.ok){
      try{const r=await timed(()=>K.supabaseConnection.probeDatabase());publish('database',status(true,'Datenbank',r.value.detail||'KC-DP Tabellen erreichbar',r.latencyMs));}
      catch(e){publish('database',status(false,'Datenbank',e.message));}
      try{const r=await timed(()=>K.supabaseConnection.probeRls());const p=r.value||{};publish('rls',status(!!p.ok,'RLS',p.detail||p.role||'RLS geprüft',r.latencyMs));}
      catch(e){publish('rls',status(false,'RLS',e.message));}
      try{const r=await timed(()=>K.supabaseConnection.probeRoundtrip());publish('sync',status(!!r.value?.ok,'Synchronisation',r.value?.detail||'KC-DP Roundtrip erfolgreich',r.latencyMs));}
      catch(e){publish('sync',status(false,'Synchronisation',e.message));}
    }else{
      publish('database',status(false,'Datenbank','Auth fehlt'));
      publish('rls',status(false,'RLS','Auth fehlt'));
      publish('sync',status(false,'Synchronisation','Auth fehlt'));
    }
    const required=['projectUrl','publishableKey','project','auth','database','rls','sync'],vals=Object.values(steps),ok=required.every(k=>steps[k]?.ok===true);
    const lat=vals.filter(x=>Number.isFinite(x.latencyMs)).map(x=>x.latencyMs);
    state.remote={ok,latencyMs:lat.length?Math.round(lat.reduce((a,b)=>a+b,0)/lat.length):null,at:now()};state.steps={...steps};state.lastMeasuredAt=state.remote.at;
    return {ok,steps:clone(steps),remote:clone(state.remote)};
  }

  function gradeLatency(v){v=Number(v);if(!Number.isFinite(v))return {label:'nicht gemessen',pct:0};if(v<=25)return {label:'sehr gut',pct:92};if(v<=75)return {label:'gut',pct:78};if(v<=180)return {label:'mittel',pct:58};if(v<=450)return {label:'langsam',pct:38};return {label:'sehr langsam',pct:20};}
  function snapshot(){return {state:clone(state),sync:{status:K.sync?.state?.status||'offline',lastSyncAt:K.sync?.state?.lastSyncAt||null,pending:K.sync?.pending?.()||0,conflicts:K.sync?.openConflicts?.()||0},supabase:{...clone(K.supabaseConnection?.state||{}),hasProvider:!!K.sync?.hasProvider?.()},config:clone(K.integrationConfig?.supabase||{})};}
  function setDeviceName(name){state.deviceName=String(name||'').trim()||defaultDeviceName();K.integrations?.update?.('supabase',{deviceName:state.deviceName});return state.deviceName;}

  K.databaseDiagnostics={version:'0.19.37',state,measureLocal,runPerformanceSuite,markStartup,markLogin,runSupabaseSuite,gradeLatency,snapshot,setDeviceName};
})();
